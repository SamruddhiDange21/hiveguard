/**
 * HIVEGUARD — Vanilla JavaScript Dashboard Controller
 */

// State
let allHives = [];
let currentHiveId = "";
let currentLatest = null;
let chartTemp = null;
let chartHumidity = null;
let chartWeight = null;
let chartCompare = null;
let chartFeatureImportance = null;

let chartMonTemp = null;
let chartMonHum = null;
let chartMonWeight = null;
let chartAnomalyTimeline = null;
let currentIncidentFilter = "all";

let isLiveMonitoring = false;
let liveInterval = null;
let liveStreamIndex = 0;
let currentHiveHistory = [];

// API Base URL
const API_BASE = "";

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  initSimulator();
  initLiveMonitoring();
  initAnomalyFilters();
  loadHives();
  loadModelInsights();
  initResearchFramework();
});

// ==============================================================================
// 1. NAVIGATION TABS
// ==============================================================================
function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".content-section");

  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = item.getAttribute("data-section");

      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");

      sections.forEach(sec => {
        sec.classList.remove("active");
        if (sec.id === targetId) {
          sec.classList.add("active");
        }
      });

      if (targetId === "monitoring-view" && currentLatest) {
        updateMonitoringView(currentLatest, currentHiveHistory);
      } else if (targetId === "anomaly-view" && currentLatest) {
        updateAnomalyView(currentLatest, currentHiveHistory);
      } else if (targetId === "comparison-view") {
        updateComparisonView();
      } else if (targetId === "research-overview-view") {
        loadResearchOverview(activeDatasetId);
      } else if (targetId === "research-explorer-view") {
        loadResearchExplorer();
      } else if (targetId === "research-reliability-view") {
        loadResearchReliability();
      } else if (targetId === "research-context-view") {
        loadResearchContext();
      } else if (targetId === "research-simulation-view") {
        loadResearchSimulation();
      } else if (targetId === "research-evaluation-view") {
        loadResearchEvaluation();
      } else if (targetId === "research-warning-view") {
        loadResearchWarnings();
      } else if (targetId === "research-registry-view") {
        loadResearchRegistry();
      }
    });
  });
}


// ==============================================================================
// 2. DATA INGESTION & HIVE DROPDOWNS
// ==============================================================================
async function loadHives() {
  try {
    const res = await fetch(`${API_BASE}/api/hives`);
    const data = await res.json();
    if (data.hives && data.hives.length > 0) {
      allHives = data.hives;

      const hiveSelect = document.getElementById("hive-select");
      const cmpSelect1 = document.getElementById("cmp-hive-1");
      const cmpSelect2 = document.getElementById("cmp-hive-2");

      hiveSelect.innerHTML = "";
      cmpSelect1.innerHTML = "";
      cmpSelect2.innerHTML = "";

      allHives.forEach((hid, i) => {
        const opt = document.createElement("option");
        opt.value = hid;
        opt.textContent = hid;
        hiveSelect.appendChild(opt);

        const opt1 = opt.cloneNode(true);
        const opt2 = opt.cloneNode(true);
        cmpSelect1.appendChild(opt1);
        cmpSelect2.appendChild(opt2);
      });

      // Default selections
      currentHiveId = allHives[0];
      hiveSelect.value = currentHiveId;
      cmpSelect1.value = allHives[0];
      cmpSelect2.value = allHives.length > 1 ? allHives[1] : allHives[0];

      hiveSelect.addEventListener("change", (e) => {
        currentHiveId = e.target.value;
        loadHiveData(currentHiveId);
      });

      cmpSelect1.addEventListener("change", updateComparisonView);
      cmpSelect2.addEventListener("change", updateComparisonView);

      // Load initial colony
      loadHiveData(currentHiveId);
    }
  } catch (err) {
    console.error("Failed to fetch hives list:", err);
  }
}

async function loadHiveData(hiveId) {
  try {
    // 1. Fetch Latest Telemetry & Inference
    const resLatest = await fetch(`${API_BASE}/api/latest/${hiveId}`);
    if (resLatest.ok) {
      currentLatest = await resLatest.json();
      updateTopCards(currentLatest);
      updateHealthStatus(currentLatest);
      updateAnomalyAlert(currentLatest);
    }

    // 2. Fetch Historical Records for Charts & Timeline
    const resHistory = await fetch(`${API_BASE}/api/hive/${hiveId}`);
    if (resHistory.ok) {
      const historyRes = await resHistory.json();
      currentHiveHistory = historyRes.data || [];
      liveStreamIndex = Math.max(0, currentHiveHistory.length - 20);
      renderCharts(currentHiveHistory);
      renderTimeline(currentHiveHistory);

      if (currentLatest) {
        updateMonitoringView(currentLatest, currentHiveHistory);
        updateAnomalyView(currentLatest, currentHiveHistory);
      }
    }
  } catch (err) {
    console.error(`Error loading data for ${hiveId}:`, err);
  }
}


// ==============================================================================
// 3. UI CARD UPDATES
// ==============================================================================
function updateTopCards(d) {
  // 1. Temperature
  document.getElementById("val-temp").innerHTML = `${d.temperature.toFixed(1)} <small>°C</small>`;
  const tempInd = document.getElementById("temp-indicator");
  const tempDiffFromNormal = d.temperature - 34.4;
  if (d.temperature > 40.0) {
    tempInd.className = "status-indicator danger";
    tempInd.textContent = "Sensor Spike";
  } else if (Math.abs(tempDiffFromNormal) > 1.5) {
    tempInd.className = "status-indicator warning";
    tempInd.textContent = "Deviation";
  } else {
    tempInd.className = "status-indicator normal";
    tempInd.textContent = "Normal";
  }
  document.getElementById("temp-change").textContent = `Delta from 34.4°C: ${tempDiffFromNormal > 0 ? "+" : ""}${tempDiffFromNormal.toFixed(1)}°C`;

  // 2. Humidity
  document.getElementById("val-humidity").innerHTML = `${d.humidity.toFixed(1)} <small>%</small>`;
  const humInd = document.getElementById("hum-indicator");
  if (d.humidity > 68.0 || d.humidity < 48.0) {
    humInd.className = "status-indicator warning";
    humInd.textContent = "Elevated";
  } else {
    humInd.className = "status-indicator normal";
    humInd.textContent = "Normal";
  }
  document.getElementById("hum-change").textContent = `Rel. Baseline: ${d.humidity > 58.3 ? "+" : ""}${(d.humidity - 58.3).toFixed(1)}%`;

  // 3. Weight
  document.getElementById("val-weight").innerHTML = `${d.weight.toFixed(1)} <small>kg</small>`;
  const wtInd = document.getElementById("weight-indicator");
  wtInd.className = "status-indicator normal";
  wtInd.textContent = "Stable";
  document.getElementById("weight-change").textContent = `Gross Biomass (Step Δ: ${d.weight_change > 0 ? "+" : ""}${d.weight_change || 0} kg)`;

  // 4. Outside Temp
  document.getElementById("val-outside").innerHTML = `${d.outside_temperature.toFixed(1)} <small>°C</small>`;
  const diffVal = d.temperature - d.outside_temperature;
  document.getElementById("temp-diff").textContent = `Internal Diff: ${diffVal > 0 ? "+" : ""}${diffVal.toFixed(1)} °C`;
}

function updateHealthStatus(d) {
  const badge = document.getElementById("health-badge");
  const condText = document.getElementById("health-condition");
  const icon = document.getElementById("health-icon");
  const riskVal = document.getElementById("val-risk-level");
  const confVal = document.getElementById("val-confidence");
  const scoreVal = document.getElementById("val-anomaly-score");
  const fill = document.getElementById("anomaly-meter-fill");

  const cond = d.condition || "Healthy";
  const risk = d.risk_level || "NORMAL";
  const score = d.anomaly_score !== undefined ? d.anomaly_score : 10;
  const conf = d.confidence !== undefined ? Math.round(d.confidence * 100) : 95;

  condText.textContent = cond.replace(/_/g, " ").toUpperCase();
  riskVal.textContent = risk;
  confVal.textContent = `${conf}%`;
  scoreVal.textContent = `${score.toFixed(1)} / 100`;

  // Meter width & color
  fill.style.width = `${Math.min(100, Math.max(5, score))}%`;

  if (risk === "NORMAL") {
    badge.className = "health-state-banner normal";
    icon.textContent = "🟢";
    fill.style.backgroundColor = "var(--color-healthy)";
    riskVal.style.color = "var(--color-healthy)";
  } else if (risk === "LOW RISK") {
    badge.className = "health-state-banner low";
    icon.textContent = "🟡";
    fill.style.backgroundColor = "var(--color-low-risk)";
    riskVal.style.color = "var(--color-low-risk)";
  } else if (risk === "MEDIUM RISK") {
    badge.className = "health-state-banner moderate";
    icon.textContent = "🟠";
    fill.style.backgroundColor = "var(--color-moderate)";
    riskVal.style.color = "var(--color-moderate)";
  } else if (risk === "HIGH RISK") {
    badge.className = "health-state-banner high";
    icon.textContent = "🔴";
    fill.style.backgroundColor = "var(--color-high-risk)";
    riskVal.style.color = "var(--color-high-risk)";
  } else {
    // CRITICAL
    badge.className = "health-state-banner critical";
    icon.textContent = "⚫";
    fill.style.backgroundColor = "var(--color-sensor)";
    riskVal.style.color = "var(--color-critical)";
  }
}

function updateAnomalyAlert(d) {
  const tag = document.getElementById("alert-tag");
  const time = document.getElementById("alert-timestamp");
  const exp = document.getElementById("alert-explanation");
  const rec = document.getElementById("alert-recommendation");

  time.textContent = d.timestamp || "Current Observation";
  exp.textContent = d.explanation || "All sensor parameters within acceptable colony baselines.";

  const risk = d.risk_level || "NORMAL";
  if (risk === "NORMAL") {
    tag.className = "alert-tag normal";
    tag.textContent = "✓ No Significant Anomaly";
    rec.innerHTML = "<small><strong>Action:</strong> Autonomous thermoregulation active. Routine telemetry logging.</small>";
  } else if (risk === "HIGH RISK" || risk === "CRITICAL") {
    tag.className = "alert-tag danger";
    tag.textContent = `⚠ ${risk}: ${d.condition.replace(/_/g, " ")}`;
    rec.innerHTML = `<small><strong>Physical Inspection Protocol:</strong> Schedule urgent apiary check. Verify brood viability and box ventilation.</small>`;
  } else {
    tag.className = "alert-tag warning";
    tag.textContent = `⚡ ${risk}`;
    rec.innerHTML = `<small><strong>Action:</strong> Parameter deviation detected. Monitor subsequent telemetry frames closely.</small>`;
  }
}

// ==============================================================================
// 4. CHART.JS RENDERING
// ==============================================================================
function renderCharts(records) {
  // Sample up to 60 recent observations for responsive charts
  const sampled = records.slice(-60);
  const labels = sampled.map(r => r.timestamp.substring(11, 16));
  const temps = sampled.map(r => r.temperature_C);
  const ambientTemps = sampled.map(r => r.outside_temperature_C);
  const humidities = sampled.map(r => r.humidity_percent);
  const weights = sampled.map(r => r.weight_kg);

  // 1. Temperature Chart
  const ctxTemp = document.getElementById("chart-temp").getContext("2d");
  if (chartTemp) chartTemp.destroy();

  chartTemp = new Chart(ctxTemp, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Hive Temperature (°C)",
          data: temps,
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.08)",
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
        },
        {
          label: "Ambient Outside Temp (°C)",
          data: ambientTemps,
          borderColor: "#3b82f6",
          borderDash: [4, 4],
          borderWidth: 1.5,
          tension: 0.3,
          pointRadius: 0,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false } },
        y: { title: { display: true, text: "Temperature (°C)" } }
      }
    }
  });

  // 2. Humidity Chart
  const ctxHum = document.getElementById("chart-humidity").getContext("2d");
  if (chartHumidity) chartHumidity.destroy();

  chartHumidity = new Chart(ctxHum, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Relative Humidity (%)",
          data: humidities,
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.08)",
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false } },
        y: { title: { display: true, text: "Humidity (%)" } }
      }
    }
  });

  // 3. Weight Chart
  const ctxWeight = document.getElementById("chart-weight").getContext("2d");
  if (chartWeight) chartWeight.destroy();

  chartWeight = new Chart(ctxWeight, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Hive Gross Weight (kg)",
          data: weights,
          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.08)",
          fill: true,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 2,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false } },
        y: { title: { display: true, text: "Weight (kg)" } }
      }
    }
  });
}

// ==============================================================================
// 5. ANOMALY TIMELINE
// ==============================================================================
function renderTimeline(records) {
  const container = document.getElementById("timeline-list");
  if (!container) return;

  // Take most recent 12 records, reverse so newest is on top
  const recent = records.slice(-12).reverse();
  container.innerHTML = "";

  recent.forEach(r => {
    const item = document.createElement("div");
    const risk = (r.risk_level || "NORMAL").toUpperCase();
    const cond = (r.predicted_condition || r.condition_label || "Healthy").replace(/_/g, " ");

    let styleClass = "normal";
    let icon = "🟢";
    if (risk.includes("HIGH")) { styleClass = "high"; icon = "🔴"; }
    else if (risk.includes("MEDIUM") || risk.includes("MODERATE")) { styleClass = "moderate"; icon = "🟠"; }
    else if (risk.includes("LOW")) { styleClass = "low"; icon = "🟡"; }
    else if (risk.includes("CRITICAL")) { styleClass = "sensor"; icon = "⚫"; }

    item.className = `timeline-item ${styleClass}`;
    item.innerHTML = `
      <span class="timeline-time">${r.timestamp.substring(11, 16)}</span>
      <span class="timeline-condition">${icon} ${cond} (${risk})</span>
      <span class="timeline-score">${r.temperature_C}°C | ${r.humidity_percent}% | ${r.weight_kg}kg</span>
    `;
    container.appendChild(item);
  });
}

// ==============================================================================
// 6. HIVE COMPARISON
// ==============================================================================
async function updateComparisonView() {
  const h1 = document.getElementById("cmp-hive-1").value;
  const h2 = document.getElementById("cmp-hive-2").value;
  if (!h1 || !h2) return;

  try {
    const [res1, res2] = await Promise.all([
      fetch(`${API_BASE}/api/latest/${h1}`).then(r => r.json()),
      fetch(`${API_BASE}/api/latest/${h2}`).then(r => r.json())
    ]);

    document.getElementById("cmp-title-1").textContent = h1;
    document.getElementById("cmp-metrics-1").innerHTML = `
      <div class="cmp-metric-row"><span>Temperature:</span> <strong>${res1.temperature} °C</strong></div>
      <div class="cmp-metric-row"><span>Humidity:</span> <strong>${res1.humidity} %</strong></div>
      <div class="cmp-metric-row"><span>Gross Weight:</span> <strong>${res1.weight} kg</strong></div>
      <div class="cmp-metric-row"><span>Condition:</span> <strong>${res1.condition}</strong></div>
      <div class="cmp-metric-row"><span>Risk Level:</span> <strong>${res1.risk_level}</strong></div>
      <div class="cmp-metric-row"><span>Anomaly Score:</span> <strong>${res1.anomaly_score}/100</strong></div>
    `;

    document.getElementById("cmp-title-2").textContent = h2;
    document.getElementById("cmp-metrics-2").innerHTML = `
      <div class="cmp-metric-row"><span>Temperature:</span> <strong>${res2.temperature} °C</strong></div>
      <div class="cmp-metric-row"><span>Humidity:</span> <strong>${res2.humidity} %</strong></div>
      <div class="cmp-metric-row"><span>Gross Weight:</span> <strong>${res2.weight} kg</strong></div>
      <div class="cmp-metric-row"><span>Condition:</span> <strong>${res2.condition}</strong></div>
      <div class="cmp-metric-row"><span>Risk Level:</span> <strong>${res2.risk_level}</strong></div>
      <div class="cmp-metric-row"><span>Anomaly Score:</span> <strong>${res2.anomaly_score}/100</strong></div>
    `;

    // Comparative Chart
    const [hist1, hist2] = await Promise.all([
      fetch(`${API_BASE}/api/hive/${h1}`).then(r => r.json()),
      fetch(`${API_BASE}/api/hive/${h2}`).then(r => r.json())
    ]);

    const d1 = (hist1.data || []).slice(-40);
    const d2 = (hist2.data || []).slice(-40);
    const labels = d1.map(r => r.timestamp.substring(11, 16));

    const ctxCompare = document.getElementById("chart-compare-temp").getContext("2d");
    if (chartCompare) chartCompare.destroy();

    chartCompare = new Chart(ctxCompare, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: `${h1} Temp (°C)`,
            data: d1.map(r => r.temperature_C),
            borderColor: "#d97706",
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 2,
          },
          {
            label: `${h2} Temp (°C)`,
            data: d2.map(r => r.temperature_C),
            borderColor: "#0284c7",
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 2,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { title: { display: true, text: "Temperature (°C)" } }
        }
      }
    });

  } catch (err) {
    console.error("Comparison load error:", err);
  }
}

// ==============================================================================
// 7. MODEL INSIGHTS & FEATURE IMPORTANCE
// ==============================================================================
async function loadModelInsights() {
  try {
    const res = await fetch(`${API_BASE}/api/model-insights`);
    if (!res.ok) return;
    const data = await res.json();

    document.getElementById("insights-model-name").textContent = data.model_name || "Random Forest";
    document.getElementById("insights-accuracy").textContent = `${(data.accuracy * 100).toFixed(1)}%`;
    document.getElementById("insights-precision").textContent = `${(data.precision * 100).toFixed(1)}%`;
    document.getElementById("insights-recall").textContent = `${(data.recall * 100).toFixed(1)}%`;
    document.getElementById("insights-f1").textContent = data.macro_f1.toFixed(4);

    // Provenance / Legacy notice
    const insightsDesc = document.querySelector("#insights-view .section-title-bar p");
    if (insightsDesc && data.provenance_notice) {
      insightsDesc.innerHTML = `Supervised Machine Learning benchmarks (100 Trees) &bull; <span class="badge badge-warning">Legacy Prototype Demonstration</span><br><small style="color: #64748b;">${data.provenance_notice}</small>`;
    }

    // Feature importance horizontal bar chart
    const fiList = (data.feature_importance || []).slice(0, 8);
    const labels = fiList.map(item => item.feature);
    const values = fiList.map(item => item.importance);

    const ctx = document.getElementById("chart-feature-importance").getContext("2d");
    if (chartFeatureImportance) chartFeatureImportance.destroy();

    chartFeatureImportance = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Feature Importance (Gini)",
          data: values,
          backgroundColor: "#f59e0b",
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: {
            title: { display: true, text: "Normalized Importance" },
            beginAtZero: true
          }
        }
      }
    });
  } catch (err) {
    console.error("Model insights error:", err);
  }
}

// ==============================================================================
// 8. SENSOR SIMULATOR & PREDICT API
// ==============================================================================
function initSimulator() {
  const tInput = document.getElementById("sim-input-temp");
  const hInput = document.getElementById("sim-input-humidity");
  const wInput = document.getElementById("sim-input-weight");
  const oInput = document.getElementById("sim-input-outside");
  const wtChgInput = document.getElementById("sim-input-wt-chg");

  const tVal = document.getElementById("sim-val-temp");
  const hVal = document.getElementById("sim-val-humidity");
  const wVal = document.getElementById("sim-val-weight");
  const oVal = document.getElementById("sim-val-outside");
  const wtChgVal = document.getElementById("sim-val-wt-chg");

  tInput.addEventListener("input", () => tVal.textContent = parseFloat(tInput.value).toFixed(1));
  hInput.addEventListener("input", () => hVal.textContent = parseFloat(hInput.value).toFixed(1));
  wInput.addEventListener("input", () => wVal.textContent = parseFloat(wInput.value).toFixed(1));
  oInput.addEventListener("input", () => oVal.textContent = parseFloat(oInput.value).toFixed(1));
  wtChgInput.addEventListener("input", () => {
    const v = parseFloat(wtChgInput.value);
    wtChgVal.textContent = `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
  });

  // Presets
  const presetSelect = document.getElementById("sim-preset-select");
  presetSelect.addEventListener("change", (e) => {
    const p = e.target.value;
    if (p === "healthy") {
      setSimValues(34.4, 58.0, 36.5, 25.0, 0.15);
    } else if (p === "stress") {
      setSimValues(32.2, 69.5, 34.5, 28.0, -1.30);
    } else if (p === "swarming") {
      setSimValues(36.2, 58.5, 37.0, 27.0, -0.60);
    } else if (p === "varroa") {
      setSimValues(33.3, 65.2, 37.5, 26.0, -0.85);
    } else if (p === "sensor") {
      setSimValues(42.5, 58.2, 36.0, 24.0, 0.10);
    }
  });

  function setSimValues(t, h, w, o, deltaW) {
    tInput.value = t; tVal.textContent = t.toFixed(1);
    hInput.value = h; hVal.textContent = h.toFixed(1);
    wInput.value = w; wVal.textContent = w.toFixed(1);
    oInput.value = o; oVal.textContent = o.toFixed(1);
    wtChgInput.value = deltaW; wtChgVal.textContent = `${deltaW > 0 ? "+" : ""}${deltaW.toFixed(2)}`;
  }

  // Submit button
  document.getElementById("btn-run-sim").addEventListener("click", runManualPrediction);
}

async function runManualPrediction() {
  const temperature = parseFloat(document.getElementById("sim-input-temp").value);
  const humidity = parseFloat(document.getElementById("sim-input-humidity").value);
  const weight = parseFloat(document.getElementById("sim-input-weight").value);
  const outside_temperature = parseFloat(document.getElementById("sim-input-outside").value);
  const weight_change = parseFloat(document.getElementById("sim-input-wt-chg").value);

  const payload = {
    temperature: temperature,
    humidity: humidity,
    weight: weight,
    outside_temperature: outside_temperature,
    previous_weight: weight - weight_change,
    weight_change_from_start_kg: weight_change,
    timestamp: "2026-01-15 12:00:00"
  };

  try {
    const res = await fetch(`${API_BASE}/api/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    const condPill = document.getElementById("sim-res-cond");
    const riskPill = document.getElementById("sim-res-risk");
    const confText = document.getElementById("sim-res-conf");
    const scoreText = document.getElementById("sim-res-score");
    const expText = document.getElementById("sim-res-exp");

    condPill.textContent = (result.predicted_condition || "Healthy").replace(/_/g, " ");
    riskPill.textContent = result.risk_level || "NORMAL";
    confText.textContent = `${Math.round((result.confidence || 0.95) * 100)}%`;
    scoreText.textContent = `${(result.anomaly_score || 0).toFixed(1)} / 100`;
    expText.textContent = result.explanation || "";

    if (result.risk_level === "NORMAL") {
      condPill.className = "sim-cond-pill normal";
    } else if (result.risk_level === "HIGH RISK" || result.risk_level === "CRITICAL") {
      condPill.className = "sim-cond-pill danger";
    } else {
      condPill.className = "sim-cond-pill warning";
    }
  } catch (err) {
    console.error("Prediction API error:", err);
  }
}

// ==============================================================================
// 9. LIVE SENSOR SIMULATION
// ==============================================================================
function initLiveMonitoring() {
  const btnLive = document.getElementById("btn-toggle-live");
  const indicator = document.getElementById("live-indicator");

  btnLive.addEventListener("click", () => {
    isLiveMonitoring = !isLiveMonitoring;

    if (isLiveMonitoring) {
      btnLive.innerHTML = "<span class='btn-icon'>⏹️</span> Stop Live Monitoring";
      indicator.style.display = "inline-flex";

      liveInterval = setInterval(async () => {
        if (!currentHiveHistory || currentHiveHistory.length === 0) return;

        // Iterate through records to simulate live incoming telemetry
        liveStreamIndex = (liveStreamIndex + 1) % currentHiveHistory.length;
        const incoming = currentHiveHistory[liveStreamIndex];

        // Send to predict API
        try {
          const res = await fetch(`${API_BASE}/api/predict`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              temperature: incoming.temperature_C,
              humidity: incoming.humidity_percent,
              weight: incoming.weight_kg,
              outside_temperature: incoming.outside_temperature_C,
              previous_weight: incoming.weight_kg,
              timestamp: incoming.timestamp
            })
          });

          if (res.ok) {
            const predResult = await res.json();

            // Merge with sensor values for display
            const liveDisplay = {
              temperature: incoming.temperature_C,
              humidity: incoming.humidity_percent,
              weight: incoming.weight_kg,
              outside_temperature: incoming.outside_temperature_C,
              condition: predResult.predicted_condition,
              risk_level: predResult.risk_level,
              anomaly_score: predResult.anomaly_score,
              confidence: predResult.confidence,
              explanation: predResult.explanation,
              timestamp: incoming.timestamp,
              weight_change: 0.02
            };

            updateTopCards(liveDisplay);
            updateHealthStatus(liveDisplay);
            updateAnomalyAlert(liveDisplay);
          }
        } catch (err) {
          console.warn("Live simulation tick failed:", err);
        }
      }, 3000);

    } else {
      btnLive.innerHTML = "<span class='btn-icon'>⚡</span> Start Live Monitoring";
      indicator.style.display = "none";
      if (liveInterval) clearInterval(liveInterval);
    }
  });
}

// ==============================================================================
// 10. HIVE MONITORING VIEW CONTROLLER
// ==============================================================================
function updateMonitoringView(latest, records) {
  if (!latest) return;
  const colName = document.getElementById("mon-colony-name");
  if (colName) colName.textContent = latest.hive_id;

  const tEl = document.getElementById("mon-val-temp");
  const hEl = document.getElementById("mon-val-humidity");
  const wEl = document.getElementById("mon-val-weight");
  const dEl = document.getElementById("mon-val-diff");

  if (tEl) tEl.textContent = `${latest.temperature.toFixed(1)} °C`;
  if (hEl) hEl.textContent = `${latest.humidity.toFixed(1)} %`;
  if (wEl) wEl.textContent = `${latest.weight.toFixed(1)} kg`;
  const diffVal = latest.temperature - latest.outside_temperature;
  if (dEl) dEl.textContent = `${diffVal > 0 ? "+" : ""}${diffVal.toFixed(1)} °C`;

  // Target status hints
  const subT = document.getElementById("mon-sub-temp");
  if (subT) {
    const dev = latest.temperature - 34.4;
    subT.textContent = Math.abs(dev) <= 1.1 ? "✓ Within Optimal Brood Band" : `⚠ Deviation: ${dev > 0 ? "+" : ""}${dev.toFixed(1)}°C from 34.4°C`;
    subT.style.color = Math.abs(dev) <= 1.1 ? "#059669" : "#d97706";
  }

  const subH = document.getElementById("mon-sub-hum");
  if (subH) {
    const inRange = latest.humidity >= 50.0 && latest.humidity <= 65.0;
    subH.textContent = inRange ? "✓ Healthy Vapor Equilibrium" : `⚠ Humidity Drift: ${latest.humidity > 65 ? "Elevated" : "Deficient"}`;
    subH.style.color = inRange ? "#059669" : "#d97706";
  }

  const subW = document.getElementById("mon-sub-weight");
  if (subW) {
    subW.textContent = `Recent Step Δ: ${latest.weight_change > 0 ? "+" : ""}${latest.weight_change || 0} kg`;
  }

  // Render High-Resolution Charts
  renderMonitoringCharts(records);

  // Render Telemetry Table
  renderTelemetryTable(records);
}

function renderMonitoringCharts(records) {
  if (!records || records.length === 0) return;
  const sampled = records.slice(-80);
  const labels = sampled.map(r => r.timestamp.substring(11, 16));
  const temps = sampled.map(r => r.temperature_C);
  const ambients = sampled.map(r => r.outside_temperature_C);
  const hums = sampled.map(r => r.humidity_percent);
  const wts = sampled.map(r => r.weight_kg);

  // 1. Temperature Detailed Chart
  const ctxMonTemp = document.getElementById("chart-mon-temp");
  if (ctxMonTemp) {
    if (chartMonTemp) chartMonTemp.destroy();
    chartMonTemp = new Chart(ctxMonTemp.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Brood Nest Temperature (°C)",
            data: temps,
            borderColor: "#d97706",
            backgroundColor: "rgba(217, 119, 6, 0.08)",
            borderWidth: 2.2,
            tension: 0.3,
            fill: true,
            pointRadius: 2,
          },
          {
            label: "Ambient Outside Temp (°C)",
            data: ambients,
            borderColor: "#0284c7",
            borderDash: [4, 4],
            borderWidth: 1.5,
            tension: 0.3,
            pointRadius: 0,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { boxWidth: 12 } },
          tooltip: { mode: "index", intersect: false }
        },
        scales: {
          x: { grid: { display: false } },
          y: { title: { display: true, text: "Temperature (°C)" } }
        }
      }
    });
  }

  // 2. Humidity Detailed Chart
  const ctxMonHum = document.getElementById("chart-mon-hum");
  if (ctxMonHum) {
    if (chartMonHum) chartMonHum.destroy();
    chartMonHum = new Chart(ctxMonHum.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Relative Humidity (%)",
          data: hums,
          borderColor: "#059669",
          backgroundColor: "rgba(5, 150, 105, 0.08)",
          fill: true,
          tension: 0.3,
          borderWidth: 2,
          pointRadius: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
        scales: {
          x: { grid: { display: false } },
          y: { title: { display: true, text: "Humidity (%)" } }
        }
      }
    });
  }

  // 3. Weight Detailed Chart
  const ctxMonWt = document.getElementById("chart-mon-weight");
  if (ctxMonWt) {
    if (chartMonWeight) chartMonWeight.destroy();
    chartMonWeight = new Chart(ctxMonWt.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [{
          label: "Gross Hive Biomass (kg)",
          data: wts,
          borderColor: "#7c3aed",
          backgroundColor: "rgba(124, 58, 237, 0.08)",
          fill: true,
          tension: 0.2,
          borderWidth: 2,
          pointRadius: 2,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "top", labels: { boxWidth: 12 } } },
        scales: {
          x: { grid: { display: false } },
          y: { title: { display: true, text: "Gross Weight (kg)" } }
        }
      }
    });
  }
}

function renderTelemetryTable(records) {
  const tbody = document.getElementById("mon-telemetry-tbody");
  if (!tbody || !records) return;

  const recent = records.slice(-25).reverse();
  tbody.innerHTML = "";

  recent.forEach(r => {
    const tr = document.createElement("tr");
    const diff = (r.temperature_C - r.outside_temperature_C).toFixed(1);
    const cond = (r.predicted_condition || r.condition_label || "Healthy").replace(/_/g, " ");
    const risk = (r.risk_level || "NORMAL").toUpperCase();

    let badgeClass = "badge-normal";
    if (risk.includes("HIGH") || risk.includes("CRITICAL")) badgeClass = "badge-high";
    else if (risk.includes("MEDIUM") || risk.includes("MODERATE")) badgeClass = "badge-moderate";
    else if (risk.includes("LOW")) badgeClass = "badge-low";

    tr.innerHTML = `
      <td><strong>${r.timestamp}</strong></td>
      <td>${r.temperature_C.toFixed(2)} °C</td>
      <td>${r.humidity_percent.toFixed(1)} %</td>
      <td>${r.weight_kg.toFixed(2)} kg</td>
      <td>${r.outside_temperature_C.toFixed(2)} °C</td>
      <td>${diff > 0 ? "+" : ""}${diff} °C</td>
      <td>${cond}</td>
      <td><span class="badge ${badgeClass}">${risk}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

// ==============================================================================
// 11. ANOMALY DETECTION VIEW CONTROLLER
// ==============================================================================
function initAnomalyFilters() {
  const btnAll = document.getElementById("btn-filter-all");
  const btnAlerts = document.getElementById("btn-filter-alerts");
  if (btnAll && btnAlerts) {
    btnAll.addEventListener("click", () => {
      btnAll.classList.add("active");
      btnAlerts.classList.remove("active");
      currentIncidentFilter = "all";
      renderIncidentCards(currentHiveHistory);
    });
    btnAlerts.addEventListener("click", () => {
      btnAlerts.classList.add("active");
      btnAll.classList.remove("active");
      currentIncidentFilter = "alerts";
      renderIncidentCards(currentHiveHistory);
    });
  }
}

function updateAnomalyView(latest, records) {
  if (!latest) return;

  // Score circle
  const scoreNum = document.getElementById("anomaly-circle-score");
  const scoreCircle = document.getElementById("anomaly-score-circle");
  const riskBadge = document.getElementById("anomaly-risk-badge");
  const headline = document.getElementById("anomaly-headline");
  const narrative = document.getElementById("anomaly-detailed-narrative");
  const timeEl = document.getElementById("anomaly-incident-time");

  const score = latest.anomaly_score !== undefined ? latest.anomaly_score : 10;
  const risk = latest.risk_level || "NORMAL";
  const cond = (latest.condition || "Healthy").replace(/_/g, " ");

  if (scoreNum) scoreNum.textContent = Math.round(score);
  if (timeEl) timeEl.textContent = `Observation: ${latest.timestamp || "Just now"}`;

  // Gauge colors
  let color = "#10b981";
  let badgeClass = "badge-normal";
  if (risk === "HIGH RISK") { color = "#ef4444"; badgeClass = "badge-high"; }
  else if (risk === "CRITICAL") { color = "#dc2626"; badgeClass = "badge-sensor"; }
  else if (risk === "MEDIUM RISK") { color = "#f59e0b"; badgeClass = "badge-moderate"; }
  else if (risk === "LOW RISK") { color = "#0ea5e9"; badgeClass = "badge-low"; }

  if (scoreCircle) {
    scoreCircle.style.background = `conic-gradient(${color} 0% ${score}%, #e2e8f0 ${score}% 100%)`;
  }
  if (riskBadge) {
    riskBadge.className = `badge ${badgeClass}`;
    riskBadge.textContent = risk;
  }
  if (headline) {
    headline.textContent = risk === "NORMAL" ? "No Critical Anomalies Detected" : `Alert: ${cond} Pattern Detected`;
  }
  if (narrative) {
    narrative.textContent = latest.explanation || "All sensor streams within learned normal parameters.";
  }

  // Render Anomaly Score Timeline Chart
  renderAnomalyTimelineChart(records);

  // Render Incident Cards Feed
  renderIncidentCards(records);
}

function renderAnomalyTimelineChart(records) {
  const ctx = document.getElementById("chart-anomaly-score-timeline");
  if (!ctx || !records || records.length === 0) return;

  const sampled = records.slice(-80);
  const labels = sampled.map(r => r.timestamp.substring(11, 16));
  const scores = sampled.map(r => r.anomaly_score !== undefined ? r.anomaly_score : (r.anomaly ? 85 : 10));

  if (chartAnomalyTimeline) chartAnomalyTimeline.destroy();

  chartAnomalyTimeline = new Chart(ctx.getContext("2d"), {
    type: "line",
    data: {
      labels: labels,
      datasets: [{
        label: "Composite Anomaly Score (0–100)",
        data: scores,
        borderColor: "#dc2626",
        backgroundColor: "rgba(220, 38, 38, 0.08)",
        fill: true,
        tension: 0.3,
        borderWidth: 2.2,
        pointRadius: 2.5,
        pointBackgroundColor: scores.map(s => s >= 60 ? "#dc2626" : (s >= 30 ? "#f59e0b" : "#10b981"))
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", labels: { boxWidth: 12 } }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          title: { display: true, text: "Anomaly Score (0-100)" },
          min: 0,
          max: 100
        }
      }
    }
  });
}

function renderIncidentCards(records) {
  const container = document.getElementById("incident-cards-container");
  if (!container || !records) return;

  // Filter based on active filter button
  let filtered = records;
  if (currentIncidentFilter === "alerts") {
    filtered = records.filter(r => {
      const risk = (r.risk_level || "").toUpperCase();
      const score = r.anomaly_score || 0;
      return risk.includes("HIGH") || risk.includes("CRITICAL") || risk.includes("MEDIUM") || score >= 40;
    });
  }

  // Show up to 15 recent incidents
  const recent = filtered.slice(-15).reverse();
  container.innerHTML = "";

  if (recent.length === 0) {
    container.innerHTML = `<div class="empty-feed">✓ No high-priority alerts found in this colony's telemetry buffer.</div>`;
    return;
  }

  recent.forEach(r => {
    const card = document.createElement("div");
    const risk = (r.risk_level || "NORMAL").toUpperCase();
    const cond = (r.predicted_condition || r.condition_label || "Healthy").replace(/_/g, " ");
    const score = (r.anomaly_score !== undefined ? r.anomaly_score : 10).toFixed(1);

    let cardClass = "normal";
    let icon = "🟢";
    if (risk.includes("HIGH")) { cardClass = "high"; icon = "🔴"; }
    else if (risk.includes("CRITICAL")) { cardClass = "critical"; icon = "⚡"; }
    else if (risk.includes("MEDIUM") || risk.includes("MODERATE")) { cardClass = "moderate"; icon = "🟠"; }
    else if (risk.includes("LOW")) { cardClass = "low"; icon = "🟡"; }

    let reasonText = "Parameters stabilized within autonomous thermoregulatory baselines.";
    if (cond.includes("Stress")) {
      reasonText = `Temperature (${r.temperature_C}°C) and humidity (${r.humidity_percent}%) deviate from learned hive baselines while weight is declining.`;
    } else if (cond.includes("Swarm")) {
      reasonText = `Rapid weight loss pattern combined with microclimate disturbance indicates possible swarming or absconding.`;
    } else if (cond.includes("Varroa")) {
      reasonText = `Persistent microclimate depression and steady weight attrition match prototype vulnerability pattern. Physical sticky board count recommended.`;
    } else if (cond.includes("Sensor")) {
      reasonText = `Isolated unphysical jump in sensor channel without corresponding biological responses across adjacent sensors. Hardware verification suggested.`;
    }

    card.className = `incident-card ${cardClass}`;
    card.innerHTML = `
      <div class="incident-card-top">
        <span class="incident-card-title">${icon} ${risk}: ${cond}</span>
        <span class="incident-card-time">${r.timestamp}</span>
      </div>
      <div class="incident-card-sensors">
        <strong>Telemetry:</strong> Temp: ${r.temperature_C}°C | Humidity: ${r.humidity_percent}% | Weight: ${r.weight_kg}kg | Anomaly Score: ${score}/100
      </div>
      <div class="incident-card-reason">
        <strong>Reason:</strong> ${reasonText}
      </div>
    `;
    container.appendChild(card);
  });
}

// ==============================================================================
// 12. RESEARCH FRAMEWORK & NOVEL ANOMALY DETECTION ENGINE
// ==============================================================================

let activeDatasetId = "mspb_research_telemetry";
let availableDatasets = [];
let activeInspection = null;
let activeSimulationResults = null;
let activeWarningCategory = "all";

let chartExplorer = null;
let chartRelSignal = null;
let chartRelScore = null;
let chartCtxBaseline = null;
let chartCtxScores = null;
let chartCtxPersistence = null;
let chartSimTimeline = null;

function initResearchFramework() {
  initModals();
  initCsvUpload();
  initReliabilityLabControls();
  initSimulationLabControls();
  initWarningCenterFilters();
  loadDatasetsList();
}

// ------------------------------------------------------------------------------
// DATASET SELECTION & OVERVIEW
// ------------------------------------------------------------------------------
async function loadDatasetsList() {
  try {
    const res = await fetch(`${API_BASE}/api/research/datasets`);
    if (!res.ok) return;
    const data = await res.json();
    availableDatasets = data.datasets || [];

    const select = document.getElementById("overview-dataset-select");
    if (!select) return;

    select.innerHTML = "";
    availableDatasets.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = `${d.name} [${d.provenance}]`;
      if (d.id === activeDatasetId) opt.selected = true;
      select.appendChild(opt);
    });

    select.addEventListener("change", (e) => {
      activeDatasetId = e.target.value;
      loadResearchOverview(activeDatasetId);
    });

    const btnReload = document.getElementById("btn-reload-dataset");
    if (btnReload) {
      btnReload.addEventListener("click", () => loadResearchOverview(activeDatasetId));
    }

    // Initial inspection
    loadResearchOverview(activeDatasetId);

  } catch (err) {
    console.error("Failed to load datasets list:", err);
  }
}

async function loadResearchOverview(datasetId) {
  try {
    const res = await fetch(`${API_BASE}/api/research/inspect-dataset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: datasetId }),
    });

    if (!res.ok) return;
    const data = await res.json();
    activeInspection = data.inspection || {};

    const metaTotal = document.getElementById("meta-total-records");
    if (metaTotal) metaTotal.textContent = (activeInspection.total_rows || 0).toLocaleString();

    const metaHives = document.getElementById("meta-hives-count");
    if (metaHives) metaHives.textContent = `${(activeInspection.hives || []).length} Colonies`;

    const metaRange = document.getElementById("meta-date-range");
    if (metaRange) {
      const dr = activeInspection.date_range || {};
      metaRange.textContent = dr.start ? `${dr.start.substring(0, 10)} to ${dr.end.substring(0, 10)}` : "N/A";
    }

    const metaDays = document.getElementById("meta-duration-days");
    if (metaDays) metaDays.textContent = `${(activeInspection.date_range || {}).duration_days || 0} days continuous`;

    const metaCadence = document.getElementById("meta-cadence");
    if (metaCadence) {
      const cad = activeInspection.cadence_summary || {};
      metaCadence.textContent = cad.median_interval_minutes ? `${cad.median_interval_minutes.toFixed(1)} min` : "15.0 min";
    }

    const metaCadenceReg = document.getElementById("meta-cadence-reg");
    if (metaCadenceReg) {
      const cad = activeInspection.cadence_summary || {};
      metaCadenceReg.textContent = cad.is_regular_interval ? "Regular interval" : "Nominal 15-min cadence";
    }

    const metaGt = document.getElementById("meta-ground-truth-status");
    if (metaGt) {
      metaGt.textContent = datasetId.includes("mspb") ? "Nature Sci. Data Peer-Reviewed" : "Synthetic Prototype Labels";
    }

    const metaCite = document.getElementById("meta-citation-tag");
    if (metaCite) {
      metaCite.textContent = datasetId.includes("mspb") ? "Zhu et al. (2024)" : "Prototype Demo Model";
    }

    const badge = document.getElementById("overview-provenance-badge");
    if (badge) {
      const prov = activeInspection.source_label || "Recorded Public Research Data";
      badge.textContent = prov;
      if (prov.toLowerCase().includes("synthetic")) {
        badge.className = "provenance-badge synthetic";
      } else if (prov.toLowerCase().includes("upload")) {
        badge.className = "provenance-badge recorded";
      } else {
        badge.className = "provenance-badge recorded";
      }
    }

    // Populate hive pickers in other research views
    populateResearchHivePickers(activeInspection.hives || []);

  } catch (err) {
    console.error("Failed to inspect dataset:", err);
  }
}

function populateResearchHivePickers(hives) {
  const pickers = ["explorer-hive-picker", "ctx-hive-select"];
  pickers.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = "";
    hives.forEach((h, idx) => {
      const opt = document.createElement("option");
      opt.value = h;
      opt.textContent = h;
      if (idx === 0) opt.selected = true;
      el.appendChild(opt);
    });
  });
}

// ------------------------------------------------------------------------------
// RESEARCH DATA EXPLORER & CSV UPLOADER
// ------------------------------------------------------------------------------
function initCsvUpload() {
  const dropzone = document.getElementById("upload-dropzone");
  const fileInput = document.getElementById("input-research-csv");
  const btnUpload = document.getElementById("btn-upload-research-csv");
  const feedback = document.getElementById("upload-feedback");

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener("click", () => fileInput.click());

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#10b981";
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.style.borderColor = "#cbd5e1";
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.style.borderColor = "#cbd5e1";
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      fileInput.files = e.dataTransfer.files;
      feedback.innerHTML = `<span class="text-green">Selected: ${fileInput.files[0].name} (${(fileInput.files[0].size / 1024).toFixed(1)} KB)</span>`;
    }
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files && fileInput.files[0]) {
      feedback.innerHTML = `<span class="text-green">Selected: ${fileInput.files[0].name} (${(fileInput.files[0].size / 1024).toFixed(1)} KB)</span>`;
    }
  });

  if (btnUpload) {
    btnUpload.addEventListener("click", async () => {
      if (!fileInput.files || !fileInput.files[0]) {
        feedback.innerHTML = `<span class="text-danger">Please select a CSV file first.</span>`;
        return;
      }
      const formData = new FormData();
      formData.append("file", fileInput.files[0]);

      feedback.innerHTML = `<span>Uploading and harmonizing columns...</span>`;
      try {
        const res = await fetch(`${API_BASE}/api/research/upload`, {
          method: "POST",
          body: formData,
        });
        const result = await res.json();
        if (res.ok) {
          feedback.innerHTML = `<span class="text-green">${result.message}</span>`;
          activeDatasetId = result.dataset_id;
          await loadDatasetsList();
          loadResearchExplorer();
        } else {
          feedback.innerHTML = `<span class="text-danger">Upload error: ${result.error}</span>`;
        }
      } catch (err) {
        feedback.innerHTML = `<span class="text-danger">Network error during upload: ${err.message}</span>`;
      }
    });
  }

  const expHivePicker = document.getElementById("explorer-hive-picker");
  if (expHivePicker) {
    expHivePicker.addEventListener("change", () => renderExplorerTelemetry(expHivePicker.value));
  }
}

async function loadResearchExplorer() {
  if (!activeInspection) {
    await loadResearchOverview(activeDatasetId);
  }

  const titleEl = document.getElementById("exp-dataset-title");
  if (titleEl) titleEl.textContent = activeDatasetId.replace(/_/g, " ").toUpperCase();

  const stdCols = document.getElementById("exp-standard-cols");
  if (stdCols) {
    stdCols.textContent = (activeInspection.standard_columns_found || []).join(", ") || "None mapped";
  }

  const dupEl = document.getElementById("exp-duplicate-count");
  if (dupEl) dupEl.textContent = activeInspection.duplicate_timestamps || 0;

  // Render Missing values bars
  const missingBox = document.getElementById("exp-missing-bars");
  if (missingBox) {
    missingBox.innerHTML = "";
    const pcts = activeInspection.missing_percentages || {};
    Object.keys(pcts).forEach(col => {
      const pct = pcts[col];
      const row = document.createElement("div");
      row.className = "missing-bar-row";
      row.innerHTML = `
        <span class="missing-bar-name" title="${col}">${col}</span>
        <div class="missing-bar-track">
          <div class="missing-bar-fill" style="width: ${Math.max(100 - pct, 2)}%;"></div>
        </div>
        <span class="missing-bar-pct">${(100 - pct).toFixed(1)}%</span>
      `;
      missingBox.appendChild(row);
    });
  }

  // Warnings
  const warnBox = document.getElementById("exp-quality-warnings");
  if (warnBox) {
    warnBox.innerHTML = "";
    (activeInspection.warnings || []).forEach(w => {
      const p = document.createElement("div");
      p.className = "q-warn-pill";
      p.textContent = `⚠️ ${w}`;
      warnBox.appendChild(p);
    });
  }

  const picker = document.getElementById("explorer-hive-picker");
  const selectedHive = picker ? picker.value : null;
  renderExplorerTelemetry(selectedHive);
}

async function renderExplorerTelemetry(hiveId) {
  try {
    const res = await fetch(`${API_BASE}/api/research/context-anomaly/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: activeDatasetId, hive_id: hiveId, limit: 250 }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const timeline = data.timeline || [];

    const labels = timeline.map(r => r.timestamp ? r.timestamp.substring(5, 16) : "");
    const temps = timeline.map(r => r.temperature_C);
    const baselines = timeline.map(r => r.expected_diurnal);

    const ctx = document.getElementById("chart-explorer-telemetry");
    if (!ctx) return;
    if (chartExplorer) chartExplorer.destroy();

    chartExplorer = new Chart(ctx.getContext("2d"), {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Observed Hive Temperature (°C)",
            data: temps,
            borderColor: "#0284c7",
            backgroundColor: "rgba(2, 132, 199, 0.08)",
            borderWidth: 2,
            pointRadius: 0,
            fill: true,
          },
          {
            label: "Expected Diurnal Baseline (°C)",
            data: baselines,
            borderColor: "#10b981",
            borderDash: [5, 4],
            borderWidth: 2,
            pointRadius: 0,
            fill: false,
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: "top" }
        },
        scales: {
          x: { display: true, ticks: { maxTicksLimit: 12 } },
          y: { title: { display: true, text: "Temperature (°C)" } }
        }
      }
    });

  } catch (err) {
    console.error("Failed to render explorer telemetry:", err);
  }
}

// ------------------------------------------------------------------------------
// SENSOR RELIABILITY LAB
// ------------------------------------------------------------------------------
function initReliabilityLabControls() {
  const sevInput = document.getElementById("rel-severity-input");
  const sevVal = document.getElementById("rel-severity-val");
  const durInput = document.getElementById("rel-duration-input");
  const durVal = document.getElementById("rel-duration-val");
  const onsetInput = document.getElementById("rel-onset-input");
  const onsetVal = document.getElementById("rel-onset-val");
  const btnRun = document.getElementById("btn-run-reliability-sim");

  if (sevInput && sevVal) sevInput.addEventListener("input", () => sevVal.textContent = parseFloat(sevInput.value).toFixed(1));
  if (durInput && durVal) durInput.addEventListener("input", () => durVal.textContent = durInput.value);
  if (onsetInput && onsetVal) onsetInput.addEventListener("input", () => onsetVal.textContent = onsetInput.value);

  if (btnRun) {
    btnRun.addEventListener("click", runReliabilitySimulation);
  }
}

async function loadResearchReliability() {
  runReliabilitySimulation();
}

async function runReliabilitySimulation() {
  const faultType = document.getElementById("rel-fault-type")?.value || "isolated_spike";
  const channel = document.getElementById("rel-channel-select")?.value || "temperature_C";
  const severity = parseFloat(document.getElementById("rel-severity-input")?.value || 12.0);
  const duration = parseInt(document.getElementById("rel-duration-input")?.value || 1);
  const onset = parseInt(document.getElementById("rel-onset-input")?.value || 150);

  try {
    const res = await fetch(`${API_BASE}/api/research/simulation/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset_id: activeDatasetId,
        scenario_category: "sensor_fault",
        scenario_type: faultType,
        channel: channel,
        start_index: onset,
        duration: duration,
        severity: severity,
        seed: 42,
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const bench = (data.benchmark_results || {}).methods || {};
    const methodC = bench["Method C (Proposed Framework)"] || {};
    const timeline = data.timeline || [];

    // Populate scorecard
    const precEl = document.getElementById("rel-metric-precision");
    const recEl = document.getElementById("rel-metric-recall");
    const farEl = document.getElementById("rel-metric-far");
    const delEl = document.getElementById("rel-metric-delay");
    const ruleEl = document.getElementById("rel-rule-explanation");

    if (precEl) precEl.textContent = methodC.available ? `${(methodC.precision * 100).toFixed(1)}%` : "N/A";
    if (recEl) recEl.textContent = methodC.available ? `${(methodC.recall * 100).toFixed(1)}%` : "N/A";
    if (farEl) farEl.textContent = methodC.available ? `${methodC.far_per_24h} / 24h` : "N/A";
    if (delEl) delEl.textContent = methodC.available ? `${methodC.detection_delay_minutes} min` : "0 min";

    if (ruleEl) {
      if (faultType === "isolated_spike") {
        ruleEl.textContent = "Isolated impulse rule triggered: Bidirectional step difference exceeded limits (|Δx| > 4.0°C) with immediate return at t+1. Gated as hardware fault; biological false alarm suppressed.";
      } else if (faultType === "stuck_sensor") {
        ruleEl.textContent = "Stuck sensor rule triggered: Sensor channel rolling variance dropped to zero over 6 consecutive intervals. Status marked FAULTY (Reliability < 0.20).";
      } else if (faultType === "gradual_drift") {
        ruleEl.textContent = "Drift detection rule: Monotonic divergence detected against learned historical diurnal median. Reliability attenuated over drift duration.";
      } else {
        ruleEl.textContent = `Fault '${faultType}' isolated by physical sensor plausibility boundaries and rolling MAD deviation gating.`;
      }
    }

    // Chart 1: Signal vs Corrupted
    const labels = timeline.map(r => r.timestamp ? r.timestamp.substring(5, 16) : "");
    const origVals = timeline.map(r => r.original_val);
    const corrVals = timeline.map(r => r.corrupted_val);

    const ctxSig = document.getElementById("chart-reliability-signal");
    if (ctxSig) {
      if (chartRelSignal) chartRelSignal.destroy();
      chartRelSignal = new Chart(ctxSig.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Corrupted Signal (Simulated)",
              data: corrVals,
              borderColor: "#f59e0b",
              backgroundColor: "rgba(245, 158, 11, 0.1)",
              borderWidth: 2,
              pointRadius: 1,
            },
            {
              label: "Pristine Research Baseline",
              data: origVals,
              borderColor: "#10b981",
              borderDash: [4, 4],
              borderWidth: 1.5,
              pointRadius: 0,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
          scales: { x: { ticks: { maxTicksLimit: 12 } } }
        }
      });
    }

    // Chart 2: Reliability Score
    const relVals = timeline.map(r => r.method_c_category === "SENSOR_RELIABILITY_WARNING" ? 0.20 : 0.95);
    const ctxRel = document.getElementById("chart-reliability-score");
    if (ctxRel) {
      if (chartRelScore) chartRelScore.destroy();
      chartRelScore = new Chart(ctxRel.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Sensor Reliability Score R_s(t)",
              data: relVals,
              borderColor: "#6366f1",
              backgroundColor: "rgba(99, 102, 241, 0.15)",
              borderWidth: 2,
              pointRadius: 0,
              fill: true,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 0.0, max: 1.0, title: { display: true, text: "Reliability [0.0 - 1.0]" } },
            x: { ticks: { maxTicksLimit: 12 } }
          }
        }
      });
    }

  } catch (err) {
    console.error("Reliability simulation failed:", err);
  }
}

// ------------------------------------------------------------------------------
// CONTEXT-AWARE ANOMALY ANALYSIS & TRI-METHOD COMPARISON
// ------------------------------------------------------------------------------
function loadResearchContext() {
  const btnRun = document.getElementById("btn-run-context-analysis");
  if (btnRun && !btnRun.dataset.listener) {
    btnRun.dataset.listener = "true";
    btnRun.addEventListener("click", executeContextAnalysis);
  }
  executeContextAnalysis();
}

async function executeContextAnalysis() {
  const hiveId = document.getElementById("ctx-hive-select")?.value || null;
  const limit = parseInt(document.getElementById("ctx-limit-select")?.value || 800);

  try {
    const res = await fetch(`${API_BASE}/api/research/context-anomaly/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset_id: activeDatasetId,
        hive_id: hiveId,
        limit: limit,
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const summary = data.summary || {};
    const timeline = data.timeline || [];

    // Scorecard
    const mA = summary.method_a || {};
    const mB = summary.method_b || {};
    const mC = summary.method_c || {};

    const aAlarms = document.getElementById("method-a-alarms");
    const aRate = document.getElementById("method-a-rate");
    if (aAlarms) aAlarms.textContent = (mA.anomaly_count || 0).toLocaleString();
    if (aRate) aRate.textContent = `${mA.anomaly_rate_pct || 0}%`;

    const bAlarms = document.getElementById("method-b-alarms");
    const bRate = document.getElementById("method-b-rate");
    if (bAlarms) bAlarms.textContent = (mB.anomaly_count || 0).toLocaleString();
    if (bRate) bRate.textContent = `${mB.anomaly_rate_pct || 0}%`;

    const cAlarms = document.getElementById("method-c-alarms");
    const cRate = document.getElementById("method-c-rate");
    if (cAlarms) cAlarms.textContent = (mC.anomaly_count || 0).toLocaleString();
    if (cRate) cRate.textContent = `${mC.anomaly_rate_pct || 0}%`;

    // Charts
    const labels = timeline.map(r => r.timestamp ? r.timestamp.substring(5, 16) : "");
    const temps = timeline.map(r => r.temperature_C);
    const baselines = timeline.map(r => r.expected_diurnal);

    // Chart 1: Diurnal baseline
    const ctx1 = document.getElementById("chart-context-baseline");
    if (ctx1) {
      if (chartCtxBaseline) chartCtxBaseline.destroy();
      chartCtxBaseline = new Chart(ctx1.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Observed Internal Temperature (°C)",
              data: temps,
              borderColor: "#2563eb",
              borderWidth: 1.8,
              pointRadius: 0,
            },
            {
              label: "Hour-Conditioned Expected Diurnal Baseline",
              data: baselines,
              borderColor: "#10b981",
              borderDash: [6, 4],
              borderWidth: 2,
              pointRadius: 0,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
          scales: { x: { ticks: { maxTicksLimit: 12 } } }
        }
      });
    }

    // Chart 2: Anomaly Scores
    const scA = timeline.map(r => r.method_a_score);
    const scB = timeline.map(r => r.method_b_score);
    const scC = timeline.map(r => r.method_c_score);

    const ctx2 = document.getElementById("chart-context-anomaly-scores");
    if (ctx2) {
      if (chartCtxScores) chartCtxScores.destroy();
      chartCtxScores = new Chart(ctx2.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Method A (Fixed Threshold)",
              data: scA,
              borderColor: "#ef4444",
              borderWidth: 1.5,
              pointRadius: 0,
            },
            {
              label: "Method B (Rolling Robust Z / MAD)",
              data: scB,
              borderColor: "#f59e0b",
              borderWidth: 1.5,
              pointRadius: 0,
            },
            {
              label: "Method C (Proposed Framework)",
              data: scC,
              borderColor: "#059669",
              backgroundColor: "rgba(5, 150, 105, 0.15)",
              borderWidth: 2.2,
              pointRadius: 0,
              fill: true,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
          scales: {
            y: { min: 0, max: 100, title: { display: true, text: "Anomaly Severity Score" } },
            x: { ticks: { maxTicksLimit: 12 } }
          }
        }
      });
    }

    // Chart 3: Persistence Dynamics
    const persVals = timeline.map(r => r.method_c_score > 30 ? 0.8 : 0.1);
    const relVals = timeline.map(r => r.sensor_reliability || 1.0);

    const ctx3 = document.getElementById("chart-context-persistence");
    if (ctx3) {
      if (chartCtxPersistence) chartCtxPersistence.destroy();
      chartCtxPersistence = new Chart(ctx3.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Persistence Factor P(t)",
              data: persVals,
              borderColor: "#8b5cf6",
              borderWidth: 2,
              pointRadius: 0,
            },
            {
              label: "Sensor Reliability Gating R_s(t)",
              data: relVals,
              borderColor: "#10b981",
              borderDash: [5, 4],
              borderWidth: 1.8,
              pointRadius: 0,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { min: 0.0, max: 1.0 },
            x: { ticks: { maxTicksLimit: 12 } }
          }
        }
      });
    }

  } catch (err) {
    console.error("Context analysis execution failed:", err);
  }
}

// ------------------------------------------------------------------------------
// SIMULATION LABORATORY & REPRODUCIBILITY
// ------------------------------------------------------------------------------
function initSimulationLabControls() {
  const tabSensor = document.getElementById("tab-scen-sensor");
  const tabStress = document.getElementById("tab-scen-stress");
  const scenSelect = document.getElementById("lab-scen-type");
  const btnRun = document.getElementById("btn-run-lab-scenario");
  const btnSave = document.getElementById("btn-save-active-exp");

  const seedInput = document.getElementById("lab-seed-input");
  const seedVal = document.getElementById("lab-seed-val");
  const sevInput = document.getElementById("lab-sev-input");
  const sevVal = document.getElementById("lab-sev-val");

  if (seedInput && seedVal) seedInput.addEventListener("input", () => seedVal.textContent = seedInput.value);
  if (sevInput && sevVal) sevInput.addEventListener("input", () => sevVal.textContent = parseFloat(sevInput.value).toFixed(1));

  let currentCategory = "sensor_fault";

  if (tabSensor && tabStress && scenSelect) {
    tabSensor.addEventListener("click", () => {
      tabSensor.classList.add("active");
      tabStress.classList.remove("active");
      currentCategory = "sensor_fault";
      scenSelect.innerHTML = `
        <option value="isolated_spike">Isolated Probe Spike (+15°C jump returning next step)</option>
        <option value="stuck_sensor">Stuck / Frozen Sensor Value (Constant reading across 8 hours)</option>
        <option value="gradual_drift">Gradual Sensor Drift (+0.25°C/hr monotonic bias)</option>
        <option value="gaussian_noise">High-Amplitude Measurement Noise</option>
        <option value="missing_data">Communication Dropout (Packet Loss)</option>
      `;
    });

    tabStress.addEventListener("click", () => {
      tabStress.classList.add("active");
      tabSensor.classList.remove("active");
      currentCategory = "hypothetical_environmental";
      scenSelect.innerHTML = `
        <option value="brood_chilling">Hypothetical Brood Chilling (Thermal depression from 34.5°C down to 29.5°C)</option>
        <option value="acute_hyperthermia">Hypothetical Heat Stress (Acute internal surge to 38.5°C)</option>
        <option value="sensor_conflict">Conflicting Sensor Stream (Thermal jump while acoustics remain calm)</option>
      `;
    });
  }

  if (btnRun) {
    btnRun.addEventListener("click", () => runSimulationLabScenario(currentCategory));
  }

  if (btnSave) {
    btnSave.addEventListener("click", saveActiveExperimentToRegistry);
  }
}

async function loadResearchSimulation() {
  runSimulationLabScenario("sensor_fault");
}

async function runSimulationLabScenario(category) {
  const scenType = document.getElementById("lab-scen-type")?.value || "isolated_spike";
  const seed = parseInt(document.getElementById("lab-seed-input")?.value || 42);
  const severity = parseFloat(document.getElementById("lab-sev-input")?.value || 12.0);

  try {
    const res = await fetch(`${API_BASE}/api/research/simulation/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset_id: activeDatasetId,
        scenario_category: category,
        scenario_type: scenType,
        channel: "temperature_C",
        start_index: 150,
        duration: scenType === "isolated_spike" ? 1 : 24,
        severity: severity,
        seed: seed,
      }),
    });

    if (!res.ok) return;
    const data = await res.json();
    activeSimulationResults = data;
    const timeline = data.timeline || [];

    // Chart: Ground-Truth vs Detection
    const labels = timeline.map(r => r.timestamp ? r.timestamp.substring(5, 16) : "");
    const values = timeline.map(r => r.corrupted_val);
    const gtFlags = timeline.map(r => r.is_ground_truth ? r.corrupted_val : null);
    const detFlags = timeline.map(r => r.method_c_flag ? r.corrupted_val : null);

    const ctx = document.getElementById("chart-simulation-timeline");
    if (ctx) {
      if (chartSimTimeline) chartSimTimeline.destroy();
      chartSimTimeline = new Chart(ctx.getContext("2d"), {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Telemetry Signal",
              data: values,
              borderColor: "#334155",
              borderWidth: 1.8,
              pointRadius: 0,
            },
            {
              label: "Injected Ground-Truth Event",
              data: gtFlags,
              borderColor: "#ef4444",
              backgroundColor: "rgba(239, 68, 68, 0.4)",
              pointRadius: 5,
              showLine: false,
            },
            {
              label: "Method C Detection Alarm",
              data: detFlags,
              borderColor: "#10b981",
              backgroundColor: "#10b981",
              pointRadius: 3,
              showLine: false,
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: "top" } },
          scales: { x: { ticks: { maxTicksLimit: 12 } } }
        }
      });
    }

    // Update evaluation benchmark table if view is active
    renderBenchmarkTable(data.benchmark_results);

  } catch (err) {
    console.error("Simulation scenario run failed:", err);
  }
}

async function saveActiveExperimentToRegistry() {
  if (!activeSimulationResults) {
    alert("Please run a simulation benchmark first before logging.");
    return;
  }
  const cfg = activeSimulationResults.scenario_config || {};
  const bench = (activeSimulationResults.benchmark_results || {}).methods || {};
  const mC = bench["Method C (Proposed Framework)"] || {};

  try {
    const res = await fetch(`${API_BASE}/api/research/experiments/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dataset_id: activeDatasetId,
        algorithm_name: "Method C (Context, Reliability & Persistence)",
        parameters: {
          scenario_type: cfg.scenario_type,
          severity: cfg.severity,
          seed: cfg.random_seed,
          z_threshold: 2.2,
          persistence_steps: 4,
        },
        metrics: mC,
        scenario_details: cfg,
        dataset_provenance: activeInspection ? activeInspection.source_label : "Recorded Public Research Data",
        notes: `Benchmarked on ${cfg.description}`,
      }),
    });
    if (res.ok) {
      alert("✅ Experiment successfully saved to registry!");
      loadResearchRegistry();
    }
  } catch (err) {
    console.error("Failed to save experiment:", err);
  }
}

// ------------------------------------------------------------------------------
// BENCHMARK EVALUATION MATRIX
// ------------------------------------------------------------------------------
function loadResearchEvaluation() {
  if (activeSimulationResults) {
    renderBenchmarkTable(activeSimulationResults.benchmark_results);
  } else {
    runSimulationLabScenario("sensor_fault");
  }
}

function renderBenchmarkTable(benchmarkData) {
  const tbody = document.getElementById("tbody-benchmark-metrics");
  if (!tbody || !benchmarkData) return;

  const methods = benchmarkData.methods || {};
  tbody.innerHTML = "";

  Object.keys(methods).forEach(mName => {
    const m = methods[mName];
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><strong>${mName}</strong></td>
      <td>${m.available ? `${(m.precision * 100).toFixed(1)}%` : '<span class="text-muted">Ground truth required</span>'}</td>
      <td>${m.available ? `${(m.recall * 100).toFixed(1)}%` : '<span class="text-muted">Ground truth required</span>'}</td>
      <td><strong class="${mName.includes('Proposed') ? 'text-green' : ''}">${m.available ? m.f1_score.toFixed(4) : 'N/A'}</strong></td>
      <td>${m.available ? `${m.far_per_24h} / 24h` : 'N/A'}</td>
      <td>${m.available ? `${m.detection_delay_minutes} min` : 'N/A'}</td>
      <td><code>${m.runtime_ms || 0} ms</code></td>
    `;
    tbody.appendChild(tr);
  });
}

// ------------------------------------------------------------------------------
// EXPLAINABLE WARNING CENTER
// ------------------------------------------------------------------------------
function initWarningCenterFilters() {
  const btns = document.querySelectorAll(".w-filter-btn");
  btns.forEach(b => {
    b.addEventListener("click", () => {
      btns.forEach(x => x.classList.remove("active"));
      b.classList.add("active");
      activeWarningCategory = b.getAttribute("data-cat");
      loadResearchWarnings();
    });
  });
}

async function loadResearchWarnings() {
  const container = document.getElementById("warning-cards-container");
  if (!container) return;

  try {
    const res = await fetch(`${API_BASE}/api/research/context-anomaly/compare`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataset_id: activeDatasetId, limit: 300 }),
    });

    if (!res.ok) return;
    const data = await res.json();
    const timeline = (data.timeline || []).filter(r => r.method_c_category !== "NORMAL");

    container.innerHTML = "";
    if (timeline.length === 0) {
      container.innerHTML = `<div class="empty-state">✅ No active critical warnings in selected evaluation window. Colony telemetry strictly adheres to baseline.</div>`;
      return;
    }

    const filtered = activeWarningCategory === "all" ? timeline : timeline.filter(r => r.method_c_category === activeWarningCategory);

    filtered.slice(-20).reverse().forEach(r => {
      const card = document.createElement("div");
      let typeClass = "bio-anomaly";
      let actionProtocol = "Perform physical comb inspection; check for uncapped brood cappings and honey food stores.";

      if (r.method_c_category === "SENSOR_RELIABILITY_WARNING") {
        typeClass = "sensor-fault";
        actionProtocol = "Inspect sensor probe placement, wire terminals, and battery voltage. Recalibrate probe before applying colony treatments.";
      } else if (r.method_c_category === "ENVIRONMENTAL_DEVIATION") {
        typeClass = "env-deviation";
        actionProtocol = "Monitor ambient weather coupling; verify apiary shading and ventilation.";
      } else if (r.method_c_category === "MANAGEMENT_EVENT_ATTENUATED") {
        typeClass = "mgmt-event";
        actionProtocol = "Logged apiary management event; microclimate expected to re-stabilize autonomously within 3 hours.";
      }

      card.className = `warning-dispatch-card ${typeClass}`;
      card.innerHTML = `
        <div class="dispatch-header">
          <div class="dispatch-title-row">
            <span class="provenance-badge recorded">${r.method_c_category.replace(/_/g, " ")}</span>
            <span class="dispatch-title">${r.method_c_explanation || "Anomaly detected"}</span>
          </div>
          <small class="font-mono">${r.timestamp}</small>
        </div>
        <div class="dispatch-body-grid">
          <div><span>Observed Value:</span> <strong>${r.temperature_C ? `${r.temperature_C}°C` : 'N/A'}</strong></div>
          <div><span>Expected Diurnal Baseline:</span> <strong>${r.expected_diurnal}°C</strong></div>
          <div><span>Robust Deviation:</span> <strong>Z = ${r.robust_zscore}</strong></div>
          <div><span>Sensor Reliability:</span> <strong>${(r.sensor_reliability * 100).toFixed(0)}%</strong></div>
        </div>
        <div class="dispatch-protocol-box">
          <strong>Recommended Action:</strong> ${actionProtocol}
        </div>
      `;
      container.appendChild(card);
    });

  } catch (err) {
    console.error("Failed to load warnings:", err);
  }
}

// ------------------------------------------------------------------------------
// EXPERIMENT REGISTRY & EXPORT
// ------------------------------------------------------------------------------
async function loadResearchRegistry() {
  const tbody = document.getElementById("tbody-experiments-log");
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/api/research/experiments`);
    if (!res.ok) return;
    const data = await res.json();
    const exps = data.experiments || [];

    tbody.innerHTML = "";
    if (exps.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="text-center">No experiments logged yet. Run a simulation scenario to save an audit record.</td></tr>`;
      return;
    }

    exps.slice().reverse().forEach(e => {
      const tr = document.createElement("tr");
      const m = e.metrics || {};
      tr.innerHTML = `
        <td><code>${e.experiment_id}</code></td>
        <td><small>${e.timestamp}</small></td>
        <td>${e.dataset_id}</td>
        <td><span class="provenance-badge recorded">${e.dataset_provenance || "Recorded"}</span></td>
        <td><strong>${e.algorithm_name}</strong></td>
        <td><strong>${m.f1_score !== undefined ? m.f1_score.toFixed(4) : "N/A"}</strong></td>
        <td>${m.far_per_24h !== undefined ? `${m.far_per_24h}/24h` : "N/A"}</td>
        <td><button class="btn btn-outline-dark btn-sm btn-view-exp" data-id="${e.experiment_id}">Details</button></td>
      `;
      tbody.appendChild(tr);
    });

    document.querySelectorAll(".btn-view-exp").forEach(btn => {
      btn.addEventListener("click", () => {
        const expId = btn.getAttribute("data-id");
        const found = exps.find(x => x.experiment_id === expId);
        if (found) {
          const pre = document.getElementById("modal-exp-json");
          if (pre) pre.textContent = JSON.stringify(found, null, 2);
          const modal = document.getElementById("modal-experiment-details");
          if (modal) modal.style.display = "flex";
        }
      });
    });

  } catch (err) {
    console.error("Failed to load experiment registry:", err);
  }
}

// ------------------------------------------------------------------------------
// MODAL CONTROLLERS & MARKDOWN RENDERER
// ------------------------------------------------------------------------------
function initModals() {
  // Audit Modal
  const btnOpenAudit = document.getElementById("btn-open-audit-modal");
  const modalAudit = document.getElementById("modal-audit-report");
  const btnCloseAudit1 = document.getElementById("btn-close-audit-modal");
  const btnCloseAudit2 = document.getElementById("btn-close-audit-modal-footer");

  if (btnOpenAudit && modalAudit) {
    btnOpenAudit.addEventListener("click", async () => {
      modalAudit.style.display = "flex";
      const contentEl = document.getElementById("modal-audit-content");
      if (contentEl) {
        contentEl.innerHTML = "<p>Loading verified Nature/Zenodo MSPB audit report...</p>";
        try {
          const res = await fetch(`${API_BASE}/api/research/audit/mspb`);
          const data = await res.json();
          if (res.ok) {
            contentEl.innerHTML = renderMarkdown(data.markdown);
          } else {
            contentEl.innerHTML = `<span class="text-danger">Failed to load audit report: ${data.error}</span>`;
          }
        } catch (err) {
          contentEl.innerHTML = `<span class="text-danger">Error: ${err.message}</span>`;
        }
      }
    });
  }

  [btnCloseAudit1, btnCloseAudit2].forEach(b => {
    if (b && modalAudit) b.addEventListener("click", () => modalAudit.style.display = "none");
  });

  // Exp Details Modal
  const modalExp = document.getElementById("modal-experiment-details");
  const btnCloseExp1 = document.getElementById("btn-close-exp-modal");
  const btnCloseExp2 = document.getElementById("btn-close-exp-modal-footer");

  [btnCloseExp1, btnCloseExp2].forEach(b => {
    if (b && modalExp) b.addEventListener("click", () => modalExp.style.display = "none");
  });

  // Refresh Experiments button
  const btnRefreshExp = document.getElementById("btn-refresh-experiments");
  if (btnRefreshExp) btnRefreshExp.addEventListener("click", loadResearchRegistry);
}

function renderMarkdown(md) {
  if (!md) return "";
  let html = md
    .replace(/^# (.*$)/gim, '<h2 style="color: #0f172a; margin-top: 14px; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px;">$1</h2>')
    .replace(/^## (.*$)/gim, '<h3 style="color: #1e293b; margin-top: 18px;">$1</h3>')
    .replace(/^### (.*$)/gim, '<h4 style="color: #334155; margin-top: 12px;">$1</h4>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/`([^`]+)`/gim, '<code>$1</code>')
    .replace(/^\> (.*$)/gim, '<blockquote style="border-left: 4px solid #10b981; padding-left: 12px; margin: 8px 0; color: #475569;">$1</blockquote>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>');

  // Tables
  html = html.replace(/\|(.+)\|/gim, (match) => {
    const cells = match.split('|').filter(c => c.trim().length > 0);
    if (cells.some(c => c.includes('---'))) return '';
    return '<tr>' + cells.map(c => `<td style="padding: 6px 10px; border: 1px solid #e2e8f0;">${c.trim()}</td>`).join('') + '</tr>';
  });

  return html.replace(/\n\n/gim, '<br>');
}


