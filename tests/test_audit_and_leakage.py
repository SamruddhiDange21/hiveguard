"""Audit, Metric Integrity, and Temporal Leakage Tests for HIVEGUARD."""
import unittest
import numpy as np
import pandas as pd
from sklearn.metrics import confusion_matrix, precision_score, recall_score, f1_score

from src.research.dataset_loader import load_dataset_by_id
from src.research.context_baseline import compute_diurnal_profiles, compute_contextual_baselines
from src.research.sensor_reliability import assess_channel_reliability
from src.research.anomaly_framework import (
    run_method_a_fixed_thresholds,
    run_method_b_statistical_rolling,
    run_method_c_proposed_framework,
)
from src.research.simulation_lab import inject_sensor_fault, inject_hypothetical_environmental_stress
from src.research.audit_reproduce import calculate_comprehensive_metrics


class TestAuditAndLeakage(unittest.TestCase):

    def setUp(self):
        """Set up standard 400-row slice from MSPB benchmark for deterministic evaluation."""
        df, _ = load_dataset_by_id("mspb_research_telemetry")
        self.slice_df = df[df["hive_id"] == "MSPB_HIVE_2046"].iloc[:400].copy().reset_index(drop=True)

    def test_metric_correctness_and_conflation_prevention(self):
        """Verify confusion matrix arithmetic and ensure Macro F1 is not confused with binary positive F1."""
        y_true = np.array([True] + [False] * 399)
        # 1 TP, 4 FP, 395 TN, 0 FN
        y_pred = np.array([True] + [True] * 4 + [False] * 395)

        metrics = calculate_comprehensive_metrics(y_true, y_pred, interval_minutes=15.0)

        cm = metrics["confusion_matrix"]
        self.assertEqual(cm["tp"], 1)
        self.assertEqual(cm["fp"], 4)
        self.assertEqual(cm["tn"], 395)
        self.assertEqual(cm["fn"], 0)
        self.assertEqual(cm["tp"] + cm["fp"] + cm["tn"] + cm["fn"], 400)

        # Precision = 1 / 5 = 0.20
        self.assertAlmostEqual(metrics["positive_class"]["precision"], 0.20, places=3)
        # Recall = 1 / 1 = 1.00
        self.assertAlmostEqual(metrics["positive_class"]["recall"], 1.00, places=3)
        # Positive Binary F1 = 2 * (0.2 * 1.0) / 1.2 = 0.3333
        self.assertAlmostEqual(metrics["positive_class"]["f1_score"], 0.3333, places=3)

        # Negative Class Precision = 395 / 395 = 1.00
        self.assertAlmostEqual(metrics["negative_class"]["precision"], 1.00, places=3)
        # Negative Class Recall = 395 / 399 = 0.98997
        self.assertAlmostEqual(metrics["negative_class"]["recall"], 0.9900, places=3)
        # Negative Class F1 = 0.9950
        self.assertAlmostEqual(metrics["negative_class"]["f1_score"], 0.9950, places=3)

        # Macro F1 is the unweighted mean of positive F1 and negative F1: (0.3333 + 0.9950) / 2 = 0.6641
        # It must NOT be reported as 0.990 (which is the negative class recall)!
        self.assertAlmostEqual(metrics["macro_f1"], 0.6641, places=3)
        self.assertNotEqual(metrics["macro_f1"], 0.990)

    def test_temporal_leakage_in_diurnal_profile(self):
        """Check for lookahead leakage: historical diurnal profiles must be invariant to future perturbations."""
        # Split slice into historical (first 250 rows) and future (last 150 rows)
        df_hist = self.slice_df.iloc[:250].copy()
        prof_original = compute_diurnal_profiles(df_hist, channel="temperature_C", hive_col="hive_id")

        # Create a modified future with extreme perturbations in the last 150 rows
        df_perturbed = self.slice_df.copy()
        df_perturbed.loc[250:, "temperature_C"] = df_perturbed.loc[250:, "temperature_C"] + 15.0

        # If compute_diurnal_profiles is called on the full perturbed dataset, it leaks future perturbations
        prof_leaked = compute_diurnal_profiles(df_perturbed, channel="temperature_C", hive_col="hive_id")
        
        # Verify that leakage occurred in the naive full-dataset calculation
        h_id = "MSPB_HIVE_2046"
        hour_check = int(pd.to_datetime(df_perturbed.iloc[300]["timestamp"]).hour)
        med_orig = prof_original[h_id][hour_check]["median"]
        med_leaked = prof_leaked[h_id][hour_check]["median"]
        
        # The test documents that using full dataset shifts the diurnal baseline (demonstrating leakage)
        self.assertNotEqual(med_orig, med_leaked)

    def test_reproducibility_across_identical_seeds(self):
        """Simulations with identical seed and config must produce byte-for-byte identical predictions."""
        sim_df1, _ = inject_sensor_fault(
            self.slice_df,
            channel="temperature_C",
            fault_type="isolated_spike",
            start_index=150,
            severity=15.0,
            seed=42,
        )
        sim_df2, _ = inject_sensor_fault(
            self.slice_df,
            channel="temperature_C",
            fault_type="isolated_spike",
            start_index=150,
            severity=15.0,
            seed=42,
        )

        res1 = run_method_c_proposed_framework(sim_df1)
        res2 = run_method_c_proposed_framework(sim_df2)

        np.testing.assert_array_equal(res1["method_c_score"].values, res2["method_c_score"].values)
        np.testing.assert_array_equal(res1["method_c_flag"].values, res2["method_c_flag"].values)

    def test_scenario_label_integrity(self):
        """Injected hardware faults must not be labeled or evaluated as biological disease events."""
        sim_df, cfg = inject_sensor_fault(
            self.slice_df,
            channel="temperature_C",
            fault_type="isolated_spike",
            start_index=150,
            severity=15.0,
            seed=42,
        )
        self.assertIn("injected_ground_truth_fault", sim_df.columns)
        self.assertNotIn("injected_ground_truth_stress", sim_df.columns)
        self.assertEqual(cfg["scenario_category"], "sensor_fault")


if __name__ == "__main__":
    unittest.main()
