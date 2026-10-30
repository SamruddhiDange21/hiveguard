"""Generate publication-ready audit figures illustrating experiment findings and discrepancies."""
import os
from pathlib import Path
import matplotlib
os.environ["MPLCONFIGDIR"] = "/tmp/matplotlib_hiveguard_cache"
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
OUTPUT_DIR = PROJECT_ROOT / "experiments" / "audit_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 1. Figure: Multi-Seed FAR Reduction Distribution
rep_df = pd.read_csv(OUTPUT_DIR / "multi_seed_replication_20runs.csv")

fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

# Plot 1: FAR comparison
bars = ax1.bar(
    ["Method A (Fixed)", "Method B (Rolling MAD)", "Method C (HIVEGUARD)"],
    [rep_df["method_a_far"].mean(), rep_df["method_b_far"].mean(), rep_df["method_c_far"].mean()],
    yerr=[rep_df["method_a_far"].std(), rep_df["method_b_far"].std(), rep_df["method_c_far"].std()],
    capsize=5,
    color=["#e74c3c", "#f39c12", "#27ae60"],
    edgecolor="black",
    alpha=0.85,
)
ax1.set_ylabel("False Alarm Rate (alarms / 24h)", fontsize=11, fontweight="bold")
ax1.set_title("Operational False Alarm Rate (20 Monte Carlo Trials)", fontsize=12, fontweight="bold")
ax1.grid(axis="y", linestyle="--", alpha=0.5)

for bar in bars:
    yval = bar.get_height()
    ax1.text(bar.get_x() + bar.get_width()/2.0, yval + 1.5, f"{yval:.2f}", ha="center", va="bottom", fontweight="bold")

# Plot 2: Percentage Reduction
ax2.hist(rep_df["far_reduction_pct"], bins=10, color="#2980b9", edgecolor="black", alpha=0.8)
ax2.axvline(rep_df["far_reduction_pct"].mean(), color="red", linestyle="--", linewidth=2, label=f"Mean: {rep_df['far_reduction_pct'].mean():.2f}%")
ax2.set_xlabel("False Alarm Reduction vs Method A (%)", fontsize=11, fontweight="bold")
ax2.set_ylabel("Frequency", fontsize=11, fontweight="bold")
ax2.set_title("Distribution of FAR Reduction (Method C vs A)", fontsize=12, fontweight="bold")
ax2.legend(loc="upper left")
ax2.grid(True, linestyle="--", alpha=0.5)

plt.tight_layout()
plt.savefig(OUTPUT_DIR / "figure_audit_far_reduction_distribution.png", dpi=200)
plt.close()

# 2. Figure: Exp 1 Spike Detection and Categories
exp1_df = pd.read_csv(OUTPUT_DIR / "exp1_spike_raw_predictions.csv")

fig, ax = plt.subplots(figsize=(12, 4.5))
t = np.arange(len(exp1_df))
ax.plot(t, exp1_df["temp_corrupted"], label="Injected Telemetry (Temp °C)", color="#34495e", linewidth=1.2)
ax.plot(t, exp1_df["temp_original"], label="Raw MSPB Telemetry", color="#95a5a6", linestyle=":", alpha=0.7)

# Ground truth fault point
spike_idx = np.where(exp1_df["ground_truth_hw_fault"])[0][0]
ax.scatter([spike_idx], [exp1_df["temp_corrupted"].iloc[spike_idx]], color="#e74c3c", s=100, zorder=5, label="Injected +15°C Spike (HW Fault)")

# Method A False Alarms
fp_a = np.where(exp1_df["method_a_pred"] & (~exp1_df["ground_truth_hw_fault"]))[0]
ax.scatter(fp_a, exp1_df["temp_corrupted"].iloc[fp_a], color="#e67e22", s=15, alpha=0.4, label=f"Method A False Alarms (n={len(fp_a)})")

# Method C Detection
tp_c = np.where(exp1_df["method_c_hw_pred"] & exp1_df["ground_truth_hw_fault"])[0]
ax.scatter(tp_c, exp1_df["temp_corrupted"].iloc[tp_c], color="#27ae60", marker="x", s=120, linewidths=2.5, zorder=6, label="Method C Correct HW Flag")

ax.axhline(32.0, color="#c0392b", linestyle="--", alpha=0.5, label="Method A Bounds (32°C - 36°C)")
ax.axhline(36.0, color="#c0392b", linestyle="--", alpha=0.5)

ax.set_title("Experiment 1 Audit: Transmission Spike & False Alarm Mechanisms", fontsize=12, fontweight="bold")
ax.set_xlabel("Observation Timestep (15-min intervals)", fontsize=11, fontweight="bold")
ax.set_ylabel("Internal Hive Temperature (°C)", fontsize=11, fontweight="bold")
ax.legend(loc="upper right", fontsize=8.5, framealpha=0.9)
ax.grid(True, linestyle="--", alpha=0.5)

plt.tight_layout()
plt.savefig(OUTPUT_DIR / "figure_audit_exp1_spike_comparison.png", dpi=200)
plt.close()

# 3. Figure: Exp 2 Brood Chilling Misclassification Diagnostic
exp2_df = pd.read_csv(OUTPUT_DIR / "exp2_brood_chilling_raw_predictions.csv")

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 6), sharex=True)

ax1.plot(t, exp2_df["temp_corrupted"], label="Simulated Hive Temp (°C)", color="#2c3e50")
stress_idx = np.where(exp2_df["ground_truth_stress"])[0]
ax1.axvspan(stress_idx[0], stress_idx[-1], color="#3498db", alpha=0.25, label="Injected Brood Chilling Horizon (8 steps)")
ax1.set_ylabel("Temperature (°C)", fontweight="bold")
ax1.set_title("Experiment 2 Audit: Brood Chilling Stress & Classification Diagnostic", fontweight="bold")
ax1.legend(loc="upper right", fontsize=9)
ax1.grid(True, linestyle="--", alpha=0.5)

ax2.plot(t, exp2_df["method_c_score"], color="#8e44ad", label="Method C Composite Score S(t)")
ax2.axhline(50.0, color="red", linestyle="--", label="Alert Threshold (50.0)")
ax2.scatter(stress_idx, exp2_df["method_c_score"].iloc[stress_idx], color="#e74c3c", label="Score during stress")
ax2.set_xlabel("Observation Timestep", fontweight="bold")
ax2.set_ylabel("Composite Score S(t)", fontweight="bold")
ax2.legend(loc="upper right", fontsize=9)
ax2.grid(True, linestyle="--", alpha=0.5)

plt.tight_layout()
plt.savefig(OUTPUT_DIR / "figure_audit_exp2_brood_chilling_diagnostic.png", dpi=200)
plt.close()

print("Audit figures successfully generated in experiments/audit_results/.")
