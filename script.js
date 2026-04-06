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

// Distinct colours used for drug testing stages so each legend item is visually
// separable (previously non-Stage-1 items all shared the same accent colour).
const STAGE_COLORS = {
  "Indicator (Stage 1)": CHART_COLORS.primary,
  "Secondary Confirmatory (Stage 2)": CHART_COLORS.secondary,
  "Laboratory or Toxicology (Stage 3)": CHART_COLORS.green,
  "Not applicable": CHART_COLORS.yellow,
};

const JURISDICTION_NAMES = {
  NSW: "New South Wales",
  VIC: "Victoria",
  QLD: "Queensland",
  WA: "Western Australia",
  SA: "South Australia",
  TAS: "Tasmania",
  ACT: "Australian Capital Territory",
  NT: "Northern Territory",
};

const AUSTRALIA_JURISDICTIONS_GEOJSON = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { code: "WA", name: "Western Australia" },
      geometry: {
        type: "Polygon",
        coordinates: [[[112.0, -35.0], [129.0, -35.0], [129.0, -13.0], [112.0, -13.0], [112.0, -35.0]]],
      },
    },
    {
      type: "Feature",
      properties: { code: "NT", name: "Northern Territory" },
      geometry: {
        type: "Polygon",
        coordinates: [[[129.0, -26.0], [138.0, -26.0], [138.0, -11.0], [129.0, -11.0], [129.0, -26.0]]],
      },
    },
    {
      type: "Feature",
      properties: { code: "SA", name: "South Australia" },
      geometry: {
        type: "Polygon",
        coordinates: [[[129.0, -38.0], [141.0, -38.0], [141.0, -26.0], [129.0, -26.0], [129.0, -38.0]]],
      },
    },
    {
      type: "Feature",
      properties: { code: "QLD", name: "Queensland" },
      geometry: {
        type: "Polygon",
        coordinates: [[[138.0, -29.0], [154.0, -29.0], [154.0, -11.0], [138.0, -11.0], [138.0, -29.0]]],
      },
    },
    {
      type: "Feature",
      properties: { code: "NSW", name: "New South Wales" },
      geometry: {
        type: "Polygon",
        coordinates: [[[141.0, -37.5], [153.8, -37.5], [153.8, -28.0], [141.0, -28.0], [141.0, -37.5]]],
      },
    },
    {
      type: "Feature",
      properties: { code: "VIC", name: "Victoria" },
      geometry: {
        type: "Polygon",
        coordinates: [[[141.0, -39.5], [150.0, -39.5], [150.0, -36.0], [141.0, -36.0], [141.0, -39.5]]],
      },
    },
    {
      type: "Feature",
      properties: { code: "ACT", name: "Australian Capital Territory" },
      geometry: {
        type: "Polygon",
        coordinates: [[[148.75, -35.55], [149.35, -35.55], [149.35, -35.05], [148.75, -35.05], [148.75, -35.55]]],
      },
    },
    {
      type: "Feature",
      properties: { code: "TAS", name: "Tasmania" },
      geometry: {
        type: "Polygon",
        coordinates: [[[144.0, -43.9], [149.2, -43.9], [149.2, -40.5], [144.0, -40.5], [144.0, -43.9]]],
      },
    },
  ],
};

let australiaGeoData = AUSTRALIA_JURISDICTIONS_GEOJSON;

const STATE_NAME_TO_CODE = {
  "New South Wales": "NSW",
  Victoria: "VIC",
  Queensland: "QLD",
  "Western Australia": "WA",
  "South Australia": "SA",
  Tasmania: "TAS",
  "Australian Capital Territory": "ACT",
  "Northern Territory": "NT",
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

  try {
    const rawGeo = await fetchJson("./data/australian-states.geojson");
    australiaGeoData = normalizeAustraliaGeo(rawGeo);
  } catch (error) {
    console.warn("Using fallback Australia geo shapes", error);
  }
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

function bindTocNavigation() {
  const tocLinks = document.querySelectorAll(".toc-link[data-target]");
  if (!tocLinks.length) return;

  tocLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      const targetId = link.dataset.target;
      if (!targetId) return;
      const section = document.getElementById(targetId);
      if (!section) return;
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function fmt(n) {
  return new Intl.NumberFormat("en-AU").format(n);
}

function fmtCompact(n) {
  return new Intl.NumberFormat("en-AU", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

function fmtLogTick(value) {
  if (!value) return "0";
  const abs = Math.abs(value);
  const exp = Math.floor(Math.log10(abs));
  const base = abs / (10 ** exp);
  if (abs < 1000) return fmtCompact(value);
  if (Math.abs(base - 1) < 0.0001 || Math.abs(base - 2) < 0.0001 || Math.abs(base - 5) < 0.0001) {
    return fmtCompact(value);
  }
  return "";
}

function getFilterContext(records, currentFilters) {
  const jurisdictions = [...new Set(records.map(r => r.jurisdiction))];
  const metrics = [...new Set(records.map(r => r.metric_label))];
  const years = [...new Set(records.map(r => r.series_year))];
  
  const singleJurisdiction = currentFilters.jurisdiction && currentFilters.jurisdiction !== "all";
  const singleMetric = currentFilters.metric && currentFilters.metric !== "all";
  const singleAge = currentFilters.ageGroup && currentFilters.ageGroup !== "all";
  const singleDetection = currentFilters.detectionStage && currentFilters.detectionStage !== "all";
  
  const totals = records.reduce((s, r) => s + (r.total_actions || r.count || 0), 0);
  const allZero = totals === 0;
  
  const hasOnlyOneSeries = jurisdictions.length === 1 || metrics.length === 1;
  
  return {
    jurisdictions,
    metrics,
    years,
    singleJurisdiction,
    singleMetric,
    singleAge,
    singleDetection,
    allZero,
    hasOnlyOneSeries,
    total: totals,
  };
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

function normalizeAustraliaGeo(geojson) {
  const features = (geojson?.features || [])
    .map((feature) => {
      const name = feature?.properties?.STATE_NAME || feature?.properties?.name;
      const code = STATE_NAME_TO_CODE[name] || feature?.properties?.code;
      if (!code) return null;
      return {
        ...feature,
        properties: {
          ...feature.properties,
          code,
          name,
        },
      };
    })
    .filter(Boolean);

  return {
    type: "FeatureCollection",
    features,
  };
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
          font: { size: 14 },
          boxWidth: 16,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: "#1e293b",
        titleColor: "#f1f5f9",
        bodyColor: "#94a3b8",
        borderColor: "#334155",
        borderWidth: 1,
        cornerRadius: 6,
        padding: 14,
        titleFont: { size: 15 },
        bodyFont: { size: 14 },
      },
    },
    scales: {
      x: {
        ticks: { color: CHART_COLORS.text, font: { size: 13 } },
        grid: { color: CHART_COLORS.grid, drawBorder: false },
      },
      y: {
        ticks: { color: CHART_COLORS.text, font: { size: 13 } },
        grid: { color: CHART_COLORS.grid, drawBorder: false },
      },
    },
    ...overrides,
  };
}

function colorByValue(value, maxValue, hue) {
  const ratio = maxValue > 0 ? value / maxValue : 0;
  const lightness = 88 - ratio * 45;
  const saturation = 55 + ratio * 30;
  return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function formatLegendValue(value) {
  return value >= 1000 ? fmtCompact(value) : fmt(value);
}

function renderMapLegend(container, maxValue, hue) {
  container.querySelectorAll(".map-legend").forEach((node) => node.remove());

  const legend = document.createElement("div");
  legend.className = "map-legend";
  const stops = 48;
  const stopMarkup = Array.from({ length: stops }, (_, i) => {
    const value = (maxValue * (stops - 1 - i)) / (stops - 1);
    return `<div class="map-legend-stop" style="background:${colorByValue(value, maxValue, hue)}"></div>`;
  }).join("");

  legend.innerHTML = `
    <div class="map-legend-scale">${stopMarkup}</div>
    <div class="map-legend-labels">
      <span>${formatLegendValue(maxValue)}</span>
      <span>${formatLegendValue(Math.round(maxValue / 2))}</span>
      <span>0</span>
    </div>
  `;

  container.appendChild(legend);
}

function drawAustraliaChoropleth({ canvasId, records, valueAccessor, hue, title, valueLabel }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const totals = { NSW: 0, VIC: 0, QLD: 0, WA: 0, SA: 0, TAS: 0, ACT: 0, NT: 0 };
  records.forEach((record) => {
    if (!Object.prototype.hasOwnProperty.call(totals, record.jurisdiction)) return;
    totals[record.jurisdiction] += valueAccessor(record);
  });

  const totalValue = Object.values(totals).reduce((s, v) => s + v, 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  const dataPoints = australiaGeoData.features.map((feature) => ({
    feature,
    value: totals[feature.properties.code] || 0,
  }));
  const maxValue = Math.max(...dataPoints.map((d) => d.value), 1);

  const outline = {
    type: "Feature",
    properties: { name: "Australia" },
    geometry: {
      type: "MultiPolygon",
      coordinates: dataPoints.flatMap((d) => {
        if (d.feature.geometry.type === "Polygon") return [d.feature.geometry.coordinates];
        if (d.feature.geometry.type === "MultiPolygon") return d.feature.geometry.coordinates;
        return [];
      }),
    },
  };

  createChart(canvas, {
    type: "choropleth",
    data: {
      labels: dataPoints.map((d) => d.feature.properties.code),
      datasets: [
        {
          label: title,
          outline,
          showOutline: false,
          data: dataPoints,
          borderColor: "#0f172a",
          borderWidth: 1,
          backgroundColor: (ctx) => {
            const value = ctx.raw?.value ?? 0;
            return colorByValue(value, maxValue, hue);
          },
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "#1e293b",
          titleColor: "#f1f5f9",
          bodyColor: "#94a3b8",
          borderColor: "#334155",
          borderWidth: 1,
          cornerRadius: 6,
          padding: 14,
          callbacks: {
            title: (items) => {
              const code = items[0]?.raw?.feature?.properties?.code;
              return JURISDICTION_NAMES[code] || code || "Unknown";
            },
            label: (ctx) => `${fmt(ctx.raw?.value || 0)} ${valueLabel}`,
          },
        },
      },
      scales: {
        projection: {
          axis: "x",
          projection: "equirectangular",
          padding: 10,
        },
      },
    },
  });

  renderMapLegend(canvas.parentElement, maxValue, hue);
}

function getActiveYears(byYear, keys = null) {
  return Object.keys(byYear)
    .sort()
    .filter((year) => {
      if (!keys) return (byYear[year] || 0) > 0;
      return keys.some((k) => (byYear[year]?.[k] || 0) > 0);
    });
}

/* ========== STAT CALLOUT SYSTEM ========== */
/* Each chart section gets its own big bold stat callout above it */

function updateFinesStatCallouts(records) {
  const ctx = getFilterContext(records, state.filters);
  const totalActions = records.reduce((s, r) => s + r.total_actions, 0);
  const totalFines = records.reduce((s, r) => s + r.fines, 0);
  const totalCharges = records.reduce((s, r) => s + r.charges, 0);
  const totalArrests = records.reduce((s, r) => s + r.arrests, 0);
  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const yearRange = years.length ? `${years[0]}–${years[years.length - 1]}` : "no data";

  const byMetric = {};
  records.forEach((r) => { byMetric[r.metric_label] = (byMetric[r.metric_label] || 0) + r.total_actions; });
  const topMetric = Object.entries(byMetric).sort((a, b) => b[1] - a[1])[0];

  const byJurisdiction = {};
  records.forEach((r) => { byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + r.total_actions; });
  const topJurisdiction = Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1])[0];

  const speedFines = records.filter((r) => r.metric_key === "speed_fines").reduce((s, r) => s + r.fines, 0);
  const mobileFines = records.filter((r) => r.metric_key === "mobile_phone_use").reduce((s, r) => s + r.fines, 0);
  const seatbeltFines = records.filter((r) => r.metric_key === "non_wearing_seatbelts").reduce((s, r) => s + r.fines, 0);
  const unlicensedActions = records.filter((r) => r.metric_key === "unlicensed_driving").reduce((s, r) => s + r.total_actions, 0);

  const byYear = {};
  records.forEach((r) => { byYear[r.series_year] = (byYear[r.series_year] || 0) + r.total_actions; });
  const peakYear = Object.entries(byYear).sort((a, b) => b[1] - a[1])[0];
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const firstVal = byYear[firstYear] || 0;
  const lastVal = byYear[lastYear] || 0;
  const change = firstVal ? (((lastVal - firstVal) / firstVal) * 100).toFixed(0) : 0;

  const cameraFines = records.filter((r) => r.detection_method.includes("camera") && !r.detection_method.includes("Not applicable")).reduce((s, r) => s + r.fines, 0);
  const policeFines = records.filter((r) => r.detection_method === "Police issued").reduce((s, r) => s + r.fines, 0);

  const byYearJurisdiction = {};
  records.forEach((r) => { const key = `${r.series_year}-${r.jurisdiction}`; byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.total_actions; });
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].sort();

  if (ctx.allZero) {
    const el = (id) => document.getElementById(id);
    if (el("stat-map")) el("stat-map").innerHTML = `<h2>No enforcement actions recorded for selected filters</h2><p>Try adjusting your filters to see data.</p>`;
    if (el("stat-trend")) el("stat-trend").innerHTML = `<h2>No trend data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-metrics")) el("stat-metrics").innerHTML = `<h2>No metric data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-jurisdictions")) el("stat-jurisdictions").innerHTML = `<h2>No jurisdiction data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-detection")) el("stat-detection").innerHTML = `<h2>No detection data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-slope")) el("stat-slope").innerHTML = `<h2>No slope data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-comparison")) el("stat-comparison").innerHTML = `<h2>No comparison data available</h2><p>No records match your current filters.</p>`;
    return;
  }

  const annualMetric = {};
  records.forEach((r) => {
    if (!annualMetric[r.series_year]) annualMetric[r.series_year] = {};
    annualMetric[r.series_year][r.metric_label] = (annualMetric[r.series_year][r.metric_label] || 0) + r.total_actions;
  });

  const byMetricMethod = {};
  records.forEach((r) => {
    if (r.fines === 0) return;
    const key = `${r.metric_label}||${r.detection_method}`;
    byMetricMethod[key] = (byMetricMethod[key] || 0) + r.fines;
  });

  const midIdx = Math.floor(years.length / 2);
  const firstHalf = years.slice(0, midIdx);
  const secondHalf = years.slice(midIdx);
  const slopePairs = jurisdictions.map((j) => {
    const firstAvg = firstHalf.reduce((s, y) => s + (byYearJurisdiction[`${y}-${j}`] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, y) => s + (byYearJurisdiction[`${y}-${j}`] || 0), 0) / secondHalf.length;
    return { jurisdiction: j, first: firstAvg, second: secondAvg };
  }).sort((a, b) => b.second - a.second);
  const topSlope = slopePairs[0];

  const el = (id) => document.getElementById(id);

  let mapHtml, trendHtml, metricsHtml, jurisdictionsHtml;
  const selectedJurisdiction = state.filters.jurisdiction !== "all" ? state.filters.jurisdiction : null;
  const selectedMetric = state.filters.metric !== "all" ? state.filters.metric : null;

  if (selectedJurisdiction) {
    const jTotal = byJurisdiction[selectedJurisdiction] || 0;
    const jByYear = {};
    records.filter(r => r.jurisdiction === selectedJurisdiction).forEach(r => { jByYear[r.series_year] = (jByYear[r.series_year] || 0) + r.total_actions; });
    const jFirst = jByYear[firstYear] || 0;
    const jLast = jByYear[lastYear] || 0;
    const jChange = jFirst ? (((jLast - jFirst) / jFirst) * 100).toFixed(0) : 0;
    mapHtml = `<h2>In <span class="stat-number">${selectedJurisdiction}</span>, total enforcement actions <span class="stat-number">${parseInt(jChange) >= 0 ? "grew" : "fell"} ${Math.abs(jChange)}%</span></h2><p>From ${fmtCompact(jFirst)} in ${firstYear} to ${fmtCompact(jLast)} in ${lastYear}.</p>`;
  } else {
    mapHtml = `<h2><span class="stat-number">${topJurisdiction ? topJurisdiction[0] : "—"}</span> leads with ${fmtCompact(topJurisdiction ? topJurisdiction[1] : 0)} enforcement actions</h2><p>The highest of ${jurisdictions.length} jurisdictions from ${yearRange}.</p>`;
  }

  trendHtml = `<h2>Enforcement <span class="stat-number">${parseInt(change) >= 0 ? "grew" : "fell"} ${Math.abs(change)}%</span> from ${firstYear} to ${lastYear}</h2><p>From ${fmtCompact(firstVal)} actions in ${firstYear} to ${fmtCompact(lastVal)} in ${lastYear}. Peak was ${peakYear ? peakYear[0] : "unknown"} with ${peakYear ? fmtCompact(peakYear[1]) : "0"}.</p>`;

  if (selectedMetric) {
    metricsHtml = `<h2>Selected metric accounts for <span class="stat-number">100%</span> of filtered actions</h2><p>${fmtCompact(totalActions)} total enforcement actions for ${selectedMetric}.</p>`;
  } else {
    metricsHtml = `<h2><span class="stat-number">${topMetric ? topMetric[0] : "—"}</span> dominates at ${topMetric ? pct(topMetric[1], totalActions) : "0"} of all actions</h2><p>${fmtCompact(totalActions)} total enforcement actions across ${jurisdictions.length} jurisdictions.</p>`;
  }

  jurisdictionsHtml = `<h2><span class="stat-number">${fmtCompact(totalActions)}</span> enforcement actions across ${jurisdictions.length} jurisdictions</h2><p>${topJurisdiction ? topJurisdiction[0] + " accounts for " + pct(topJurisdiction[1], totalActions) + " of the total." : ""}</p>`;

  if (el("stat-map")) el("stat-map").innerHTML = mapHtml;
  if (el("stat-trend")) el("stat-trend").innerHTML = trendHtml;
  if (el("stat-metrics")) el("stat-metrics").innerHTML = metricsHtml;
  if (el("stat-jurisdictions")) el("stat-jurisdictions").innerHTML = jurisdictionsHtml;
  if (el("stat-detection")) el("stat-detection").innerHTML = `<h2>Cameras account for <span class="stat-number">${fmtCompact(cameraFines)}</span> fines versus <span class="stat-number">${fmtCompact(policeFines)}</span> from police</h2><p>Camera-led enforcement is ${pct(cameraFines, cameraFines + policeFines)} of all fine-based detection.</p>`;
  if (selectedJurisdiction) {
    const jSlope = slopePairs.find((s) => s.jurisdiction === selectedJurisdiction);
    if (el("stat-slope")) el("stat-slope").innerHTML = `<h2>In <span class="stat-number">${selectedJurisdiction}</span>: ${jSlope ? fmtCompact(Math.round(jSlope.second)) : "0"} actions/year in the second half</h2><p>${jSlope && jSlope.first ? "Up from " + fmtCompact(Math.round(jSlope.first)) + " in the first half." : "Not enough data for trend."}</p>`;
  } else {
    if (el("stat-slope")) el("stat-slope").innerHTML = `<h2><span class="stat-number">${topSlope ? topSlope.jurisdiction : "—"}</span> has the highest average in the second half</h2><p>With ${topSlope ? fmtCompact(Math.round(topSlope.second)) : "0"} actions per year, up from ${topSlope ? fmtCompact(Math.round(topSlope.first)) : "0"} in the first half.</p>`;
  }

  const compItems = [
    ["speeding fines", speedFines],
    ["mobile phone", mobileFines],
    ["seatbelt", seatbeltFines],
    ["unlicensed driving", unlicensedActions],
  ].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

  if (!compItems.length) {
    if (el("stat-comparison")) el("stat-comparison").innerHTML = `<h2>No offence comparison data available</h2><p>No non-zero offence totals in the selected filters.</p>`;
  } else {
    const [topName, topVal] = compItems[0];
    const rest = compItems.slice(1, 3).map(([n, v]) => `<span class="stat-number">${fmtCompact(v)}</span> ${n}`).join(", ");
    if (el("stat-comparison")) el("stat-comparison").innerHTML = `<h2><span class="stat-number">${fmtCompact(topVal)}</span> ${topName}${rest ? ", " + rest : ""}</h2><p>Only non-zero offence categories are shown for the current filters.</p>`;
  }
}

function updateBreathStatCallouts(records) {
  const ctx = getFilterContext(records, state.filters);
  const total = records.reduce((s, r) => s + r.count, 0);
  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const yearRange = years.length ? `${years[0]}–${years[years.length - 1]}` : "no data";
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))];

  const byJurisdiction = {};
  records.forEach((r) => { byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + r.count; });
  const top = Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1])[0];

  const byYear = {};
  records.forEach((r) => { byYear[r.series_year] = (byYear[r.series_year] || 0) + r.count; });
  const peakYear = Object.entries(byYear).sort((a, b) => b[1] - a[1])[0];
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const firstVal = byYear[firstYear] || 0;
  const lastVal = byYear[lastYear] || 0;
  const change = firstVal ? (((lastVal - firstVal) / firstVal) * 100).toFixed(0) : 0;

  const byAge = {};
  records.forEach((r) => { if (r.age_group !== "All ages" && r.age_group !== "Unknown") byAge[r.age_group] = (byAge[r.age_group] || 0) + r.count; });
  const topAge = Object.entries(byAge).sort((a, b) => b[1] - a[1])[0];

  const byYearJurisdiction = {};
  records.forEach((r) => { const key = `${r.series_year}-${r.jurisdiction}`; byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.count; });
  const midIdx = Math.floor(years.length / 2);
  const firstHalf = years.slice(0, midIdx);
  const secondHalf = years.slice(midIdx);
  const slopePairs = jurisdictions.map((j) => {
    const firstAvg = firstHalf.reduce((s, y) => s + (byYearJurisdiction[`${y}-${j}`] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, y) => s + (byYearJurisdiction[`${y}-${j}`] || 0), 0) / secondHalf.length;
    return { jurisdiction: j, first: firstAvg, second: secondAvg };
  }).sort((a, b) => b.second - a.second);
  const topSlope = slopePairs[0];

  const el = (id) => document.getElementById(id);

  if (ctx.allZero) {
    if (el("stat-map")) el("stat-map").innerHTML = `<h2>No positive breath tests recorded for selected filters</h2><p>Try adjusting your filters to see data.</p>`;
    if (el("stat-trend")) el("stat-trend").innerHTML = `<h2>No trend data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-jurisdictions")) el("stat-jurisdictions").innerHTML = `<h2>No jurisdiction data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-age")) el("stat-age").innerHTML = `<h2>No age data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-slope")) el("stat-slope").innerHTML = `<h2>No slope data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-indexed")) el("stat-indexed").innerHTML = `<h2>No indexed data available</h2><p>No records match your current filters.</p>`;
    return;
  }

  let mapHtml, trendHtml, jurisdictionsHtml, ageHtml;
  const selectedJurisdiction = state.filters.jurisdiction !== "all" ? state.filters.jurisdiction : null;
  const selectedAge = state.filters.ageGroup !== "all" ? state.filters.ageGroup : null;

  if (selectedJurisdiction) {
    const jTotal = byJurisdiction[selectedJurisdiction] || 0;
    const jByYear = {};
    records.filter(r => r.jurisdiction === selectedJurisdiction).forEach(r => { jByYear[r.series_year] = (jByYear[r.series_year] || 0) + r.count; });
    const jFirst = jByYear[firstYear] || 0;
    const jLast = jByYear[lastYear] || 0;
    const jChange = jFirst ? (((jLast - jFirst) / jFirst) * 100).toFixed(0) : 0;
    mapHtml = `<h2>In <span class="stat-number">${selectedJurisdiction}</span>, positives <span class="stat-number">${parseInt(jChange) >= 0 ? "rose" : "fell"} ${Math.abs(jChange)}%</span></h2><p>From ${fmtCompact(jFirst)} in ${firstYear} to ${fmtCompact(jLast)} in ${lastYear}.</p>`;
  } else {
    mapHtml = `<h2><span class="stat-number">${fmtCompact(total)}</span> positive breath tests from ${yearRange}</h2><p>Across ${jurisdictions.length} jurisdictions. ${top ? top[0] + " accounts for " + pct(top[1], total) + " of all positives." : ""}</p>`;
  }

  trendHtml = `<h2>Positives <span class="stat-number">${parseInt(change) >= 0 ? "rose" : "fell"} ${Math.abs(change)}%</span> from ${firstYear} to ${lastYear}</h2><p>From ${fmtCompact(firstVal)} in ${firstYear} to ${fmtCompact(lastVal)} in ${lastYear}. Peak was ${peakYear ? peakYear[0] : "unknown"} with ${peakYear ? fmtCompact(peakYear[1]) : "0"}.</p>`;

  if (selectedJurisdiction) {
    jurisdictionsHtml = `<h2><span class="stat-number">${selectedJurisdiction}</span> has <span class="stat-number">${fmtCompact(total)}</span> positives</h2><p>Across ${years.length} years of data.</p>`;
  } else {
    jurisdictionsHtml = `<h2><span class="stat-number">${top ? top[0] : "—"}</span> recorded <span class="stat-number">${fmtCompact(top ? top[1] : 0)}</span> positives</h2><p>The highest of ${jurisdictions.length} jurisdictions over ${yearRange}.</p>`;
  }

  if (selectedAge) {
    const ageTotal = byAge[selectedAge] || 0;
    ageHtml = `<h2>Viewing data for <span class="stat-number">${selectedAge}</span> only</h2><p>Select "All ages" to compare age groups.</p>`;
  } else {
    ageHtml = `<h2>The <span class="stat-number">${topAge ? topAge[0] : "unknown"}</span> age group has the most detections</h2><p>With ${topAge ? fmtCompact(topAge[1]) : "0"} positive tests, ${topAge ? pct(topAge[1], total) : "0"} of the total.</p>`;
  }

  if (el("stat-map")) el("stat-map").innerHTML = mapHtml;
  if (el("stat-trend")) el("stat-trend").innerHTML = trendHtml;
  if (el("stat-jurisdictions")) el("stat-jurisdictions").innerHTML = jurisdictionsHtml;
  if (el("stat-age")) el("stat-age").innerHTML = ageHtml;
  if (selectedJurisdiction) {
    const jSlope = slopePairs.find((s) => s.jurisdiction === selectedJurisdiction);
    if (el("stat-slope")) el("stat-slope").innerHTML = `<h2>In <span class="stat-number">${selectedJurisdiction}</span>: ${jSlope ? fmtCompact(Math.round(jSlope.second)) : "0"} average positives/year in the second half</h2><p>${jSlope && jSlope.first ? "Up from " + fmtCompact(Math.round(jSlope.first)) + " average positives/year in the first half." : "Not enough data for trend."}</p>`;
  } else {
    if (el("stat-slope")) el("stat-slope").innerHTML = `<h2><span class="stat-number">${topSlope ? topSlope.jurisdiction : "—"}</span> has the highest average positives/year in the second half</h2><p>With ${topSlope ? fmtCompact(Math.round(topSlope.second)) : "0"} average positives/year, up from ${topSlope ? fmtCompact(Math.round(topSlope.first)) : "0"} in the first half.</p>`;
  }
  if (el("stat-indexed")) el("stat-indexed").innerHTML = `<h2>Indexed change since ${firstYear}</h2><p>Positive breath tests are indexed to ${firstYear} = 100. Values above 100 show growth, below 100 show decline.</p>`;
}

function updateDrugStatCallouts(records) {
  const ctx = getFilterContext(records, state.filters);
  const total = records.reduce((s, r) => s + r.count, 0);
  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const yearRange = years.length ? `${years[0]}–${years[years.length - 1]}` : "no data";
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))];

  const byJurisdiction = {};
  records.forEach((r) => { byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + r.count; });
  const top = Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1])[0];

  const byYear = {};
  records.forEach((r) => { byYear[r.series_year] = (byYear[r.series_year] || 0) + r.count; });
  const peakYear = Object.entries(byYear).sort((a, b) => b[1] - a[1])[0];
  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const firstVal = byYear[firstYear] || 0;
  const lastVal = byYear[lastYear] || 0;
  const change = firstVal ? (((lastVal - firstVal) / firstVal) * 100).toFixed(0) : 0;

  let cannabisCount = 0, amphetamineCount = 0, methylCount = 0;
  records.forEach((r) => {
    if (r.cannabis_detected) cannabisCount++;
    if (r.amphetamine_detected) amphetamineCount++;
    if (r.methylamphetamine_detected) methylCount++;
  });

  const byYearJurisdiction = {};
  records.forEach((r) => { const key = `${r.series_year}-${r.jurisdiction}`; byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.count; });
  const midIdx = Math.floor(years.length / 2);
  const firstHalf = years.slice(0, midIdx);
  const secondHalf = years.slice(midIdx);
  const slopePairs = jurisdictions.map((j) => {
    const firstAvg = firstHalf.reduce((s, y) => s + (byYearJurisdiction[`${y}-${j}`] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, y) => s + (byYearJurisdiction[`${y}-${j}`] || 0), 0) / secondHalf.length;
    return { jurisdiction: j, first: firstAvg, second: secondAvg };
  }).sort((a, b) => b.second - a.second);
  const topSlope = slopePairs[0];

  const el = (id) => document.getElementById(id);

  if (ctx.allZero) {
    if (el("stat-map")) el("stat-map").innerHTML = `<h2>No positive drug tests recorded for selected filters</h2><p>Try adjusting your filters to see data.</p>`;
    if (el("stat-trend")) el("stat-trend").innerHTML = `<h2>No trend data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-substances")) el("stat-substances").innerHTML = `<h2>No substance data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-stages")) el("stat-stages").innerHTML = `<h2>No stage data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-jurisdictions")) el("stat-jurisdictions").innerHTML = `<h2>No jurisdiction data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-slope")) el("stat-slope").innerHTML = `<h2>No slope data available</h2><p>No records match your current filters.</p>`;
    if (el("stat-composition")) el("stat-composition").innerHTML = `<h2>No composition data available</h2><p>No records match your current filters.</p>`;
    return;
  }

  let mapHtml, trendHtml, substancesHtml, stagesHtml, jurisdictionsHtml, slopeHtml;
  const selectedJurisdiction = state.filters.jurisdiction !== "all" ? state.filters.jurisdiction : null;
  const selectedDetection = state.filters.detectionStage !== "all" ? state.filters.detectionStage : null;

  if (selectedJurisdiction) {
    const jTotal = byJurisdiction[selectedJurisdiction] || 0;
    const jByYear = {};
    records.filter(r => r.jurisdiction === selectedJurisdiction).forEach(r => { jByYear[r.series_year] = (jByYear[r.series_year] || 0) + r.count; });
    const jFirst = jByYear[firstYear] || 0;
    const jLast = jByYear[lastYear] || 0;
    const jChange = jFirst ? (((jLast - jFirst) / jFirst) * 100).toFixed(0) : 0;
    mapHtml = `<h2>In <span class="stat-number">${selectedJurisdiction}</span>, detections <span class="stat-number">${parseInt(jChange) >= 0 ? "grew" : "fell"} ${Math.abs(jChange)}%</span></h2><p>From ${fmtCompact(jFirst)} in ${firstYear} to ${fmtCompact(jLast)} in ${lastYear}.</p>`;
  } else {
    mapHtml = `<h2><span class="stat-number">${fmtCompact(total)}</span> positive drug tests from ${yearRange}</h2><p>Across ${jurisdictions.length} jurisdictions. ${top ? top[0] + " leads with " + pct(top[1], total) + " of all detections." : ""}</p>`;
  }

  trendHtml = `<h2>Drug detections <span class="stat-number">${parseInt(change) >= 0 ? "grew" : "fell"} ${Math.abs(change)}%</span> from ${firstYear} to ${lastYear}</h2><p>From ${fmtCompact(firstVal)} in ${firstYear} to ${fmtCompact(lastVal)} in ${lastYear}. Peak was ${peakYear ? peakYear[0] : "unknown"} with ${peakYear ? fmtCompact(peakYear[1]) : "0"}.</p>`;

  if (selectedDetection) {
    stagesHtml = `<h2>Selected detection stage accounts for <span class="stat-number">100%</span> of filtered detections</h2><p>${fmtCompact(total)} total detections for ${selectedDetection}.</p>`;
  } else {
    stagesHtml = `<h2>Indicator screening versus confirmatory tests</h2><p>Stage 1 roadside screening produces the bulk of detections. Confirmatory tests validate the results.</p>`;
  }

  substancesHtml = `<h2>Cannabis detected in <span class="stat-number">${fmtCompact(cannabisCount)}</span> records, methamphetamine in <span class="stat-number">${fmtCompact(methylCount)}</span></h2><p>Amphetamine in ${fmtCompact(amphetamineCount)} records. Cannabis remains the most commonly detected substance.</p>`;

  if (selectedJurisdiction) {
    jurisdictionsHtml = `<h2><span class="stat-number">${selectedJurisdiction}</span> has <span class="stat-number">${fmtCompact(total)}</span> detections</h2><p>Across ${years.length} years of data.</p>`;
  } else {
    jurisdictionsHtml = `<h2><span class="stat-number">${top ? top[0] : "—"}</span> leads with <span class="stat-number">${fmtCompact(top ? top[1] : 0)}</span> positive detections</h2><p>The highest of ${jurisdictions.length} jurisdictions over ${yearRange}.</p>`;
  }

  if (selectedJurisdiction) {
    const jSlope = slopePairs.find(s => s.jurisdiction === selectedJurisdiction);
    slopeHtml = `<h2>In <span class="stat-number">${selectedJurisdiction}</span>: ${jSlope ? Math.round(jSlope.second) : 0} per year (second half)</h2><p>${jSlope && jSlope.first ? "Up from " + Math.round(jSlope.first) + " in the first half." : "Not enough data for trend."}</p>`;
  } else {
    slopeHtml = `<h2><span class="stat-number">${topSlope ? topSlope.jurisdiction : "—"}</span> has the highest average in the second half</h2><p>With ${topSlope ? fmtCompact(Math.round(topSlope.second)) : "0"} detections per year, up from ${topSlope ? fmtCompact(Math.round(topSlope.first)) : "0"} in the first half.</p>`;
  }

  if (el("stat-map")) el("stat-map").innerHTML = mapHtml;
  if (el("stat-trend")) el("stat-trend").innerHTML = trendHtml;
  if (el("stat-substances")) el("stat-substances").innerHTML = substancesHtml;
  if (el("stat-stages")) el("stat-stages").innerHTML = stagesHtml;
  if (el("stat-jurisdictions")) el("stat-jurisdictions").innerHTML = jurisdictionsHtml;
  if (el("stat-slope")) el("stat-slope").innerHTML = slopeHtml;
  if (el("stat-composition")) el("stat-composition").innerHTML = `<h2>How the mix of detected substances has shifted</h2><p>Cannabis consistently leads, but methamphetamine detections have grown in recent years.</p>`;
}

/* ========== HOME ========== */
function renderHome() {
  const datasets = state.catalog.datasets.filter((d) => d.status === "ready");
  const aboutEntry = state.catalog.datasets.find((d) => d.key === "about");

  const fines = state.summaries.fines;
  const breath = state.summaries["breath-tests"];
  const drug = state.summaries["drug-tests"];

  const summaries = [fines, breath, drug].filter(Boolean);
  const totalRecords = summaries.reduce((s, item) => s + (item.record_count || 0), 0);
  const totalActions = summaries.reduce((s, item) => s + (item.totals?.total_actions || 0), 0);
  const totalPositiveTests = (breath?.totals?.total_positive_tests || 0) + (drug?.totals?.total_positive_tests || 0);

  const coverageStart = Math.min(
    ...summaries.map((item) => parseInt(String(item.period_coverage?.start || "2008").slice(0, 4), 10))
  );
  const coverageEnd = Math.max(...summaries.map((item) => item.latest_year || 2024));

  app.innerHTML = `
    <div class="home-overview">
      <div class="home-header">
        <h1>Australian road safety enforcement data</h1>
        <p>This site combines BITRE road safety enforcement datasets into one place so you can compare trends across fines, positive breath tests, and positive drug tests by year and jurisdiction.</p>
      </div>
      <div class="home-kpis">
        <div class="home-kpi">
          <div class="home-kpi-label">Coverage</div>
          <div class="home-kpi-value">${coverageStart}-${coverageEnd}</div>
          <div class="home-kpi-sub">National reporting period</div>
        </div>
        <div class="home-kpi">
          <div class="home-kpi-label">Records cleaned</div>
          <div class="home-kpi-value">${fmtCompact(totalRecords)}</div>
          <div class="home-kpi-sub">Across ${datasets.length} ready datasets</div>
        </div>
        <div class="home-kpi">
          <div class="home-kpi-label">Total actions</div>
          <div class="home-kpi-value">${fmtCompact(totalActions)}</div>
          <div class="home-kpi-sub">Fines, charges, arrests, and tests</div>
        </div>
        <div class="home-kpi">
          <div class="home-kpi-label">Positive tests</div>
          <div class="home-kpi-value">${fmtCompact(totalPositiveTests)}</div>
          <div class="home-kpi-sub">Breath + drug positives combined</div>
        </div>
      </div>
    </div>

    <div class="home-section-intro">
      <h2>Explore the datasets</h2>
      <p>Choose a dataset below to see trends over time, geographic patterns, and filterable breakdowns by jurisdiction and category.</p>
    </div>

    <div class="dataset-grid">
      ${datasets.map((d) => `
        <a href="#/${d.key}" class="dataset-card">
          <div class="dataset-card-icon" style="background:${d.color}22;color:${d.color}">${getIcon(d.icon)}</div>
          <h3>${d.title}</h3>
          <p>${d.description}</p>
          <div class="dataset-card-meta">
            <span><span class="status-dot"></span> ${d.reference_period}</span>
            <span>${d.category}</span>
            <span>Updated to 2024</span>
          </div>
        </a>
      `).join("")}
      ${aboutEntry ? `
        <a href="#/about" class="dataset-card">
          <div class="dataset-card-icon" style="background:${aboutEntry.color}22;color:${aboutEntry.color}">${getIcon(aboutEntry.icon)}</div>
          <h3>${aboutEntry.title}</h3>
          <p>${aboutEntry.description}</p>
          <div class="dataset-card-meta"><span>Methodology and sources</span></div>
        </a>
      ` : ""}
    </div>

    <div class="home-footnote">
      <p>Data source: Bureau of Infrastructure and Transport Research Economics (BITRE), National Road Safety Data Hub. Figures are indicative and depend on jurisdiction reporting practices.</p>
    </div>
  `;
}

function getIcon(type) {
  return { fines: "⚡", breath: "🫁", drug: "💊", about: "ℹ" }[type] || "📊";
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
    { id: "map", title: "Geographic view" },
    { id: "trend", title: "Over time" },
    { id: "metrics", title: "Offence breakdown" },
    { id: "jurisdictions", title: "By jurisdiction" },
    { id: "detection", title: "Detection methods" },
    { id: "slope", title: "Year-over-year shift" },
    { id: "comparison", title: "Offences compared" },
  ];

  state.filters.yearStart = years[0];
  state.filters.yearEnd = summary.latest_year;

  app.innerHTML = `
    <div class="dataset-page">
      <nav class="toc-sidebar">
        <h4>Sections</h4>
        ${sections.map((s) => `<a href="#" class="toc-link" data-target="${s.id}">${s.title}</a>`).join("")}
      </nav>
      <div class="dataset-content">
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
        <div class="chart-section" id="map">
          <div class="stat-callout" id="stat-map"></div>
          <h3>Enforcement across Australia</h3>
          <p class="chart-desc">Geographic heatmap showing total enforcement actions by jurisdiction. Larger shapes indicate higher volume.</p>
          <div class="chart-container"><canvas id="fines-map"></canvas></div>
        </div>
        <div class="chart-section" id="trend">
          <div class="stat-callout" id="stat-trend"></div>
          <h3>Enforcement actions over time</h3>
          <p class="chart-desc">Annual total of fines, charges, and arrests. Note the reporting change in 2023.</p>
          <div class="chart-container"><canvas id="fines-trend"></canvas></div>
        </div>
        <div class="chart-section" id="metrics">
          <div class="stat-callout" id="stat-metrics"></div>
          <h3>Which offences dominate the record</h3>
          <p class="chart-desc">Total actions by metric across the selected period.</p>
          <div class="chart-container"><canvas id="fines-metrics"></canvas></div>
        </div>
        <div class="chart-section" id="jurisdictions">
          <div class="stat-callout" id="stat-jurisdictions"></div>
          <h3>Enforcement by jurisdiction</h3>
          <p class="chart-desc">Annual totals for each state and territory.</p>
          <div class="chart-container"><canvas id="fines-jurisdictions"></canvas></div>
        </div>
        <div class="chart-section" id="detection">
          <div class="stat-callout" id="stat-detection"></div>
          <h3>How offences are detected</h3>
          <p class="chart-desc">Camera-led versus police-issued fines.</p>
          <div class="chart-container"><canvas id="fines-detection"></canvas></div>
        </div>
        <div class="chart-section" id="slope">
          <div class="stat-callout" id="stat-slope"></div>
          <h3>How enforcement shifted between halves</h3>
          <p class="chart-desc">Slope chart comparing the first half versus second half of the selected period. Lines crossing show rank changes.</p>
          <div class="chart-container"><svg id="fines-slope"></svg></div>
        </div>
        <div class="chart-section" id="comparison">
          <div class="stat-callout" id="stat-comparison"></div>
          <h3>Speeding versus other offences</h3>
          <p class="chart-desc">Annual comparison of the three main offence types.</p>
          <div class="chart-container"><canvas id="fines-comparison"></canvas></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("fines-year-start").value = years[0];
  document.getElementById("fines-year-end").value = summary.latest_year;

  bindFinesFilters(records, summary);
  bindTocNavigation();
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

  updateFinesStatCallouts(filtered);
  updateFinesStats(filtered);
  destroyCharts();
  drawFinesMap(filtered);
  drawFinesTrend(filtered);
  drawFinesMetrics(filtered);
  drawFinesJurisdictions(filtered);
  drawFinesDetection(filtered);
  drawFinesSlope(filtered);
  drawFinesComparison(filtered);
}

function updateFinesStats(records) {
  const totalActions = records.reduce((s, r) => s + r.total_actions, 0);
  const totalFines = records.reduce((s, r) => s + r.fines, 0);
  const totalCharges = records.reduce((s, r) => s + r.charges, 0);
  const totalArrests = records.reduce((s, r) => s + r.arrests, 0);
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].length;
  const years = [...new Set(records.map((r) => r.series_year))].length;

  const statRow = document.getElementById("stat-row");
  if (!statRow) return;

  const valueOrNoData = (value) => (value > 0 ? fmtCompact(value) : "No data");
  const shareOrNoData = (value) => (value > 0 ? `${pct(value, totalActions)} of actions` : "Not reported in selected filters");

  statRow.innerHTML = `
    <div class="stat-box"><div class="stat-label">Total actions</div><div class="stat-value">${fmtCompact(totalActions)}</div><div class="stat-sub">${years} years, ${jurisdictions} jurisdictions</div></div>
    <div class="stat-box"><div class="stat-label">Fines</div><div class="stat-value">${fmtCompact(totalFines)}</div><div class="stat-sub">${pct(totalFines, totalActions)} of actions</div></div>
    <div class="stat-box"><div class="stat-label">Charges</div><div class="stat-value">${valueOrNoData(totalCharges)}</div><div class="stat-sub">${shareOrNoData(totalCharges)}</div></div>
    <div class="stat-box"><div class="stat-label">Arrests</div><div class="stat-value">${valueOrNoData(totalArrests)}</div><div class="stat-sub">${shareOrNoData(totalArrests)}</div></div>
  `;
}

function drawFinesMap(records) {
  drawAustraliaChoropleth({
    canvasId: "fines-map",
    records,
    valueAccessor: (r) => r.total_actions,
    hue: 200,
    title: "Enforcement actions",
    valueLabel: "actions",
  });
}

function renderSingleJurisdictionSlope(svg, opts) {
  const {
    jurisdiction,
    firstLabel,
    secondLabel,
    firstAvg,
    secondAvg,
    unitLabel = "avg/year",
  } = opts;

  const change = secondAvg - firstAvg;
  const pctChange = firstAvg > 0 ? ((change / firstAvg) * 100).toFixed(1) : "0.0";
  const isRising = change > 0;
  const barMax = Math.max(firstAvg, secondAvg, 1);
  const width = 760;
  const height = 260;
  const centerX = width / 2;
  const groupGap = 300;
  const leftX = centerX - groupGap / 2;
  const rightX = centerX + groupGap / 2;
  const barY = 190;
  const barH = 16;
  const barMaxW = 200;
  const firstBarW = (firstAvg / barMax) * barMaxW;
  const secondBarW = (secondAvg / barMax) * barMaxW;

  svg.innerHTML = `
    <text x="${width / 2}" y="34" text-anchor="middle" font-size="16" font-weight="700" fill="#f1f5f9">${jurisdiction} - Change Over Time</text>
    <text x="${leftX}" y="72" text-anchor="middle" font-size="12" fill="#94a3b8">${firstLabel}</text>
    <text x="${rightX}" y="72" text-anchor="middle" font-size="12" fill="#94a3b8">${secondLabel}</text>

    <text x="${leftX}" y="108" text-anchor="middle" font-size="26" font-weight="700" fill="#f1f5f9">${fmtCompact(Math.round(firstAvg))}</text>
    <text x="${rightX}" y="108" text-anchor="middle" font-size="26" font-weight="700" fill="#f1f5f9">${fmtCompact(Math.round(secondAvg))}</text>

    <text x="${(leftX + rightX) / 2}" y="112" text-anchor="middle" font-size="24" font-weight="700" fill="${isRising ? "#34d399" : "#f87171"}">${isRising ? "↑" : "↓"} ${Math.abs(pctChange)}%</text>

    <text x="${leftX}" y="126" text-anchor="middle" font-size="11" fill="#64748b">${unitLabel}</text>
    <text x="${rightX}" y="126" text-anchor="middle" font-size="11" fill="#64748b">${unitLabel}</text>

    <rect x="${leftX - barMaxW / 2}" y="${barY}" width="${barMaxW}" height="${barH}" rx="5" fill="#0f172a"/>
    <rect x="${rightX - barMaxW / 2}" y="${barY}" width="${barMaxW}" height="${barH}" rx="5" fill="#0f172a"/>
    <rect x="${leftX - barMaxW / 2}" y="${barY}" width="${firstBarW}" height="${barH}" rx="5" fill="#38bdf8"/>
    <rect x="${rightX - barMaxW / 2}" y="${barY}" width="${secondBarW}" height="${barH}" rx="5" fill="${isRising ? "#34d399" : "#f87171"}"/>
  `;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.width = "100%";
  svg.style.height = "280px";
}

function drawFinesSlope(records) {
  const svg = document.getElementById("fines-slope");
  if (!svg) return;

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  if (years.length < 2) { svg.innerHTML = `<p style="color:#64748b;padding:40px;text-align:center">Need at least 2 years of data</p>`; return; }

  const midIdx = Math.floor(years.length / 2);
  const firstHalf = years.slice(0, midIdx);
  const secondHalf = years.slice(midIdx);

  const byJurisdiction = {};
  records.forEach((r) => {
    if (!byJurisdiction[r.jurisdiction]) byJurisdiction[r.jurisdiction] = {};
    byJurisdiction[r.jurisdiction][r.series_year] = (byJurisdiction[r.jurisdiction][r.series_year] || 0) + r.total_actions;
  });

  const jurisdictions = Object.keys(byJurisdiction);

  if (jurisdictions.length === 1) {
    const j = jurisdictions[0];
    const firstAvg = firstHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / secondHalf.length;
    renderSingleJurisdictionSlope(svg, {
      jurisdiction: j,
      firstLabel: `${firstHalf[0]}-${firstHalf[firstHalf.length - 1]} (avg/yr)`,
      secondLabel: `${secondHalf[0]}-${secondHalf[secondHalf.length - 1]} (avg/yr)`,
      firstAvg,
      secondAvg,
    });
    return;
  }

  const pairs = jurisdictions.map((j) => {
    const firstAvg = firstHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / secondHalf.length;
    return { jurisdiction: j, first: firstAvg, second: secondAvg };
  }).sort((a, b) => b.first - a.first);

  const width = 700, height = 450;
  const pad = { top: 30, right: 100, bottom: 30, left: 100 };
  const innerW = width - pad.left - pad.right;
  const maxVal = Math.max(...pairs.map((p) => Math.max(p.first, p.second)), 1);

  function yPos(val) {
    return pad.top + (1 - val / maxVal) * (height - pad.top - pad.bottom);
  }


  const leftY = {};
  const rightY = {};
  const minGap = 14;
  const labelTop = pad.top + 8;
  const labelBottom = height - pad.bottom - 6;
  const lArr = pairs.map(p => ({ j: p.jurisdiction, y: yPos(p.first) })).sort((a,b) => a.y - b.y);
  const rArr = pairs.map(p => ({ j: p.jurisdiction, y: yPos(p.second) })).sort((a,b) => a.y - b.y);
  const relax = (arr) => {
    for(let k=0; k<15; k++) {
      for(let i=0; i<arr.length-1; i++) {
        if (arr[i+1].y - arr[i].y < minGap) {
          const shift = (minGap - (arr[i+1].y - arr[i].y)) / 2;
          arr[i].y -= shift;
          arr[i+1].y += shift;
        }
      }
    }
    for (let k = 0; k < 4; k++) {
      if (!arr.length) return;
      arr[0].y = Math.max(arr[0].y, labelTop);
      for (let i = 1; i < arr.length; i++) {
        arr[i].y = Math.max(arr[i].y, arr[i - 1].y + minGap);
      }
      arr[arr.length - 1].y = Math.min(arr[arr.length - 1].y, labelBottom);
      for (let i = arr.length - 2; i >= 0; i--) {
        arr[i].y = Math.min(arr[i].y, arr[i + 1].y - minGap);
      }
    }
  };
  relax(lArr); relax(rArr);
  lArr.forEach(item => leftY[item.j] = item.y);
  rArr.forEach(item => rightY[item.j] = item.y);

  let markup = `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="#334155" stroke-width="1"/>`;
  markup += `<line x1="${pad.left + innerW}" y1="${pad.top}" x2="${pad.left + innerW}" y2="${height - pad.bottom}" stroke="#334155" stroke-width="1"/>`;
  markup += `<text x="${pad.left}" y="${pad.top - 12}" font-size="11" fill="#94a3b8">${firstHalf[0]}–${firstHalf[firstHalf.length - 1]} (avg)</text>`;
  markup += `<text x="${pad.left + innerW}" y="${pad.top - 12}" font-size="11" fill="#94a3b8" text-anchor="end">${secondHalf[0]}–${secondHalf[secondHalf.length - 1]} (avg)</text>`;

  pairs.forEach((p) => {
    const y1 = yPos(p.first);
    const y2 = yPos(p.second);
    const color = JURISDICTION_COLORS[p.jurisdiction] || "#38bdf8";
    const rising = p.second > p.first;
    markup += `<line x1="${pad.left}" y1="${y1}" x2="${pad.left + innerW}" y2="${y2}" stroke="${color}" stroke-width="2" opacity="0.7"/>`;
    markup += `<circle cx="${pad.left}" cy="${y1}" r="4" fill="${color}"/>`;
    markup += `<circle cx="${pad.left + innerW}" cy="${y2}" r="4" fill="${color}"/>`;
    markup += `<text x="${pad.left - 8}" y="${leftY[p.jurisdiction] + 4}" text-anchor="end" font-size="12" fill="#f1f5f9" font-weight="600">${p.jurisdiction}</text>`;
    markup += `<text x="${pad.left + innerW + 8}" y="${rightY[p.jurisdiction] + 4}" font-size="11" fill="${rising ? '#34d399' : '#f87171'}">${fmtCompact(Math.round(p.second))} ${rising ? '↑' : '↓'}</text>`;
  });

  svg.innerHTML = markup;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.height = "450px";
  svg.style.width = "100%";
}

function drawFinesTrend(records) {
  const annual = {};
  records.forEach((r) => {
    if (!annual[r.series_year]) annual[r.series_year] = { fines: 0, arrests: 0, charges: 0 };
    annual[r.series_year].fines += r.fines;
    annual[r.series_year].arrests += r.arrests;
    annual[r.series_year].charges += r.charges;
  });

  const totalValue = Object.values(annual).reduce((s, v) => s + v.fines + v.arrests + v.charges, 0);
  const years = Object.keys(annual).sort();
  const canvas = document.getElementById("fines-trend");
  if (!canvas) return;

  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  createChart(canvas, {
    type: "line",
    data: {
      labels: years,
      datasets: [
        { label: "Fines", yAxisID: "y", data: years.map((y) => annual[y].fines), borderColor: CHART_COLORS.primary, backgroundColor: CHART_COLORS.primary + "18", fill: true, tension: 0.3, pointRadius: years.length > 20 ? 0 : 4, pointHoverRadius: 7, borderWidth: 2.5 },
        { label: "Charges", yAxisID: "ySmall", data: years.map((y) => annual[y].charges), borderColor: CHART_COLORS.accent, backgroundColor: "transparent", tension: 0.3, pointRadius: years.length > 20 ? 0 : 3, pointHoverRadius: 6, borderWidth: 2.5 },
        { label: "Arrests", yAxisID: "ySmall", data: years.map((y) => annual[y].arrests), borderColor: CHART_COLORS.red, backgroundColor: "transparent", tension: 0.3, pointRadius: years.length > 20 ? 0 : 3, pointHoverRadius: 6, borderWidth: 2.5 },
      ],
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        y: { ...chartDefaults().scales.y, position: "left", ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) } },
        ySmall: {
          type: "linear",
          position: "right",
          ticks: { color: CHART_COLORS.text, font: { size: 12 }, callback: (v) => fmtCompact(v) },
          grid: { drawOnChartArea: false, color: CHART_COLORS.grid, drawBorder: false },
        },
      },
    }),
  });
}

function drawFinesMetrics(records) {
  const totals = {};
  records.forEach((r) => { totals[r.metric_label] = (totals[r.metric_label] || 0) + r.total_actions; });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const canvas = document.getElementById("fines-metrics");
  if (!canvas) return;

  if (sorted.length === 0 || sorted.every((s) => s[1] === 0)) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  const uniqueMetrics = [...new Set(records.map((r) => r.metric_label))];
  const isSingleMetric = uniqueMetrics.length === 1;
  const valueLabelsPlugin = {
    id: "valueLabels",
    afterDatasetsDraw(chart) {
      const { ctx, scales } = chart;
      const xScale = scales.x;
      const dataset = chart.data.datasets[0];
      ctx.save();
      ctx.font = "600 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textBaseline = "middle";
      chart.getDatasetMeta(0).data.forEach((bar, index) => {
        const raw = Number(dataset.data[index] || 0);
        const label = fmtCompact(raw);
        const textWidth = ctx.measureText(label).width;
        const barWidth = Math.abs(bar.base - bar.x);
        const fitsInside = barWidth > textWidth + 18;
        ctx.fillStyle = fitsInside ? "#f8fafc" : CHART_COLORS.text;
        ctx.textAlign = fitsInside ? "right" : "left";
        ctx.fillText(label, fitsInside ? bar.x - 10 : xScale.getPixelForValue(raw) + 8, bar.y);
      });
      ctx.restore();
    },
  };

  if (isSingleMetric) {
    const metricName = uniqueMetrics[0];
    const byYear = {};
    records.forEach((r) => { byYear[r.series_year] = (byYear[r.series_year] || 0) + r.total_actions; });
    const years = Object.keys(byYear).sort();

    createChart(canvas, {
      type: "bar",
      data: {
        labels: years,
        datasets: [{ data: years.map((y) => byYear[y]), backgroundColor: METRIC_COLORS[metricName] || CHART_COLORS.primary, borderRadius: 6, barThickness: 30 }],
      },
      plugins: [valueLabelsPlugin],
      options: chartDefaults({
        plugins: { ...chartDefaults().plugins, legend: { display: false }, title: { display: true, text: `${metricName} - Annual Trend`, color: CHART_COLORS.text, font: { size: 14 } } },
        scales: {
          ...chartDefaults().scales,
          y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) } },
        },
      }),
    });
    return;
  }

  const maxVal = Math.max(...sorted.map((s) => s[1]));
  const minVal = Math.min(...sorted.map((s) => s[1]));
  const useLogScale = maxVal / minVal > 100;

  createChart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{ data: sorted.map((s) => s[1]), backgroundColor: sorted.map((s) => METRIC_COLORS[s[0]] || CHART_COLORS.primary), borderRadius: 6, barThickness: 30 }],
    },
    plugins: [valueLabelsPlugin],
    options: chartDefaults({
      indexAxis: "y",
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: {
        ...chartDefaults().scales,
        x: {
          ...chartDefaults().scales.x,
          type: useLogScale ? "logarithmic" : "linear",
          min: useLogScale ? 1 : 0,
          ticks: {
            ...chartDefaults().scales.x.ticks,
            autoSkip: true,
            maxTicksLimit: useLogScale ? 6 : 10,
            callback: useLogScale ? (v) => fmtLogTick(Number(v)) : (v) => fmtCompact(v),
          },
        },
      },
    }),
  });
}

function drawFinesJurisdictions(records) {
  const byYearJurisdiction = {};
  records.forEach((r) => { const key = `${r.series_year}-${r.jurisdiction}`; byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.total_actions; });
  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].sort();
  const canvas = document.getElementById("fines-jurisdictions");
  if (!canvas) return;

  const totalValue = Object.values(byYearJurisdiction).reduce((s, v) => s + v, 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

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
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2.5,
      })),
    },
    options: chartDefaults({
      scales: { ...chartDefaults().scales, y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) } } },
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

  const metrics = [...new Set(records.map((r) => r.metric_label))].filter((m) => m !== "Unlicensed driving");
  const methods = [...new Set(records.map((r) => r.detection_method))].filter((m) => m !== "Not applicable" && m !== "Unknown");
  const methodColors = {
    "Fixed camera": "#38bdf8",
    "Mobile camera": "#a78bfa",
    "Police issued": "#fb923c",
    "Red light camera": "#34d399",
    "Fixed or mobile camera": "#f87171",
    "Average speed camera": "#fbbf24",
  };
  const metricTotals = {};
  metrics.forEach((metric) => {
    metricTotals[metric] = methods.reduce((sum, method) => sum + (byMetricMethod[`${metric}||${method}`] || 0), 0);
  });
  const canvas = document.getElementById("fines-detection");
  if (!canvas) return;

  if (metrics.length === 0 || methods.length === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  if (metrics.length === 1) {
    const metric = metrics[0];
    const methodTotals = methods
      .map((method) => ({ method, value: byMetricMethod[`${metric}||${method}`] || 0 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

    createChart(canvas, {
      type: "doughnut",
      data: {
        labels: methodTotals.map((d) => d.method),
        datasets: [{
          data: methodTotals.map((d) => d.value),
          backgroundColor: methodTotals.map((d) => methodColors[d.method] || CHART_COLORS.primary),
          borderColor: "#0f172a",
          borderWidth: 2,
          hoverOffset: 6,
        }],
      },
      options: chartDefaults({
        cutout: "58%",
        scales: {},
        plugins: {
          ...chartDefaults().plugins,
          tooltip: {
            ...chartDefaults().plugins.tooltip,
            callbacks: {
              label: (ctx) => {
                const total = methodTotals.reduce((s, d) => s + d.value, 0) || 1;
                const val = ctx.raw || 0;
                return `${ctx.label}: ${fmt(val)} (${((val / total) * 100).toFixed(1)}%)`;
              },
            },
          },
        },
      }),
    });
    return;
  }

  createChart(canvas, {
    type: "bar",
    data: {
      labels: metrics,
      datasets: methods.map((method) => ({
        label: method,
        data: metrics.map((metric) => {
          const total = metricTotals[metric] || 1;
          const val = byMetricMethod[`${metric}||${method}`] || 0;
          return (val / total) * 100;
        }),
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
          min: 0,
          max: 100,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => `${v}%` },
        },
      },
    }),
  });
}

function drawFinesComparison(records) {
  const annualMetric = {};
  records.forEach((r) => {
    if (!annualMetric[r.series_year]) annualMetric[r.series_year] = {};
    annualMetric[r.series_year][r.metric_label] = (annualMetric[r.series_year][r.metric_label] || 0) + r.total_actions;
  });

  const years = Object.keys(annualMetric).sort();
  const presentMetrics = [...new Set(records.map((r) => r.metric_label))];
  const preferredMetrics = ["Speeding fines", "Mobile phone use", "Seatbelt non-compliance"];
  let metricKeys = preferredMetrics.filter((m) => presentMetrics.includes(m));
  if (!metricKeys.length && presentMetrics.length) metricKeys = [presentMetrics[0]];
  const canvas = document.getElementById("fines-comparison");
  if (!canvas) return;

  const totalValue = Object.values(annualMetric).reduce((s, y) => s + Object.values(y).reduce((t, v) => t + v, 0), 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  if (metricKeys.length === 1) {
    const metric = metricKeys[0];
    createChart(canvas, {
      type: "bar",
      data: {
        labels: years,
        datasets: [{
          label: metric,
          data: years.map((y) => annualMetric[y]?.[metric] || 0),
          backgroundColor: (METRIC_COLORS[metric] || CHART_COLORS.primary) + "cc",
          borderRadius: 4,
          barThickness: "flex",
          maxBarThickness: 44,
        }],
      },
      options: chartDefaults({
        plugins: { ...chartDefaults().plugins, legend: { display: false } },
        scales: {
          ...chartDefaults().scales,
          y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) } },
        },
      }),
    });
    return;
  }

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
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2.5,
      })),
    },
    options: chartDefaults({
      scales: { ...chartDefaults().scales, y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) } } },
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
    { id: "map", title: "Geographic view" },
    { id: "trend", title: "Over time" },
    { id: "jurisdictions", title: "By jurisdiction" },
    { id: "age", title: "By age group" },
    { id: "slope", title: "Year-over-year shift" },
    { id: "indexed", title: "Indexed comparison" },
  ];

  state.filters.yearStart = years[0];
  state.filters.yearEnd = summary.latest_year;

  app.innerHTML = `
    <div class="dataset-page">
      <nav class="toc-sidebar">
        <h4>Sections</h4>
        ${sections.map((s) => `<a href="#" class="toc-link" data-target="${s.id}">${s.title}</a>`).join("")}
      </nav>
      <div class="dataset-content">
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
            <select id="breath-age-filter">${ageGroups.map((a) => `<option value="${a}">${a}</option>`).join("")}</select>
          </div>
        </div>
        <div class="stat-row" id="stat-row"></div>
        <div class="chart-section" id="map">
          <div class="stat-callout" id="stat-map"></div>
          <h3>Positive breath tests across Australia</h3>
          <p class="chart-desc">Geographic heatmap showing positive test volume by jurisdiction.</p>
          <div class="chart-container"><canvas id="breath-map"></canvas></div>
        </div>
        <div class="chart-section" id="trend">
          <div class="stat-callout" id="stat-trend"></div>
          <h3>Annual positive breath tests by jurisdiction</h3>
          <p class="chart-desc">Annual counts of positive breath tests, split by jurisdiction.</p>
          <div class="chart-container"><canvas id="breath-trend"></canvas></div>
        </div>
        <div class="chart-section" id="jurisdictions">
          <div class="stat-callout" id="stat-jurisdictions"></div>
          <h3>Which jurisdictions have the most positives</h3>
          <p class="chart-desc">Total positive tests by jurisdiction in the selected period.</p>
          <div class="chart-container"><canvas id="breath-jurisdictions"></canvas></div>
        </div>
        <div class="chart-section" id="age">
          <div class="stat-callout" id="stat-age"></div>
          <h3>Positives by age group</h3>
          <p class="chart-desc">How positive detections are distributed across age groups.</p>
          <div class="chart-container"><canvas id="breath-age-chart"></canvas></div>
        </div>
        <div class="chart-section" id="slope">
          <div class="stat-callout" id="stat-slope"></div>
          <h3>Average annual positives: first half vs second half</h3>
          <p class="chart-desc">Slope chart comparing average annual positive breath tests in each jurisdiction across the first and second halves of the selected period.</p>
          <div class="chart-container"><svg id="breath-slope"></svg></div>
        </div>
        <div class="chart-section" id="indexed">
          <div class="stat-callout" id="stat-indexed"></div>
          <h3>Indexed jurisdiction trends</h3>
          <p class="chart-desc">Positive breath tests indexed to the first year selected, where first year = 100.</p>
          <div class="chart-container"><canvas id="breath-indexed"></canvas></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("breath-year-start").value = years[0];
  document.getElementById("breath-year-end").value = summary.latest_year;

  bindBreathFilters(records, summary);
  bindTocNavigation();
  updateBreathView(records, summary);
}

function bindBreathFilters(records, summary) {
  const update = () => {
    state.filters.yearStart = document.getElementById("breath-year-start").value;
    state.filters.yearEnd = document.getElementById("breath-year-end").value;
    state.filters.jurisdiction = document.getElementById("breath-jurisdiction").value;
    state.filters.ageGroup = document.getElementById("breath-age-filter").value;
    updateBreathView(records, summary);
  };
  ["breath-year-start", "breath-year-end", "breath-jurisdiction", "breath-age-filter"].forEach(
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

  updateBreathStatCallouts(filtered);
  updateBreathStats(filtered);
  destroyCharts();
  drawBreathMap(filtered);
  drawBreathTrend(filtered);
  drawBreathJurisdictions(filtered);
  drawBreathAge(filtered);
  drawBreathSlope(filtered);
  drawBreathIndexed(filtered);
}

function updateBreathStats(records) {
  const total = records.reduce((s, r) => s + r.count, 0);
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].length;
  const years = [...new Set(records.map((r) => r.series_year))].length;
  const byJurisdiction = {};
  records.forEach((r) => { byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + r.count; });
  const top = Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1])[0];

  const statRow = document.getElementById("stat-row");
  if (!statRow) return;
  statRow.innerHTML = `
    <div class="stat-box"><div class="stat-label">Total positives</div><div class="stat-value">${fmtCompact(total)}</div><div class="stat-sub">${years} years</div></div>
    <div class="stat-box"><div class="stat-label">Jurisdictions</div><div class="stat-value">${jurisdictions}</div><div class="stat-sub">States and territories</div></div>
    <div class="stat-box"><div class="stat-label">Highest</div><div class="stat-value">${top ? top[0] : "—"}</div><div class="stat-sub">${top ? fmtCompact(top[1]) : ""} total</div></div>
    <div class="stat-box"><div class="stat-label">Records</div><div class="stat-value">${fmt(records.length)}</div><div class="stat-sub">Annual data points</div></div>
  `;
}

function drawBreathMap(records) {
  drawAustraliaChoropleth({
    canvasId: "breath-map",
    records,
    valueAccessor: (r) => r.count,
    hue: 240,
    title: "Positive breath tests",
    valueLabel: "positive tests",
  });
}

function drawBreathSlope(records) {
  const svg = document.getElementById("breath-slope");
  if (!svg) return;

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  if (years.length < 2) { svg.innerHTML = `<p style="color:#64748b;padding:40px;text-align:center">Need at least 2 years</p>`; return; }

  const midIdx = Math.floor(years.length / 2);
  const firstHalf = years.slice(0, midIdx);
  const secondHalf = years.slice(midIdx);

  const byJurisdiction = {};
  records.forEach((r) => {
    if (!byJurisdiction[r.jurisdiction]) byJurisdiction[r.jurisdiction] = {};
    byJurisdiction[r.jurisdiction][r.series_year] = (byJurisdiction[r.jurisdiction][r.series_year] || 0) + r.count;
  });

  const jurisdictions = Object.keys(byJurisdiction);

  if (jurisdictions.length === 1) {
    const j = jurisdictions[0];
    const firstAvg = firstHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / secondHalf.length;
    renderSingleJurisdictionSlope(svg, {
      jurisdiction: j,
      firstLabel: `${firstHalf[0]}-${firstHalf[firstHalf.length - 1]} (avg/yr)`,
      secondLabel: `${secondHalf[0]}-${secondHalf[secondHalf.length - 1]} (avg/yr)`,
      firstAvg,
      secondAvg,
      unitLabel: "positives/yr",
    });
    return;
  }

  const pairs = jurisdictions.map((j) => {
    const firstAvg = firstHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / secondHalf.length;
    return { jurisdiction: j, first: firstAvg, second: secondAvg };
  }).sort((a, b) => b.first - a.first);

  const width = 700, height = 450;
  const pad = { top: 30, right: 100, bottom: 30, left: 100 };
  const innerW = width - pad.left - pad.right;
  const maxVal = Math.max(...pairs.map((p) => Math.max(p.first, p.second)), 1);

  function yPos(val) { return pad.top + (1 - val / maxVal) * (height - pad.top - pad.bottom); }


  const leftY = {};
  const rightY = {};
  const minGap = 14;
  const labelTop = pad.top + 8;
  const labelBottom = height - pad.bottom - 6;
  const lArr = pairs.map(p => ({ j: p.jurisdiction, y: yPos(p.first) })).sort((a,b) => a.y - b.y);
  const rArr = pairs.map(p => ({ j: p.jurisdiction, y: yPos(p.second) })).sort((a,b) => a.y - b.y);
  const relax = (arr) => {
    for(let k=0; k<15; k++) {
      for(let i=0; i<arr.length-1; i++) {
        if (arr[i+1].y - arr[i].y < minGap) {
          const shift = (minGap - (arr[i+1].y - arr[i].y)) / 2;
          arr[i].y -= shift;
          arr[i+1].y += shift;
        }
      }
    }
    for (let k = 0; k < 4; k++) {
      if (!arr.length) return;
      arr[0].y = Math.max(arr[0].y, labelTop);
      for (let i = 1; i < arr.length; i++) {
        arr[i].y = Math.max(arr[i].y, arr[i - 1].y + minGap);
      }
      arr[arr.length - 1].y = Math.min(arr[arr.length - 1].y, labelBottom);
      for (let i = arr.length - 2; i >= 0; i--) {
        arr[i].y = Math.min(arr[i].y, arr[i + 1].y - minGap);
      }
    }
  };
  relax(lArr); relax(rArr);
  lArr.forEach(item => leftY[item.j] = item.y);
  rArr.forEach(item => rightY[item.j] = item.y);

  let markup = `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="#334155"/>`;
  markup += `<line x1="${pad.left + innerW}" y1="${pad.top}" x2="${pad.left + innerW}" y2="${height - pad.bottom}" stroke="#334155"/>`;
  markup += `<text x="${pad.left}" y="${pad.top - 12}" font-size="11" fill="#94a3b8">${firstHalf[0]}–${firstHalf[firstHalf.length - 1]}</text>`;
  markup += `<text x="${pad.left + innerW}" y="${pad.top - 12}" font-size="11" fill="#94a3b8" text-anchor="end">${secondHalf[0]}–${secondHalf[secondHalf.length - 1]}</text>`;

  pairs.forEach((p) => {
    const y1 = yPos(p.first), y2 = yPos(p.second);
    const color = JURISDICTION_COLORS[p.jurisdiction] || "#38bdf8";
    const rising = p.second > p.first;
    markup += `<line x1="${pad.left}" y1="${y1}" x2="${pad.left + innerW}" y2="${y2}" stroke="${color}" stroke-width="2" opacity="0.7"/>`;
    markup += `<circle cx="${pad.left}" cy="${y1}" r="4" fill="${color}"/>`;
    markup += `<circle cx="${pad.left + innerW}" cy="${y2}" r="4" fill="${color}"/>`;
    markup += `<text x="${pad.left - 8}" y="${leftY[p.jurisdiction] + 4}" text-anchor="end" font-size="12" fill="#f1f5f9" font-weight="600">${p.jurisdiction}</text>`;
    markup += `<text x="${pad.left + innerW + 8}" y="${rightY[p.jurisdiction] + 4}" font-size="11" fill="${rising ? '#34d399' : '#f87171'}">${fmtCompact(Math.round(p.second))} ${rising ? '↑' : '↓'}</text>`;
  });

  svg.innerHTML = markup;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.height = "450px";
  svg.style.width = "100%";
}

function drawBreathTrend(records) {
  const byYearJurisdiction = {};
  records.forEach((r) => { const key = `${r.series_year}-${r.jurisdiction}`; byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.count; });
  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].sort();
  const canvas = document.getElementById("breath-trend");
  if (!canvas) return;

  const totalValue = Object.values(byYearJurisdiction).reduce((s, v) => s + v, 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

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
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2.5,
      })),
    },
    options: chartDefaults({
      scales: { ...chartDefaults().scales, y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) } } },
    }),
  });
}

function drawBreathJurisdictions(records) {
  const byJurisdiction = {};
  records.forEach((r) => { byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + r.count; });
  const sorted = Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1]);
  const canvas = document.getElementById("breath-jurisdictions");
  if (!canvas) return;

  const totalValue = Object.values(byJurisdiction).reduce((s, v) => s + v, 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  createChart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{ data: sorted.map((s) => s[1]), backgroundColor: sorted.map((s) => JURISDICTION_COLORS[s[0]] || CHART_COLORS.primary), borderRadius: 4, barThickness: 24 }],
    },
    options: chartDefaults({
      indexAxis: "y",
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: { ...chartDefaults().scales, x: { ...chartDefaults().scales.x, ticks: { ...chartDefaults().scales.x.ticks, callback: (v) => fmtCompact(v) } } },
    }),
  });
}

function drawBreathAge(records) {
  const byAge = {};
  records.forEach((r) => { byAge[r.age_group] = (byAge[r.age_group] || 0) + r.count; });
  const sorted = Object.entries(byAge).filter(([k]) => k !== "Unknown" && k !== "All ages").sort((a, b) => b[1] - a[1]);
  const canvas = document.getElementById("breath-age-chart");
  if (!canvas) return;

  if (sorted.length === 0 || sorted.every((s) => s[1] === 0)) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  if (sorted.length === 1) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">Age group comparison not available when filtered to a single age group</p>';
    return;
  }

  createChart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{ data: sorted.map((s) => s[1]), backgroundColor: CHART_COLORS.secondary + "cc", borderRadius: 4, barThickness: 24 }],
    },
    options: chartDefaults({
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: { ...chartDefaults().scales, y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) } } },
    }),
  });
}

function drawBreathIndexed(records) {
  const byYearJurisdiction = {};
  records.forEach((r) => { const key = `${r.series_year}-${r.jurisdiction}`; byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.count; });
  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].sort();
  const canvas = document.getElementById("breath-indexed");
  if (!canvas) return;

  const totalValue = Object.values(byYearJurisdiction).reduce((s, v) => s + v, 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  if (years.length < 2) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">Need at least 2 years of data</p>';
    return;
  }

  const baseYear = years[0];
  createChart(canvas, {
    type: "line",
    data: {
      labels: years,
      datasets: jurisdictions.map((j) => {
        const base = byYearJurisdiction[`${baseYear}-${j}`] || 1;
        return {
          label: j,
          data: years.map((y) => ((byYearJurisdiction[`${y}-${j}`] || 0) / base * 100).toFixed(1)),
          borderColor: JURISDICTION_COLORS[j] || CHART_COLORS.primary,
          backgroundColor: "transparent",
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2.5,
        };
      }),
    },
    options: chartDefaults({
      scales: { ...chartDefaults().scales, y: { ...chartDefaults().scales.y, title: { display: true, text: "Index (first year = 100)", color: CHART_COLORS.text } } },
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
    { id: "map", title: "Geographic view" },
    { id: "trend", title: "Over time" },
    { id: "substances", title: "Substance breakdown" },
    { id: "stages", title: "Testing stages" },
    { id: "jurisdictions", title: "By jurisdiction" },
    { id: "slope", title: "Year-over-year shift" },
    { id: "composition", title: "Substance trends" },
  ];

  state.filters.yearStart = years[0];
  state.filters.yearEnd = summary.latest_year;

  app.innerHTML = `
    <div class="dataset-page">
      <nav class="toc-sidebar">
        <h4>Sections</h4>
        ${sections.map((s) => `<a href="#" class="toc-link" data-target="${s.id}">${s.title}</a>`).join("")}
      </nav>
      <div class="dataset-content">
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
        <div class="chart-section" id="map">
          <div class="stat-callout" id="stat-map"></div>
          <h3>Positive drug tests across Australia</h3>
          <p class="chart-desc">Geographic heatmap showing positive drug test volume by jurisdiction.</p>
          <div class="chart-container"><canvas id="drug-map"></canvas></div>
        </div>
        <div class="chart-section" id="trend">
          <div class="stat-callout" id="stat-trend"></div>
          <h3>Positive drug tests over time</h3>
          <p class="chart-desc">Annual national trend by jurisdiction.</p>
          <div class="chart-container"><canvas id="drug-trend"></canvas></div>
        </div>
        <div class="chart-section" id="substances">
          <div class="stat-callout" id="stat-substances"></div>
          <h3>Which substances are detected most</h3>
          <p class="chart-desc">Total detections by substance across the selected period.</p>
          <div class="chart-container"><canvas id="drug-substances"></canvas></div>
        </div>
        <div class="chart-section" id="stages">
          <div class="stat-callout" id="stat-stages"></div>
          <h3>Testing stage breakdown</h3>
          <p class="chart-desc">Indicator (Stage 1) screening versus confirmatory tests.</p>
          <div class="chart-container"><canvas id="drug-stages"></canvas></div>
        </div>
        <div class="chart-section" id="jurisdictions">
          <div class="stat-callout" id="stat-jurisdictions"></div>
          <h3>Jurisdiction comparison</h3>
          <p class="chart-desc">Positive drug tests by jurisdiction in the selected period.</p>
          <div class="chart-container"><canvas id="drug-jurisdictions"></canvas></div>
        </div>
        <div class="chart-section" id="slope">
          <div class="stat-callout" id="stat-slope"></div>
          <h3>How detections shifted between halves</h3>
          <p class="chart-desc">Slope chart comparing first half versus second half of the period.</p>
          <div class="chart-container"><svg id="drug-slope"></svg></div>
        </div>
        <div class="chart-section" id="composition">
          <div class="stat-callout" id="stat-composition"></div>
          <h3>Substance composition over time</h3>
          <p class="chart-desc">100% stacked view showing how the detected substance mix changes year to year.</p>
          <div class="chart-container"><canvas id="drug-composition"></canvas></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("drug-year-start").value = years[0];
  document.getElementById("drug-year-end").value = summary.latest_year;

  bindDrugFilters(records, summary);
  bindTocNavigation();
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

  updateDrugStatCallouts(filtered);
  updateDrugStats(filtered);
  destroyCharts();
  drawDrugMap(filtered);
  drawDrugTrend(filtered);
  drawDrugSubstances(filtered);
  drawDrugStages(filtered);
  drawDrugJurisdictions(filtered);
  drawDrugSlope(filtered);
  drawDrugComposition(filtered);
}

function updateDrugStats(records) {
  const total = records.reduce((s, r) => s + r.count, 0);
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].length;
  const years = [...new Set(records.map((r) => r.series_year))].length;
  const byJurisdiction = {};
  records.forEach((r) => { byJurisdiction[r.jurisdiction] = (byJurisdiction[r.jurisdiction] || 0) + r.count; });
  const top = Object.entries(byJurisdiction).sort((a, b) => b[1] - a[1])[0];

  const statRow = document.getElementById("stat-row");
  if (!statRow) return;
  statRow.innerHTML = `
    <div class="stat-box"><div class="stat-label">Total positives</div><div class="stat-value">${fmtCompact(total)}</div><div class="stat-sub">${years} years</div></div>
    <div class="stat-box"><div class="stat-label">Jurisdictions</div><div class="stat-value">${jurisdictions}</div><div class="stat-sub">States and territories</div></div>
    <div class="stat-box"><div class="stat-label">Highest</div><div class="stat-value">${top ? top[0] : "—"}</div><div class="stat-sub">${top ? fmtCompact(top[1]) : ""} total</div></div>
    <div class="stat-box"><div class="stat-label">Records</div><div class="stat-value">${fmt(records.length)}</div><div class="stat-sub">Annual data points</div></div>
  `;
}

function drawDrugMap(records) {
  drawAustraliaChoropleth({
    canvasId: "drug-map",
    records,
    valueAccessor: (r) => r.count,
    hue: 25,
    title: "Positive drug tests",
    valueLabel: "positive tests",
  });
}

function drawDrugSlope(records) {
  const svg = document.getElementById("drug-slope");
  if (!svg) return;

  const years = [...new Set(records.map((r) => r.series_year))].sort();
  if (years.length < 2) { svg.innerHTML = `<p style="color:#64748b;padding:40px;text-align:center">Need at least 2 years</p>`; return; }

  const midIdx = Math.floor(years.length / 2);
  const firstHalf = years.slice(0, midIdx);
  const secondHalf = years.slice(midIdx);

  const byJurisdiction = {};
  records.forEach((r) => {
    if (!byJurisdiction[r.jurisdiction]) byJurisdiction[r.jurisdiction] = {};
    byJurisdiction[r.jurisdiction][r.series_year] = (byJurisdiction[r.jurisdiction][r.series_year] || 0) + r.count;
  });

  const jurisdictions = Object.keys(byJurisdiction);

  if (jurisdictions.length === 1) {
    const j = jurisdictions[0];
    const firstAvg = firstHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / secondHalf.length;
    renderSingleJurisdictionSlope(svg, {
      jurisdiction: j,
      firstLabel: `${firstHalf[0]}-${firstHalf[firstHalf.length - 1]} (avg/yr)`,
      secondLabel: `${secondHalf[0]}-${secondHalf[secondHalf.length - 1]} (avg/yr)`,
      firstAvg,
      secondAvg,
      unitLabel: "detections/yr",
    });
    return;
  }

  const pairs = jurisdictions.map((j) => {
    const firstAvg = firstHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((s, y) => s + (byJurisdiction[j][y] || 0), 0) / secondHalf.length;
    return { jurisdiction: j, first: firstAvg, second: secondAvg };
  }).sort((a, b) => b.first - a.first);

  const width = 700, height = 450;
  const pad = { top: 30, right: 100, bottom: 30, left: 100 };
  const innerW = width - pad.left - pad.right;
  const maxVal = Math.max(...pairs.map((p) => Math.max(p.first, p.second)), 1);

  function yPos(val) { return pad.top + (1 - val / maxVal) * (height - pad.top - pad.bottom); }


  const leftY = {};
  const rightY = {};
  const minGap = 14;
  const labelTop = pad.top + 8;
  const labelBottom = height - pad.bottom - 6;
  const lArr = pairs.map(p => ({ j: p.jurisdiction, y: yPos(p.first) })).sort((a,b) => a.y - b.y);
  const rArr = pairs.map(p => ({ j: p.jurisdiction, y: yPos(p.second) })).sort((a,b) => a.y - b.y);
  const relax = (arr) => {
    for(let k=0; k<15; k++) {
      for(let i=0; i<arr.length-1; i++) {
        if (arr[i+1].y - arr[i].y < minGap) {
          const shift = (minGap - (arr[i+1].y - arr[i].y)) / 2;
          arr[i].y -= shift;
          arr[i+1].y += shift;
        }
      }
    }
    for (let k = 0; k < 4; k++) {
      if (!arr.length) return;
      arr[0].y = Math.max(arr[0].y, labelTop);
      for (let i = 1; i < arr.length; i++) {
        arr[i].y = Math.max(arr[i].y, arr[i - 1].y + minGap);
      }
      arr[arr.length - 1].y = Math.min(arr[arr.length - 1].y, labelBottom);
      for (let i = arr.length - 2; i >= 0; i--) {
        arr[i].y = Math.min(arr[i].y, arr[i + 1].y - minGap);
      }
    }
  };
  relax(lArr); relax(rArr);
  lArr.forEach(item => leftY[item.j] = item.y);
  rArr.forEach(item => rightY[item.j] = item.y);

  let markup = `<line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" stroke="#334155"/>`;
  markup += `<line x1="${pad.left + innerW}" y1="${pad.top}" x2="${pad.left + innerW}" y2="${height - pad.bottom}" stroke="#334155"/>`;
  markup += `<text x="${pad.left}" y="${pad.top - 12}" font-size="11" fill="#94a3b8">${firstHalf[0]}–${firstHalf[firstHalf.length - 1]}</text>`;
  markup += `<text x="${pad.left + innerW}" y="${pad.top - 12}" font-size="11" fill="#94a3b8" text-anchor="end">${secondHalf[0]}–${secondHalf[secondHalf.length - 1]}</text>`;

  pairs.forEach((p) => {
    const y1 = yPos(p.first), y2 = yPos(p.second);
    const color = JURISDICTION_COLORS[p.jurisdiction] || "#38bdf8";
    const rising = p.second > p.first;
    markup += `<line x1="${pad.left}" y1="${y1}" x2="${pad.left + innerW}" y2="${y2}" stroke="${color}" stroke-width="2" opacity="0.7"/>`;
    markup += `<circle cx="${pad.left}" cy="${y1}" r="4" fill="${color}"/>`;
    markup += `<circle cx="${pad.left + innerW}" cy="${y2}" r="4" fill="${color}"/>`;
    markup += `<text x="${pad.left - 8}" y="${leftY[p.jurisdiction] + 4}" text-anchor="end" font-size="12" fill="#f1f5f9" font-weight="600">${p.jurisdiction}</text>`;
    markup += `<text x="${pad.left + innerW + 8}" y="${rightY[p.jurisdiction] + 4}" font-size="11" fill="${rising ? '#34d399' : '#f87171'}">${fmtCompact(Math.round(p.second))} ${rising ? '↑' : '↓'}</text>`;
  });

  svg.innerHTML = markup;
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.style.height = "450px";
  svg.style.width = "100%";
}

function drawDrugTrend(records) {
  const byYearJurisdiction = {};
  records.forEach((r) => { const key = `${r.series_year}-${r.jurisdiction}`; byYearJurisdiction[key] = (byYearJurisdiction[key] || 0) + r.count; });
  const years = [...new Set(records.map((r) => r.series_year))].sort();
  const jurisdictions = [...new Set(records.map((r) => r.jurisdiction))].sort();
  const canvas = document.getElementById("drug-trend");
  if (!canvas) return;

  const totalValue = Object.values(byYearJurisdiction).reduce((s, v) => s + v, 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

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
        pointRadius: 4,
        pointHoverRadius: 7,
        borderWidth: 2.5,
      })),
    },
    options: chartDefaults({
      scales: { ...chartDefaults().scales, y: { ...chartDefaults().scales.y, ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) } } },
    }),
  });
}

function drawDrugSubstances(records) {
  const totals = { cannabis: 0, amphetamine: 0, methylamphetamine: 0, ecstasy: 0, cocaine: 0, other: 0 };
  records.forEach((r) => {
    if (r.cannabis_detected) totals.cannabis++;
    if (r.amphetamine_detected) totals.amphetamine++;
    if (r.methylamphetamine_detected) totals.methylamphetamine++;
    if (r.ecstasy_detected) totals.ecstasy++;
    if (r.cocaine_detected) totals.cocaine++;
    if (r.other_detected) totals.other++;
  });

  const substances = ["cannabis", "amphetamine", "methylamphetamine", "ecstasy", "cocaine", "other"];
  const canvas = document.getElementById("drug-substances");
  if (!canvas) return;

  const totalValue = Object.values(totals).reduce((s, v) => s + v, 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  const sorted = substances
    .map((s) => [s, totals[s]])
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1]);

  createChart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map(([s]) => s.charAt(0).toUpperCase() + s.slice(1)),
      datasets: [{
        label: "Total detections",
        data: sorted.map(([, value]) => value),
        backgroundColor: sorted.map(([s]) => SUBSTANCE_COLORS[s] + "cc"),
        borderRadius: 4,
        barThickness: 24,
      }],
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        x: { ...chartDefaults().scales.x, ticks: { ...chartDefaults().scales.x.ticks, callback: (v) => fmtCompact(v) } },
        y: { ...chartDefaults().scales.y },
      },
      indexAxis: "y",
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
    }),
  });
}

function drawDrugStages(records) {
  const byYearStage = {};
  records.forEach((r) => { const key = `${r.series_year}-${r.detection_method}`; byYearStage[key] = (byYearStage[key] || 0) + r.count; });
  const stageTotalsByYear = {};
  records.forEach((r) => { stageTotalsByYear[r.series_year] = (stageTotalsByYear[r.series_year] || 0) + r.count; });
  const years = getActiveYears(stageTotalsByYear);
  const stageOrder = ["Indicator (Stage 1)", "Secondary Confirmatory (Stage 2)", "Laboratory or Toxicology (Stage 3)", "Not applicable"];
  const stages = stageOrder.filter((s) => records.some((r) => r.detection_method === s));
  const canvas = document.getElementById("drug-stages");
  if (!canvas) return;

  const totalValue = Object.values(stageTotalsByYear).reduce((s, v) => s + v, 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  createChart(canvas, {
    type: "bar",
    data: {
      labels: years,
      datasets: stages.map((s) => ({
        label: s,
        data: years.map((y) => byYearStage[`${y}-${s}`] || 0),
        backgroundColor: (STAGE_COLORS[s] || CHART_COLORS.accent) + "cc",
        borderRadius: 2,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        x: { ...chartDefaults().scales.x, stacked: true },
        y: { ...chartDefaults().scales.y, stacked: true, ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => fmtCompact(v) } },
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

  const totalValue = Object.values(byJurisdiction).reduce((s, v) => s + v, 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  createChart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{ data: sorted.map((s) => s[1]), backgroundColor: sorted.map((s) => JURISDICTION_COLORS[s[0]] || CHART_COLORS.accent), borderRadius: 4, barThickness: 24 }],
    },
    options: chartDefaults({
      indexAxis: "y",
      plugins: { ...chartDefaults().plugins, legend: { display: false } },
      scales: { ...chartDefaults().scales, x: { ...chartDefaults().scales.x, ticks: { ...chartDefaults().scales.x.ticks, callback: (v) => fmtCompact(v) } } },
    }),
  });
}

function drawDrugComposition(records) {
  const byYear = {};
  records.forEach((r) => {
    if (!byYear[r.series_year]) byYear[r.series_year] = { cannabis: 0, amphetamine: 0, methylamphetamine: 0, ecstasy: 0, cocaine: 0 };
    if (r.cannabis_detected) byYear[r.series_year].cannabis++;
    if (r.amphetamine_detected) byYear[r.series_year].amphetamine++;
    if (r.methylamphetamine_detected) byYear[r.series_year].methylamphetamine++;
    if (r.ecstasy_detected) byYear[r.series_year].ecstasy++;
    if (r.cocaine_detected) byYear[r.series_year].cocaine++;
  });

  const years = getActiveYears(byYear, ["cannabis", "amphetamine", "methylamphetamine", "ecstasy", "cocaine"]);
  const substances = ["cannabis", "amphetamine", "methylamphetamine", "ecstasy", "cocaine"];
  const canvas = document.getElementById("drug-composition");
  if (!canvas) return;

  const totalValue = Object.values(byYear).reduce((s, y) => s + Object.values(y).reduce((t, v) => t + v, 0), 0);
  if (!records.length || totalValue === 0) {
    canvas.parentElement.innerHTML = '<p style="color:#64748b;padding:40px;text-align:center">No data available for selected filters</p>';
    return;
  }

  createChart(canvas, {
    type: "bar",
    data: {
      labels: years,
      datasets: substances.map((s) => ({
        label: s.charAt(0).toUpperCase() + s.slice(1),
        data: years.map((y) => {
          const yearTotal = Object.values(byYear[y]).reduce((t, v) => t + v, 0) || 1;
          return (byYear[y][s] / yearTotal) * 100;
        }),
        borderColor: SUBSTANCE_COLORS[s],
        backgroundColor: SUBSTANCE_COLORS[s] + "cc",
        borderWidth: 0,
        borderRadius: 0,
      })),
    },
    options: chartDefaults({
      scales: {
        ...chartDefaults().scales,
        x: { ...chartDefaults().scales.x, stacked: true },
        y: {
          ...chartDefaults().scales.y,
          stacked: true,
          min: 0,
          max: 100,
          ticks: { ...chartDefaults().scales.y.ticks, callback: (v) => `${v}%` },
        },
      },
      plugins: {
        ...chartDefaults().plugins,
        tooltip: {
          ...chartDefaults().plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)}%`,
          },
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
        ${Object.entries(JURISDICTION_COLORS).map(([j, c]) => `<div class="stat-box" style="border-left: 3px solid ${c}"><div class="stat-value" style="font-size:18px;color:${c}">${j}</div></div>`).join("")}
      </div>
    </div>
  `;
}

init();
