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

