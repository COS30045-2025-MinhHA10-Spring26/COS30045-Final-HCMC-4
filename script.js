const CHART_COLORS = {
  primary: "#38bdf8",
  primaryDim: "#0ea5e9",
  secondary: "#818cf8",
  accent: "#fb923c",
  green: "#34d399",
  red: "#f87171",
  yellow: "#fbbf24",
  grid: "#334155",
  text: "#94a3b8",
};

const JURISDICTION_COLORS = {
  NSW: "#38bdf8",
  VIC: "#818cf8",
  QLD: "#fb923c",
  WA: "#34d399",
  SA: "#fbbf24",
  TAS: "#f87171",
  ACT: "#a78bfa",
  NT: "#2dd4bf",
};

const METRIC_COLORS = {
  "Speeding fines": "#38bdf8",
  "Mobile phone use": "#818cf8",
  "Seatbelt non-compliance": "#fb923c",
  "Unlicensed driving": "#34d399",
};

const SUBSTANCE_COLORS = {
  cannabis: "#34d399",
  amphetamine: "#818cf8",
  methylamphetamine: "#fb923c",
  ecstasy: "#fbbf24",
  cocaine: "#f87171",
  other: "#94a3b8",
};

const state = {
  catalog: null,
  summaries: {},
  records: {},
  charts: [],
  filters: {
    yearStart: null,
    yearEnd: null,
    jurisdiction: "all",
    metric: "all",
    ageGroup: "all",
    detectionStage: "all",
  },
};

const app = document.getElementById("app");
const navLinks = document.getElementById("nav-links");

function init() {
  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("scroll", handleScrollSpy);
  loadCatalog().then(() => {
    renderNav();
    handleRoute();
  });
}

async function loadCatalog() {
  state.catalog = await fetchJson("./data/catalog.json");
  const readyDatasets = state.catalog.datasets.filter(
    (d) => d.status === "ready" || d.status === "reference"
  );
  await Promise.all(
    readyDatasets.map(async (dataset) => {
      if (dataset.summary_file) {
        state.summaries[dataset.key] = await fetchJson(
          `./data/${dataset.summary_file}`
        );
      }
      if (dataset.records_file) {
        state.records[dataset.key] = await fetchJson(
          `./data/${dataset.records_file}`
        );
      }
    })
  );
}

function renderNav() {
  navLinks.innerHTML = state.catalog.datasets
    .map(
      (d) =>
        `<a href="#/${d.key}" class="nav-link" data-key="${d.key}">${d.short_title}</a>`
    )
    .join("");
}

function handleRoute() {
  const hash = window.location.hash.replace("#", "") || "/";
  const parts = hash.split("/").filter(Boolean);
  const page = parts[0] || "";

  document.querySelectorAll(".nav-link").forEach((link) => {
    link.classList.toggle(
      "active",
      link.dataset.key === page || (page === "" && link.dataset.key === undefined)
    );
  });

  destroyCharts();

  state.filters = {
    yearStart: null,
    yearEnd: null,
    jurisdiction: "all",
    metric: "all",
    ageGroup: "all",
    detectionStage: "all",
  };

  if (!page || page === "/") {
    renderHome();
  } else if (page === "fines") {
    renderFinesPage();
  } else if (page === "breath-tests") {
    renderBreathTestsPage();
  } else if (page === "drug-tests") {
    renderDrugTestsPage();
  } else if (page === "about") {
    renderAboutPage();
  } else {
    app.innerHTML = `<div class="error-state"><h2>Page not found</h2><p><a href="#/">Go home</a></p></div>`;
  }

  window.scrollTo(0, 0);
}

function destroyCharts() {
  state.charts.forEach((c) => c.destroy());
  state.charts = [];
}

function handleScrollSpy() {
  const sections = document.querySelectorAll(".chart-section[id]");
  const tocLinks = document.querySelectorAll(".toc-link");
  if (!sections.length || !tocLinks.length) return;

  let activeId = "";
  sections.forEach((section) => {
    const rect = section.getBoundingClientRect();
    if (rect.top < 200) activeId = section.id;
  });

  tocLinks.forEach((link) => {
    link.classList.toggle("active", link.dataset.target === activeId);
  });
}

/* ========== UTILS ========== */
function fmt(n) {
  return new Intl.NumberFormat("en-AU").format(n);
}

function fmtCompact(n) {
  return new Intl.NumberFormat("en-AU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function pct(n, d) {
  if (!d) return "0%";
  return ((n / d) * 100).toFixed(1) + "%";
}

function fetchJson(path) {
  return fetch(path).then((r) => {
    if (!r.ok) throw new Error(`Failed to load ${path}`);
    return r.json();
  });
}

function createChart(el, config) {
  const ctx = el.getContext("2d");
  const chart = new Chart(ctx, config);
  state.charts.push(chart);
  return chart;
}

function chartDefaults(overrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600, easing: "easeOutQuart" },
    plugins: {
      legend: {
        labels: {
          color: CHART_COLORS.text,
          font: { size: 12 },
          boxWidth: 12,
          padding: 16,
        },
      },
      tooltip: {
        backgroundColor: "#1e293b",
        titleColor: "#f1f5f9",
        bodyColor: "#94a3b8",
        borderColor: "#334155",
        borderWidth: 1,
        cornerRadius: 6,
        padding: 10,
      },
    },
    scales: {
      x: {
        ticks: { color: CHART_COLORS.text, font: { size: 11 } },
        grid: { color: CHART_COLORS.grid, drawBorder: false },
      },
      y: {
        ticks: { color: CHART_COLORS.text, font: { size: 11 } },
        grid: { color: CHART_COLORS.grid, drawBorder: false },
      },
    },
    ...overrides,
  };
}

function renderHome() {
  const datasets = state.catalog.datasets.filter((d) => d.status === "ready");
  const aboutEntry = state.catalog.datasets.find((d) => d.key === "about");

  app.innerHTML = `
    <div class="home-header">
      <h1>Australian road safety enforcement data</h1>
      <p>Explore fines, breath tests, and drug tests from BITRE. Each dataset tells a different part of the story.</p>
    </div>
    <div class="dataset-grid">
      ${datasets
        .map(
          (d) => `
        <a href="#/${d.key}" class="dataset-card">
          <div class="dataset-card-icon" style="background:${d.color}22;color:${d.color}">
            ${getIcon(d.icon)}
          </div>
          <h3>${d.title}</h3>
          <p>${d.description}</p>
          <div class="dataset-card-meta">
            <span><span class="status-dot"></span> ${d.reference_period}</span>
            <span>${d.category}</span>
          </div>
        </a>
      `
        )
        .join("")}
      ${
        aboutEntry
          ? `
        <a href="#/about" class="dataset-card">
          <div class="dataset-card-icon" style="background:${aboutEntry.color}22;color:${aboutEntry.color}">
            ${getIcon(aboutEntry.icon)}
          </div>
          <h3>${aboutEntry.title}</h3>
          <p>${aboutEntry.description}</p>
          <div class="dataset-card-meta">
            <span>Methodology and sources</span>
          </div>
        </a>
      `
          : ""
      }
    </div>
  `;
}

function getIcon(type) {
  const icons = { fines: "⚡", breath: "🫁", drug: "💊", about: "ℹ" };
  return icons[type] || "📊";
}

/* ========== FINES PAGE ========== */
function renderFinesPage() {
  const summary = state.summaries.fines;
  const records = state.records.fines;
  if (!summary || !records) {
    app.innerHTML = `<div class="loading">Loading fines data…</div>`;
    return;
  }

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = ["all", ...summary.dimensions.jurisdictions];
  const metrics = [
    { key: "all", label: "All metrics" },
    { key: "speed_fines", label: "Speeding fines" },
    { key: "mobile_phone_use", label: "Mobile phone use" },
    { key: "non_wearing_seatbelts", label: "Seatbelt non-compliance" },
    { key: "unlicensed_driving", label: "Unlicensed driving" },
  ];

  const sections = [
    { id: "trend", title: "Enforcement over time" },
    { id: "metrics", title: "Offence breakdown" },
    { id: "jurisdictions", title: "By jurisdiction" },
    { id: "detection", title: "Detection methods" },
    { id: "comparison", title: "Offences compared" },
    { id: "heatmap", title: "Enforcement mix" },
  ];

  state.filters.yearStart = years[0];
  state.filters.yearEnd = summary.latest_year;

  const speedTotal = summary.aggregates.metric_totals.find(
    (m) => m.metric_key === "speed_fines"
  );
  const totalActions = summary.totals.total_actions;

  app.innerHTML = `
    <div class="dataset-page">
      <nav class="toc-sidebar">
        <h4>Sections</h4>
        ${sections.map((s) => `<a href="#${s.id}" class="toc-link" data-target="${s.id}">${s.title}</a>`).join("")}
      </nav>
      <div class="dataset-content">
        <div class="dynamic-header" id="dynamic-header">
          <h2>Speeding is fined <span class="stat-number">${fmtCompact(speedTotal.fines)}</span> times across the dataset</h2>
          <p>That's ${pct(speedTotal.total_actions, totalActions)} of all enforcement actions from ${summary.period_coverage.start.slice(0, 4)} to ${summary.period_coverage.end.slice(0, 4)}.</p>
        </div>
        <div class="filter-bar" id="filter-bar">
          <div class="filter-group">
            <label>From year</label>
            <select id="fines-year-start">${years.map((y) => `<option value="${y}">${y}</option>`).join("")}</select>
          </div>
          <div class="filter-group">
            <label>To year</label>
            <select id="fines-year-end">${years.map((y) => `<option value="${y}" ${y === summary.latest_year ? "selected" : ""}>${y}</option>`).join("")}</select>
          </div>
          <div class="filter-group">
            <label>Jurisdiction</label>
            <select id="fines-jurisdiction">${jurisdictions.map((j) => `<option value="${j}">${j === "all" ? "All" : j}</option>`).join("")}</select>
          </div>
          <div class="filter-group">
            <label>Metric</label>
            <select id="fines-metric">${metrics.map((m) => `<option value="${m.key}">${m.label}</option>`).join("")}</select>
          </div>
        </div>
        <div class="stat-row" id="stat-row"></div>
        <div class="chart-section" id="trend">
          <h3>Enforcement actions over time</h3>
          <p class="chart-desc">Annual total of fines, charges, and arrests. Note the reporting change in 2023 when monthly data became available.</p>
          <div class="chart-container"><canvas id="fines-trend"></canvas></div>
        </div>
        <div class="chart-section" id="metrics">
          <h3>Which offences dominate the record</h3>
          <p class="chart-desc">Total actions by metric across the selected period.</p>
          <div class="chart-container"><canvas id="fines-metrics"></canvas></div>
        </div>
        <div class="chart-section" id="jurisdictions">
          <h3>Enforcement by jurisdiction</h3>
          <p class="chart-desc">Annual totals for each state and territory.</p>
          <div class="chart-container"><canvas id="fines-jurisdictions"></canvas></div>
        </div>
        <div class="chart-section" id="detection">
          <h3>How offences are detected</h3>
          <p class="chart-desc">Camera-led versus police-issued fines. The detection method changes what the count really means.</p>
          <div class="chart-container"><canvas id="fines-detection"></canvas></div>
        </div>
        <div class="chart-section" id="comparison">
          <h3>Speeding versus other offences</h3>
          <p class="chart-desc">Annual comparison showing whether speeding growth tracks with mobile phone or seatbelt enforcement.</p>
          <div class="chart-container"><canvas id="fines-comparison"></canvas></div>
        </div>
        <div class="chart-section" id="heatmap">
          <h3>Jurisdiction enforcement mix</h3>
          <p class="chart-desc">How each state's enforcement is distributed across offence types.</p>
          <div class="chart-container"><canvas id="fines-heatmap"></canvas></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("fines-year-start").value = years[0];
  document.getElementById("fines-year-end").value = summary.latest_year;

  bindFinesFilters(records, summary);
  updateFinesView(records, summary);
}

function bindFinesFilters(records, summary) {
  const update = () => {
    state.filters.yearStart = document.getElementById("fines-year-start").value;
    state.filters.yearEnd = document.getElementById("fines-year-end").value;
    state.filters.jurisdiction = document.getElementById("fines-jurisdiction").value;
    state.filters.metric = document.getElementById("fines-metric").value;
    updateFinesView(records, summary);
  };

  ["fines-year-start", "fines-year-end", "fines-jurisdiction", "fines-metric"].forEach(
    (id) => document.getElementById(id).addEventListener("change", update)
  );
}

function updateFinesView(records, summary) {
  const { yearStart, yearEnd, jurisdiction, metric } = state.filters;

  const filtered = records.filter((r) => {
    const y = r.series_year;
    if (yearStart && y < parseInt(yearStart)) return false;
    if (yearEnd && y > parseInt(yearEnd)) return false;
    if (jurisdiction !== "all" && r.jurisdiction !== jurisdiction) return false;
    if (metric !== "all" && r.metric_key !== metric) return false;
    return true;
  });

  updateFinesHeader(filtered, summary);
  updateFinesStats(filtered, summary);
  destroyCharts();
  drawFinesTrend(filtered);
  drawFinesMetrics(filtered);
  drawFinesJurisdictions(filtered);
  drawFinesDetection(filtered);
  drawFinesComparison(filtered);
  drawFinesHeatmap(filtered);
}

function updateFinesHeader(records, summary) {
  const totalActions = records.reduce((s, r) => s + r.total_actions, 0);
  const finesCount = records.reduce((s, r) => s + r.fines, 0);
  const years = [...new Set(records.map((r) => r.series_year))];
  const yearRange = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "no data";

  const header = document.getElementById("dynamic-header");
  if (!header) return;

  if (state.filters.metric !== "all") {
    const metricLabel = records[0]?.metric_label || state.filters.metric;
    header.querySelector("h2").innerHTML = `<span class="stat-number">${fmtCompact(totalActions)}</span> ${metricLabel.toLowerCase()} actions from ${yearRange}`;
    header.querySelector("p").textContent = `Across ${records.length} data points in ${state.filters.jurisdiction === "all" ? "all jurisdictions" : state.filters.jurisdiction}.`;
  } else if (state.filters.jurisdiction !== "all") {
    header.querySelector("h2").innerHTML = `<span class="stat-number">${fmtCompact(totalActions)}</span> total enforcement actions in ${state.filters.jurisdiction}`;
    header.querySelector("p").textContent = `From ${yearRange}. Speeding accounts for ${pct(records.filter(r => r.metric_key === "speed_fines").reduce((s, r) => s + r.total_actions, 0), totalActions)} of these actions.`;
  } else {
    const speedTotal = records.filter((r) => r.metric_key === "speed_fines").reduce((s, r) => s + r.fines, 0);
    header.querySelector("h2").innerHTML = `Speeding is fined <span class="stat-number">${fmtCompact(speedTotal)}</span> times in the selected range`;
    header.querySelector("p").textContent = `That's ${pct(records.filter(r => r.metric_key === "speed_fines").reduce((s, r) => s + r.total_actions, 0), totalActions)} of all enforcement actions from ${yearRange}.`;
  }
}

function updateFinesStats(records, summary) {
  const totalActions = records.reduce((s, r) => s + r.total_actions, 0);
  const totalFines = records.reduce((s, r) => s + r.fines, 0);
  const totalCharges = records.reduce((s, r) => s + r.charges, 0);
  const totalArrests = records.reduce((s, r) => s + r.arrests, 0);
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].length;
  const years = [...new Set(records.map((r) => r.series_year))].length;

  const statRow = document.getElementById("stat-row");
  if (!statRow) return;

  statRow.innerHTML = `
    <div class="stat-box">
      <div class="stat-label">Total actions</div>
      <div class="stat-value">${fmtCompact(totalActions)}</div>
      <div class="stat-sub">${years} years, ${jurisdictions} jurisdictions</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Fines</div>
      <div class="stat-value">${fmtCompact(totalFines)}</div>
      <div class="stat-sub">${pct(totalFines, totalActions)} of actions</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Charges</div>
      <div class="stat-value">${fmtCompact(totalCharges)}</div>
      <div class="stat-sub">${pct(totalCharges, totalActions)} of actions</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Arrests</div>
      <div class="stat-value">${fmtCompact(totalArrests)}</div>
      <div class="stat-sub">${pct(totalArrests, totalActions)} of actions</div>
    </div>
  `;
}

function drawFinesTrend(records) {
  const annual = {};
  records.forEach((r) => {
    if (!annual[r.series_year]) annual[r.series_year] = { fines: 0, arrests: 0, charges: 0 };
    annual[r.series_year].fines += r.fines;
    annual[r.series_year].arrests += r.arrests;
    annual[r.series_year].charges += r.charges;
  });

  const years = Object.keys(annual).sort();
  const canvas = document.getElementById("fines-trend");
  if (!canvas) return;

  createChart(canvas, {
    type: "line",
    data: {
      labels: years,
      datasets: [
        {
          label: "Fines",
          data: years.map((y) => annual[y].fines),
          borderColor: CHART_COLORS.primary,
          backgroundColor: CHART_COLORS.primary + "18",
          fill: true,
          tension: 0.3,
          pointRadius: years.length > 20 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2,
        },
        {
          label: "Charges",
          data: years.map((y) => annual[y].charges),
          borderColor: CHART_COLORS.accent,
          backgroundColor: "transparent",
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
        {
          label: "Arrests",
          data: years.map((y) => annual[y].arrests),
          borderColor: CHART_COLORS.red,
          backgroundColor: "transparent",
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        },
      ],
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawFinesMetrics(records) {
  const totals = {};
  records.forEach((r) => {
    totals[r.metric_label] = (totals[r.metric_label] || 0) + r.total_actions;
  });

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const canvas = document.getElementById("fines-metrics");
  if (!canvas) return;

  createChart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{
        data: sorted.map((s) => s[1]),
        backgroundColor: sorted.map((s) => METRIC_COLORS[s[0]] || CHART_COLORS.primary),
        borderRadius: 4,
        barPercentage: 0.7,
      }],
    },
    options: chartDefaults({
      indexAxis: "y",
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: {
        ...chartDefaults().scales,
        x: {
          ...chartDefaults().scales.x,
          ticks: { ...chartDefaults().scales.x.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawFinesJurisdictions(records) {
  const byYearJurisdiction = {};
  records.forEach((r) => {
    const key = `${r.series_year}-${r.jurisdiction}`;
    byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.total_actions;
  });

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].sort();
  const canvas = document.getElementById("fines-jurisdictions");
  if (!canvas) return;

  createChart(canvas, {
    type: "line",
    data: {
      labels: years,
      datasets: jurisdictions.map((j) => ({
        label: j,
        data: years.map((y) => byYearJurisdiction[`${y}-${j}`] || 0),
        borderColor: JURISDICTION_COLORS[j] || CHART_COLORS.primary,
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawFinesDetection(records) {
  const byMetricMethod = {};
  records.forEach((r) => {
    if (r.fines === 0) return;
    const key = `${r.metric_label}||${r.detection_method}`;
    byMetricMethod[key] = (byMetricMethod[key] || 0) + r.fines;
  });

  const metrics = [...new Set(records.map((r) => r.metric_label))].filter(
    (m) => m !== "Unlicensed driving"
  );
  const methods = [...new Set(records.map((r) => r.detection_method))].filter(
    (m) => m !== "Not applicable" && m !== "Unknown"
  );

  const methodColors = {
    "Fixed camera": "#38bdf8",
    "Mobile camera": "#818cf8",
    "Police issued": "#fb923c",
    "Red light camera": "#34d399",
    "Fixed or mobile camera": "#a78bfa",
    "Average speed camera": "#fbbf24",
  };

  const canvas = document.getElementById("fines-detection");
  if (!canvas) return;

  createChart(canvas, {
    type: "bar",
    data: {
      labels: metrics,
      datasets: methods.map((method) => ({
        label: method,
        data: metrics.map((metric) => byMetricMethod[`${metric}||${method}`] || 0),
        backgroundColor: methodColors[method] || CHART_COLORS.primary,
        borderRadius: 2,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        x: { ...chartDefaults().scales.x, stacked: true },
        y: {
          ...chartDefaults().scales.y,
          stacked: true,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawFinesComparison(records) {
  const annualMetric = {};
  records.forEach((r) => {
    if (!annualMetric[r.series_year]) annualMetric[r.series_year] = {};
    annualMetric[r.series_year][r.metric_label] =
      (annualMetric[r.series_year][r.metric_label] || 0) + r.total_actions;
  });

  const years = Object.keys(annualMetric).sort();
  const metricKeys = ["Speeding fines", "Mobile phone use", "Seatbelt non-compliance"];
  const canvas = document.getElementById("fines-comparison");
  if (!canvas) return;

  createChart(canvas, {
    type: "line",
    data: {
      labels: years,
      datasets: metricKeys.map((m) => ({
        label: m,
        data: years.map((y) => annualMetric[y]?.[m] || 0),
        borderColor: METRIC_COLORS[m] || CHART_COLORS.primary,
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawFinesHeatmap(records) {
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].sort();
  const metrics = [...new Set(records.map((r) => r.metric_label))];

  const data = jurisdictions.map((j) => {
    const row = { jurisdiction: j };
    metrics.forEach((m) => {
      row[m] = records
        .filter((r) => r.jurisdiction === j && r.metric_label === m)
        .reduce((sum, r) => sum + r.total_actions, 0);
    });
    return row;
  });

  const canvas = document.getElementById("fines-heatmap");
  if (!canvas) return;

  createChart(canvas, {
    type: "bar",
    data: {
      labels: jurisdictions,
      datasets: metrics.map((m) => ({
        label: m,
        data: data.map((d) => d[m]),
        backgroundColor: (METRIC_COLORS[m] || CHART_COLORS.primary) + "cc",
        borderRadius: 2,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        x: { ...chartDefaults().scales.x, stacked: true },
        y: {
          ...chartDefaults().scales.y,
          stacked: true,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

/* ========== BREATH TESTS PAGE ========== */
function renderBreathTestsPage() {
  const summary = state.summaries["breath-tests"];
  const records = state.records["breath-tests"];
  if (!summary || !records) {
    app.innerHTML = `<div class="loading">Loading breath test data…</div>`;
    return;
  }

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = ["all", ...summary.dimensions.jurisdictions];
  const ageGroups = ["all", ...summary.dimensions.age_groups.filter((a) => a !== "All ages")];

  const sections = [
    { id: "trend", title: "Trend over time" },
    { id: "jurisdictions", title: "By jurisdiction" },
    { id: "age", title: "By age group" },
    { id: "indexed", title: "Indexed comparison" },
  ];

  state.filters.yearStart = years[0];
  state.filters.yearEnd = summary.latest_year;

  const totalTests = summary.totals.total_positive_tests;
  const latestTotal = summary.latest_year_totals.total_positive_tests;
  const topJurisdiction = summary.aggregates.by_jurisdiction[0];

  app.innerHTML = `
    <div class="dataset-page">
      <nav class="toc-sidebar">
        <h4>Sections</h4>
        ${sections.map((s) => `<a href="#${s.id}" class="toc-link" data-target="${s.id}">${s.title}</a>`).join("")}
      </nav>
      <div class="dataset-content">
        <div class="dynamic-header" id="dynamic-header">
          <h2><span class="stat-number">${fmt(totalTests)}</span> positive breath tests from 2008 to 2024</h2>
          <p>In ${summary.latest_year} alone, ${fmt(latestTotal)} drivers tested positive across Australia.</p>
        </div>
        <div class="filter-bar" id="filter-bar">
          <div class="filter-group">
            <label>From year</label>
            <select id="breath-year-start">${years.map((y) => `<option value="${y}">${y}</option>`).join("")}</select>
          </div>
          <div class="filter-group">
            <label>To year</label>
            <select id="breath-year-end">${years.map((y) => `<option value="${y}" ${y === summary.latest_year ? "selected" : ""}>${y}</option>`).join("")}</select>
          </div>
          <div class="filter-group">
            <label>Jurisdiction</label>
            <select id="breath-jurisdiction">${jurisdictions.map((j) => `<option value="${j}">${j === "all" ? "All" : j}</option>`).join("")}</select>
          </div>
          <div class="filter-group">
            <label>Age group</label>
            <select id="breath-age">${ageGroups.map((a) => `<option value="${a}">${a}</option>`).join("")}</select>
          </div>
        </div>
        <div class="stat-row" id="stat-row"></div>
        <div class="chart-section" id="trend">
          <h3>Positive breath tests over time</h3>
          <p class="chart-desc">Annual trend by jurisdiction.</p>
          <div class="chart-container"><canvas id="breath-trend"></canvas></div>
        </div>
        <div class="chart-section" id="jurisdictions">
          <h3>Which jurisdictions have the most positives</h3>
          <p class="chart-desc">Total positive tests by jurisdiction in the selected period.</p>
          <div class="chart-container"><canvas id="breath-jurisdictions"></canvas></div>
        </div>
        <div class="chart-section" id="age">
          <h3>Positives by age group</h3>
          <p class="chart-desc">How positive detections are distributed across age groups.</p>
          <div class="chart-container"><canvas id="breath-age"></canvas></div>
        </div>
        <div class="chart-section" id="indexed">
          <h3>Jurisdiction trends compared</h3>
          <p class="chart-desc">Indexed to the first year = 100, showing relative change rather than raw volume.</p>
          <div class="chart-container"><canvas id="breath-indexed"></canvas></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("breath-year-start").value = years[0];
  document.getElementById("breath-year-end").value = summary.latest_year;

  bindBreathFilters(records, summary);
  updateBreathView(records, summary);
}

function bindBreathFilters(records, summary) {
  const update = () => {
    state.filters.yearStart = document.getElementById("breath-year-start").value;
    state.filters.yearEnd = document.getElementById("breath-year-end").value;
    state.filters.jurisdiction = document.getElementById("breath-jurisdiction").value;
    state.filters.ageGroup = document.getElementById("breath-age").value;
    updateBreathView(records, summary);
  };

  ["breath-year-start", "breath-year-end", "breath-jurisdiction", "breath-age"].forEach(
    (id) => document.getElementById(id).addEventListener("change", update)
  );
}

function updateBreathView(records, summary) {
  const { yearStart, yearEnd, jurisdiction, ageGroup } = state.filters;

  const filtered = records.filter((r) => {
    const y = r.series_year;
    if (yearStart && y < parseInt(yearStart)) return false;
    if (yearEnd && y > parseInt(yearEnd)) return false;
    if (jurisdiction !== "all" && r.jurisdiction !== jurisdiction) return false;
    if (ageGroup && ageGroup !== "all" && r.age_group !== ageGroup) return false;
    return true;
  });

  updateBreathHeader(filtered, summary);
  updateBreathStats(filtered, summary);
  destroyCharts();
  drawBreathTrend(filtered);
  drawBreathJurisdictions(filtered);
  drawBreathAge(filtered);
  drawBreathIndexed(filtered);
}

function updateBreathHeader(records, summary) {
  const total = records.reduce((s, r) => s + r.count, 0);
  const years = [...new Set(records.map((r) => r.series_year))];
  const yearRange = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "no data";

  const header = document.getElementById("dynamic-header");
  if (!header) return;

  if (state.filters.jurisdiction !== "all") {
    header.querySelector("h2").innerHTML = `<span class="stat-number">${fmtCompact(total)}</span> positive breath tests in ${state.filters.jurisdiction}`;
    header.querySelector("p").textContent = `From ${yearRange}.`;
  } else {
    header.querySelector("h2").innerHTML = `<span class="stat-number">${fmtCompact(total)}</span> positive breath tests from ${yearRange}`;
    header.querySelector("p").textContent = `Across all jurisdictions.`;
  }
}

function updateBreathStats(records, summary) {
  const total = records.reduce((s, r) => s + r.count, 0);
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].length;
  const years = [...new Set(records.map((r) => r.series_year))].length;
  const byJurisdiction = {};
  records.forEach((r) => { byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + r.count; });
  const top = Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1])[0];

  const statRow = document.getElementById("stat-row");
  if (!statRow) return;

  statRow.innerHTML = `
    <div class="stat-box">
      <div class="stat-label">Total positives</div>
      <div class="stat-value">${fmtCompact(total)}</div>
      <div class="stat-sub">${years} years</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Jurisdictions</div>
      <div class="stat-value">${jurisdictions}</div>
      <div class="stat-sub">States and territories</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Highest</div>
      <div class="stat-value">${top ? top[0] : "—"}</div>
      <div class="stat-sub">${top ? fmtCompact(top[1]) : ""} total</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Records</div>
      <div class="stat-value">${fmt(records.length)}</div>
      <div class="stat-sub">Annual data points</div>
    </div>
  `;
}

function drawBreathTrend(records) {
  const byYearJurisdiction = {};
  records.forEach((r) => {
    const key = `${r.series_year}-${r.jurisdiction}`;
    byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.count;
  });

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].sort();
  const canvas = document.getElementById("breath-trend");
  if (!canvas) return;

  createChart(canvas, {
    type: "line",
    data: {
      labels: years,
      datasets: jurisdictions.map((j) => ({
        label: j,
        data: years.map((y) => byYearJurisdiction[`${y}-${j}`] || 0),
        borderColor: JURISDICTION_COLORS[j] || CHART_COLORS.primary,
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawBreathJurisdictions(records) {
  const byJurisdiction = {};
  records.forEach((r) => { byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + r.count; });

  const sorted = Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1]);
  const canvas = document.getElementById("breath-jurisdictions");
  if (!canvas) return;

  createChart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{
        data: sorted.map((s) => s[1]),
        backgroundColor: sorted.map((s) => JURISDICTION_COLORS[s[0]] || CHART_COLORS.primary),
        borderRadius: 4,
        barPercentage: 0.7,
      }],
    },
    options: chartDefaults({
      indexAxis: "y",
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: {
        ...chartDefaults().scales,
        x: {
          ...chartDefaults().scales.x,
          ticks: { ...chartDefaults().scales.x.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawBreathAge(records) {
  const byAge = {};
  records.forEach((r) => { byAge[r.age_group] = (byAge[r.age_group] || 0) + r.count; });

  const sorted = Object.entries(byAge)
    .filter(([k]) => k !== "Unknown" && k !== "All ages")
    .sort((a, b) => b[1] - a[1]);

  const canvas = document.getElementById("breath-age");
  if (!canvas) return;

  createChart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{
        data: sorted.map((s) => s[1]),
        backgroundColor: CHART_COLORS.secondary + "cc",
        borderRadius: 4,
        barPercentage: 0.7,
      }],
    },
    options: chartDefaults({
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawBreathIndexed(records) {
  const byYearJurisdiction = {};
  records.forEach((r) => {
    const key = `${r.series_year}-${r.jurisdiction}`;
    byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.count;
  });

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].sort();
  const canvas = document.getElementById("breath-indexed");
  if (!canvas || years.length < 2) return;

  const baseYear = years[0];

  createChart(canvas, {
    type: "line",
    data: {
      labels: years,
      datasets: jurisdictions.map((j) => {
        const base = byYearJurisdiction[`${baseYear}-${j}`] || 1;
        return {
          label: j,
          data: years.map((y) => {
            const val = byYearJurisdiction[`${y}-${j}`] || 0;
            return ((val / base) * 100).toFixed(1);
          }),
          borderColor: JURISDICTION_COLORS[j] || CHART_COLORS.primary,
          backgroundColor: "transparent",
          tension: 0.3,
          pointRadius: 0,
          borderWidth: 2,
        };
      }),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          title: { display: true, text: "Index (first year = 100)", color: CHART_COLORS.text },
        },
      },
    }),
  });
}

/* ========== DRUG TESTS PAGE ========== */
function renderDrugTestsPage() {
  const summary = state.summaries["drug-tests"];
  const records = state.records["drug-tests"];
  if (!summary || !records) {
    app.innerHTML = `<div class="loading">Loading drug test data…</div>`;
    return;
  }

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = ["all", ...summary.dimensions.jurisdictions];
  const stages = ["all", ...summary.dimensions.detection_methods];

  const sections = [
    { id: "trend", title: "Trend over time" },
    { id: "substances", title: "Substance breakdown" },
    { id: "stages", title: "Testing stages" },
    { id: "jurisdictions", title: "By jurisdiction" },
    { id: "composition", title: "Substance trends" },
  ];

  state.filters.yearStart = years[0];
  state.filters.yearEnd = summary.latest_year;

  const totalTests = summary.totals.total_positive_tests;
  const latestTotal = summary.latest_year_totals.total_positive_tests;
  const topJurisdiction = summary.aggregates.by_jurisdiction[0];

  app.innerHTML = `
    <div class="dataset-page">
      <nav class="toc-sidebar">
        <h4>Sections</h4>
        ${sections.map((s) => `<a href="#${s.id}" class="toc-link" data-target="${s.id}">${s.title}</a>`).join("")}
      </nav>
      <div class="dataset-content">
        <div class="dynamic-header" id="dynamic-header">
          <h2><span class="stat-number">${fmt(totalTests)}</span> positive drug tests from 2008 to 2024</h2>
          <p>${fmt(latestTotal)} positive detections in ${summary.latest_year} alone.</p>
        </div>
        <div class="filter-bar" id="filter-bar">
          <div class="filter-group">
            <label>From year</label>
            <select id="drug-year-start">${years.map((y) => `<option value="${y}">${y}</option>`).join("")}</select>
          </div>
          <div class="filter-group">
            <label>To year</label>
            <select id="drug-year-end">${years.map((y) => `<option value="${y}" ${y === summary.latest_year ? "selected" : ""}>${y}</option>`).join("")}</select>
          </div>
          <div class="filter-group">
            <label>Jurisdiction</label>
            <select id="drug-jurisdiction">${jurisdictions.map((j) => `<option value="${j}">${j === "all" ? "All" : j}</option>`).join("")}</select>
          </div>
          <div class="filter-group">
            <label>Testing stage</label>
            <select id="drug-stage">${stages.map((s) => `<option value="${s}">${s === "all" ? "All" : s}</option>`).join("")}</select>
          </div>
        </div>
        <div class="stat-row" id="stat-row"></div>
        <div class="chart-section" id="trend">
          <h3>Positive drug tests over time</h3>
          <p class="chart-desc">Annual national trend by jurisdiction. Drug testing expanded significantly after 2010.</p>
          <div class="chart-container"><canvas id="drug-trend"></canvas></div>
        </div>
        <div class="chart-section" id="substances">
          <h3>Which substances are detected most</h3>
          <p class="chart-desc">Substance detection counts across all jurisdictions. Cannabis consistently leads.</p>
          <div class="chart-container"><canvas id="drug-substances"></canvas></div>
        </div>
        <div class="chart-section" id="stages">
          <h3>Testing stage breakdown</h3>
          <p class="chart-desc">Indicator (Stage 1) screening versus confirmatory tests by year.</p>
          <div class="chart-container"><canvas id="drug-stages"></canvas></div>
        </div>
        <div class="chart-section" id="jurisdictions">
          <h3>Jurisdiction comparison</h3>
          <p class="chart-desc">Positive drug tests by jurisdiction in the selected period.</p>
          <div class="chart-container"><canvas id="drug-jurisdictions"></canvas></div>
        </div>
        <div class="chart-section" id="composition">
          <h3>Substance composition over time</h3>
          <p class="chart-desc">How the mix of detected substances has shifted across the dataset period.</p>
          <div class="chart-container"><canvas id="drug-composition"></canvas></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("drug-year-start").value = years[0];
  document.getElementById("drug-year-end").value = summary.latest_year;

  bindDrugFilters(records, summary);
  updateDrugView(records, summary);
}

function bindDrugFilters(records, summary) {
  const update = () => {
    state.filters.yearStart = document.getElementById("drug-year-start").value;
    state.filters.yearEnd = document.getElementById("drug-year-end").value;
    state.filters.jurisdiction = document.getElementById("drug-jurisdiction").value;
    state.filters.detectionStage = document.getElementById("drug-stage").value;
    updateDrugView(records, summary);
  };

  ["drug-year-start", "drug-year-end", "drug-jurisdiction", "drug-stage"].forEach(
    (id) => document.getElementById(id).addEventListener("change", update)
  );
}

function updateDrugView(records, summary) {
  const { yearStart, yearEnd, jurisdiction, detectionStage } = state.filters;

  const filtered = records.filter((r) => {
    const y = r.series_year;
    if (yearStart && y < parseInt(yearStart)) return false;
    if (yearEnd && y > parseInt(yearEnd)) return false;
    if (jurisdiction !== "all" && r.jurisdiction !== jurisdiction) return false;
    if (detectionStage && detectionStage !== "all" && r.detection_method !== detectionStage) return false;
    return true;
  });

  updateDrugHeader(filtered, summary);
  updateDrugStats(filtered, summary);
  destroyCharts();
  drawDrugTrend(filtered);
  drawDrugSubstances(filtered);
  drawDrugStages(filtered);
  drawDrugJurisdictions(filtered);
  drawDrugComposition(filtered);
}

function updateDrugHeader(records, summary) {
  const total = records.reduce((s, r) => s + r.count, 0);
  const years = [...new Set(records.map((r) => r.series_year))];
  const yearRange = years.length ? `${Math.min(...years)}–${Math.max(...years)}` : "no data";

  const header = document.getElementById("dynamic-header");
  if (!header) return;

  if (state.filters.jurisdiction !== "all") {
    header.querySelector("h2").innerHTML = `<span class="stat-number">${fmtCompact(total)}</span> positive drug tests in ${state.filters.jurisdiction}`;
    header.querySelector("p").textContent = `From ${yearRange}.`;
  } else {
    header.querySelector("h2").innerHTML = `<span class="stat-number">${fmtCompact(total)}</span> positive drug tests from ${yearRange}`;
    header.querySelector("p").textContent = `Across all jurisdictions.`;
  }
}

function updateDrugStats(records, summary) {
  const total = records.reduce((s, r) => s + r.count, 0);
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].length;
  const years = [...new Set(records.map((r) => r.series_year))].length;
  const byJurisdiction = {};
  records.forEach((r) => { byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + r.count; });
  const top = Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1])[0];

  const statRow = document.getElementById("stat-row");
  if (!statRow) return;

  statRow.innerHTML = `
    <div class="stat-box">
      <div class="stat-label">Total positives</div>
      <div class="stat-value">${fmtCompact(total)}</div>
      <div class="stat-sub">${years} years</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Jurisdictions</div>
      <div class="stat-value">${jurisdictions}</div>
      <div class="stat-sub">States and territories</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Highest</div>
      <div class="stat-value">${top ? top[0] : "—"}</div>
      <div class="stat-sub">${top ? fmtCompact(top[1]) : ""} total</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Records</div>
      <div class="stat-value">${fmt(records.length)}</div>
      <div class="stat-sub">Annual data points</div>
    </div>
  `;
}

function drawDrugTrend(records) {
  const byYearJurisdiction = {};
  records.forEach((r) => {
    const key = `${r.series_year}-${r.jurisdiction}`;
    byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.count;
  });

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].sort();
  const canvas = document.getElementById("drug-trend");
  if (!canvas) return;

  createChart(canvas, {
    type: "line",
    data: {
      labels: years,
      datasets: jurisdictions.map((j) => ({
        label: j,
        data: years.map((y) => byYearJurisdiction[`${y}-${j}`] || 0),
        borderColor: JURISDICTION_COLORS[j] || CHART_COLORS.primary,
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawDrugSubstances(records) {
  const byYear = {};
  records.forEach((r) => {
    if (!byYear[r.series_year]) {
      byYear[r.series_year] = { cannabis: 0, amphetamine: 0, methylamphetamine: 0, ecstasy: 0, cocaine: 0, other: 0 };
    }
    if (r.cannabis_detected) byYear[r.series_year].cannabis++;
    if (r.amphetamine_detected) byYear[r.series_year].amphetamine++;
    if (r.methylamphetamine_detected) byYear[r.series_year].methylamphetamine++;
    if (r.ecstasy_detected) byYear[r.series_year].ecstasy++;
    if (r.cocaine_detected) byYear[r.series_year].cocaine++;
    if (r.other_detected) byYear[r.series_year].other++;
  });

  const years = Object.keys(byYear).sort();
  const substances = ["cannabis", "amphetamine", "methylamphetamine", "ecstasy", "cocaine", "other"];
  const canvas = document.getElementById("drug-substances");
  if (!canvas) return;

  createChart(canvas, {
    type: "bar",
    data: {
      labels: years,
      datasets: substances.map((s) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        data: years.map((y) => byYear[y][s]),
        backgroundColor: SUBSTANCE_COLORS[s] + "cc",
        borderRadius: 2,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        x: { ...chartDefaults().scales.x, stacked: true },
        y: {
          ...chartDefaults().scales.y,
          stacked: true,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawDrugStages(records) {
  const byYearStage = {};
  records.forEach((r) => {
    const key = `${r.series_year}-${r.detection_method}`;
    byYearStage[key] = (byYearStage[key] || 0) + r.count;
  });

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const stages = [...new Set(records.map((r) => r.detection_method))];
  const canvas = document.getElementById("drug-stages");
  if (!canvas) return;

  createChart(canvas, {
    type: "bar",
    data: {
      labels: years,
      datasets: stages.map((s) => ({
        label: s,
        data: years.map((y) => byYearStage[`${y}-${s}`] || 0),
        backgroundColor: s.includes("Stage 1") ? CHART_COLORS.primary + "cc" : CHART_COLORS.accent + "cc",
        borderRadius: 2,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        x: { ...chartDefaults().scales.x, stacked: true },
        y: {
          ...chartDefaults().scales.y,
          stacked: true,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawDrugJurisdictions(records) {
  const byJurisdiction = {};
  records.forEach((r) => { byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + r.count; });

  const sorted = Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1]);
  const canvas = document.getElementById("drug-jurisdictions");
  if (!canvas) return;

  createChart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{
        data: sorted.map((s) => s[1]),
        backgroundColor: sorted.map((s) => JURISDICTION_COLORS[s[0]] || CHART_COLORS.accent),
        borderRadius: 4,
        barPercentage: 0.7,
      }],
    },
    options: chartDefaults({
      indexAxis: "y",
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: {
        ...chartDefaults().scales,
        x: {
          ...chartDefaults().scales.x,
          ticks: { ...chartDefaults().scales.x.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

function drawDrugComposition(records) {
  const byYear = {};
  records.forEach((r) => {
    if (!byYear[r.series_year]) {
      byYear[r.series_year] = { cannabis: 0, amphetamine: 0, methylamphetamine: 0, ecstasy: 0, cocaine: 0 };
    }
    if (r.cannabis_detected) byYear[r.series_year].cannabis++;
    if (r.amphetamine_detected) byYear[r.series_year].amphetamine++;
    if (r.methylamphetamine_detected) byYear[r.series_year].methylamphetamine++;
    if (r.ecstasy_detected) byYear[r.series_year].ecstasy++;
    if (r.cocaine_detected) byYear[r.series_year].cocaine++;
  });

  const years = Object.keys(byYear).sort();
  const substances = ["cannabis", "amphetamine", "methylamphetamine", "ecstasy", "cocaine"];
  const canvas = document.getElementById("drug-composition");
  if (!canvas) return;

  createChart(canvas, {
    type: "line",
    data: {
      labels: years,
      datasets: substances.map((s) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        data: years.map((y) => byYear[y][s]),
        borderColor: SUBSTANCE_COLORS[s],
        backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 0,
        borderWidth: 2,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        y: {
          ...chartDefaults().scales.y,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) },
        },
      },
    }),
  });
}

/* ========== ABOUT PAGE ========== */
function renderAboutPage() {
  app.innerHTML = `
    <div class="about-section">
      <h2>About this project</h2>
      <p>This site visualises Australian road safety enforcement data published by the Bureau of Infrastructure and Transport Research Economics (BITRE). The data covers fines, breath tests, and drug tests across all states and territories from 2008 to 2024.</p>
    </div>
    <div class="about-section">
      <h2>Data sources</h2>
      <p>All data comes from BITRE's road safety enforcement statistics, published through the National Road Safety Data Hub. Three datasets are used:</p>
      <ul>
        <li><strong>Police enforcement fines</strong> — Monthly records of speeding, mobile phone use, seatbelt non-compliance, and unlicensed driving offences. Covers 2008–2024 with 12,179 cleaned records.</li>
        <li><strong>Positive breath tests</strong> — Annual counts of positive random breath test results by jurisdiction, location, and age group. Covers 2008–2024.</li>
        <li><strong>Positive drug tests</strong> — Annual counts of positive roadside drug tests with substance-level detection data (cannabis, amphetamine, cocaine, ecstasy, methylamphetamine). Covers 2008–2024.</li>
      </ul>
    </div>
    <div class="about-section">
      <h2>Methodology</h2>
      <p>Raw Excel files are cleaned through a published pipeline that converts Excel date serials to ISO calendar dates, normalises text values, and preserves zero values as observed data. The cleaned JSON and CSV files are available for download alongside each dataset.</p>
      <p>All historical comparisons use annual aggregation. Pre-2023 fines data was reported annually, while post-2023 data has monthly granularity. For consistency, all trend visualisations aggregate to the annual level.</p>
    </div>
    <div class="about-section">
      <h2>Data limitations</h2>
      <div class="note">
        <p><strong>Reporting change in 2023:</strong> Fines data shifted from annual to monthly reporting. This creates an apparent discontinuity in the time series that reflects reporting scope, not necessarily a change in enforcement behaviour.</p>
      </div>
      <ul>
        <li>Cross-jurisdiction comparisons should be read as indicative. State and territory definitions and reporting systems are not fully harmonised.</li>
        <li>Drug test substance detection uses indicator-based screening (Stage 1), not confirmatory laboratory analysis. Positive results at Stage 1 may not always be confirmed.</li>
        <li>Zero values are retained as observed values rather than treated as missing data.</li>
        <li>Camera-led and police-issued enforcement should not be read as identical forms of enforcement, even when they produce the same legal outcome.</li>
        <li>The breath test dataset records positive tests only, not total tests conducted. Positivity rates cannot be calculated without the denominator of total tests.</li>
      </ul>
    </div>
    <div class="about-section">
      <h2>Colour palette</h2>
      <p>Jurisdictions are colour-coded consistently across all charts:</p>
      <div class="stat-row">
        ${Object.entries(JURISDICTION_COLORS)
          .map(
            ([j, c]) => `
          <div class="stat-box" style="border-left: 3px solid ${c}">
            <div class="stat-value" style="font-size:18px;color:${c}">${j}</div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;
}

init();
