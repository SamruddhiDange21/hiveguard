"""Unit tests for HIVEGUARD research anomaly detection and sensor reliability modules."""
import unittest
import numpy as np
import pandas as pd

from src.research.dataset_loader import harmonize_columns, inspect_dataset
from src.research.sensor_reliability import assess_channel_reliability, evaluate_dataset_reliability
from src.research.context_baseline import compute_contextual_baselines
from src.research.anomaly_framework import (
    run_method_a_fixed_thresholds,
    run_method_b_statistical_rolling,
    run_method_c_proposed_framework,
    compare_all_methods,
)
from src.research.simulation_lab import inject_sensor_fault, inject_hypothetical_environmental_stress
from src.research.evaluation import evaluate_binary_detections, benchmark_methods_on_simulation
from src.research.experiment_registry import save_experiment, load_experiments


class TestResearchFramework(unittest.TestCase):

    def setUp(self):
        """Create a synthetic controlled time-series for deterministic testing."""
        np.random.seed(42)
        n = 200
        dates = pd.date_range("2026-05-01 00:00:00", periods=n, freq="15min")
        # 34.5°C normal brood thermoregulation + slight diurnal wave + Gaussian noise
        hour = dates.hour
        temp = 34.4 + 0.3 * np.sin(2 * np.pi * hour / 24.0) + np.random.normal(0, 0.08, n)
        hum = 58.0 + 2.0 * np.cos(2 * np.pi * hour / 24.0) + np.random.normal(0, 0.5, n)
        
        self.df = pd.DataFrame({
            "timestamp": dates,
            "hive_id": "TEST_HIVE_01",
            "temperature_C": np.round(temp, 2),
            "humidity_percent": np.round(hum, 2),
        })

    def test_schema_harmonization(self):
        """Verify column harmonization from non-standard names."""
        df_raw = pd.DataFrame({
            "Date_Time": ["2026-05-01 10:00:00"],
            "temp": [34.5],
            "rh": [60.0],
            "gross_weight": [40.2],
        })
        df_harm, report = harmonize_columns(df_raw)
        self.assertIn("temperature_C", df_harm.columns)
        self.assertIn("humidity_percent", df_harm.columns)
        self.assertIn("weight_kg", df_harm.columns)
        self.assertIn("timestamp", df_harm.columns)

    def test_sensor_reliability_clean_series(self):
        """Clean regular series must have high reliability score (>= 0.85)."""
        df_rel, info = evaluate_dataset_reliability(self.df)
        self.assertGreaterEqual(info["overall_mean_reliability"], 0.85)
        self.assertEqual(df_rel["overall_sensor_status"].iloc[50], "RELIABLE")

    def test_sensor_fault_injection_and_detection(self):
        """Injected isolated spike and stuck values must be flagged by reliability subsystem."""
        # 1. Spike
        df_spike, cfg = inject_sensor_fault(self.df, channel="temperature_C", fault_type="isolated_spike", start_index=50, severity=14.0)
        res_spike = assess_channel_reliability(df_spike["temperature_C"], "temperature_C")
        self.assertTrue(res_spike["temperature_C_is_spike"].iloc[50])

        # 2. Stuck
        df_stuck, cfg = inject_sensor_fault(self.df, channel="temperature_C", fault_type="stuck_sensor", start_index=80, duration=10)
        res_stuck = assess_channel_reliability(df_stuck["temperature_C"], "temperature_C", stuck_window=6)
        self.assertTrue(res_stuck["temperature_C_is_stuck"].iloc[86])

    def test_context_baseline_computation(self):
        """Context baseline must compute rolling median and robust z-score without lookahead."""
        df_ctx = compute_contextual_baselines(self.df, rolling_window=12)
        self.assertIn("temperature_C_expected_diurnal", df_ctx.columns)
        self.assertIn("temperature_C_robust_zscore", df_ctx.columns)
        # For clean data, robust z-score should largely be within [-3, 3]
        max_abs_z = df_ctx["temperature_C_robust_zscore"].abs().max()
        self.assertLess(max_abs_z, 4.0)

    def test_three_methods_comparison(self):
        """Compare Methods A, B, and C on test data."""
        df_comp, summary = compare_all_methods(self.df)
        self.assertIn("method_a", summary)
        self.assertIn("method_b", summary)
        self.assertIn("method_c", summary)
        # On normal data, Method C should have low anomaly rate
        self.assertLessEqual(summary["method_c"]["anomaly_rate_pct"], 10.0)

    def test_evaluation_metrics_ground_truth(self):
        """Benchmark metrics should accurately report TP, FP, Precision, Recall, and delay."""
        sim_df, cfg = inject_sensor_fault(self.df, channel="temperature_C", fault_type="isolated_spike", start_index=100, severity=15.0)
        bench = benchmark_methods_on_simulation(sim_df)
        m_c = bench["methods"]["Method C (Proposed Framework)"]
        self.assertTrue(m_c["available"])
        self.assertIn("precision", m_c)
        self.assertIn("recall", m_c)
        self.assertIn("far_per_24h", m_c)

    def test_experiment_registry_persistence(self):
        """Experiments must be saved and retrievable."""
        exp = save_experiment(
            dataset_id="test_suite_run",
            algorithm_name="Method C Unit Test",
            parameters={"z_thresh": 2.2},
            metrics={"precision": 1.0, "recall": 1.0, "f1_score": 1.0},
        )
        self.assertTrue(exp["experiment_id"].startswith("EXP_"))
        loaded = load_experiments()
        self.assertTrue(any(e["experiment_id"] == exp["experiment_id"] for e in loaded))


if __name__ == "__main__":
    unittest.main()
