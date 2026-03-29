const DATA_PATHS = {
  catalog: "./data/catalog.json",
};

const chartColors = ["#9a5b17", "#35624b", "#7b6a2f", "#7f4f3d", "#b88336", "#5e6a4a"];

const elements = {
  datasetDescription: document.querySelector("#dataset-description"),
  overviewGrid: document.querySelector("#overview-grid"),
  overviewCardTemplate: document.querySelector("#overview-card-template"),
  datasetSelect: document.querySelector("#dataset-select"),
  yearSelect: document.querySelector("#year-select"),
  jurisdictionSelect: document.querySelector("#jurisdiction-select"),
  measureSelect: document.querySelector("#measure-select"),
  timeseriesChart: document.querySelector("#timeseries-chart"),
  metricChart: document.querySelector("#metric-chart"),
  jurisdictionChart: document.querySelector("#jurisdiction-chart"),
  detectionChart: document.querySelector("#detection-chart"),
  insightsGrid: document.querySelector("#insights-grid"),
  downloadsList: document.querySelector("#downloads-list"),
  scaffoldList: document.querySelector("#scaffold-list"),
  trendCopy: document.querySelector("#trend-copy"),
  metricCopy: document.querySelector("#metric-copy"),
  jurisdictionCopy: document.querySelector("#jurisdiction-copy"),
  detectionCopy: document.querySelector("#detection-copy"),
};

const state = {
  catalog: null,
  datasets: new Map(),
  currentDatasetKey: null,
  year: "all",
  jurisdiction: "all",
  measure: "total_actions",
};

init().catch((error) => {
  console.error(error);
  [
    elements.overviewGrid,
    elements.timeseriesChart,
    elements.metricChart,
    elements.jurisdictionChart,
    elements.detectionChart,
  ].forEach((node) => {
    node.innerHTML = `<div class="empty-state">Unable to load the dataset assets. Serve the project from a local web server and try again.</div>`;
  });
});

async function init() {
  const catalog = await fetchJson(DATA_PATHS.catalog);
  state.catalog = catalog;

  const summaries = await Promise.all(
    catalog.datasets.map(async (dataset) => {
      const summary = await fetchJson(`./data/${dataset.summary_file}`);
      const records = await fetchJson(`./data/${dataset.records_file}`);
      return [dataset.key, { catalog: dataset, summary, records }];
    })
  );

  summaries.forEach(([key, value]) => state.datasets.set(key, value));
  state.currentDatasetKey = catalog.datasets[0]?.key || null;

  bindControls();
  renderDatasetOptions();
  renderCurrentDataset();
}

function bindControls() {
  elements.datasetSelect.addEventListener("change", (event) => {
    state.currentDatasetKey = event.target.value;
    state.year = "all";
    state.jurisdiction = "all";
    state.measure = "total_actions";
    renderCurrentDataset();
  });

  elements.yearSelect.addEventListener("change", (event) => {
    state.year = event.target.value;
    renderCharts();
  });

  elements.jurisdictionSelect.addEventListener("change", (event) => {
    state.jurisdiction = event.target.value;
    renderCharts();
  });

  elements.measureSelect.addEventListener("change", (event) => {
    state.measure = event.target.value;
    renderCharts();
  });
}

function renderDatasetOptions() {
  elements.datasetSelect.innerHTML = state.catalog.datasets
    .map((dataset) => `<option value="${dataset.key}">${dataset.title}</option>`)
    .join("");
  elements.datasetSelect.value = state.currentDatasetKey;
}

function renderCurrentDataset() {
  const dataset = getCurrentDataset();
  if (!dataset) {
    return;
  }

  const { summary, records } = dataset;
  elements.datasetDescription.textContent = summary.description;
  renderOverview(summary);
  renderFilters(summary, records);
  renderInsights(summary);
  renderDownloads(dataset);
  renderScaffolding(dataset);
  renderCharts();
}

function renderOverview(summary) {
  const overviewItems = [
    {
      label: "Reference period",
      value: `${summary.period_coverage.start.slice(0, 4)}-${summary.period_coverage.end.slice(0, 4)}`,
      meta: `${summary.period_coverage.count} reporting periods cleaned`,
    },
    {
      label: "Total actions in 2024",
      value: formatNumber(summary.latest_year_totals.total_actions),
      meta: `${formatNumber(summary.latest_year_totals.fines)} fines, ${formatNumber(summary.latest_year_totals.charges)} charges, ${formatNumber(summary.latest_year_totals.arrests)} arrests`,
    },
    {
      label: "Jurisdictions covered",
      value: String(summary.dimensions.jurisdictions.length),
      meta: summary.dimensions.jurisdictions.join(", "),
    },
    {
      label: "Data quality result",
      value: summary.quality.rows_skipped === 0 ? "No skipped rows" : `${summary.quality.rows_skipped} skipped`,
      meta: `${formatNumber(summary.record_count)} records emitted from ${formatNumber(summary.quality.rows_seen)} workbook rows`,
    },
  ];

  elements.overviewGrid.innerHTML = "";
  overviewItems.forEach((item) => {
    const fragment = elements.overviewCardTemplate.content.cloneNode(true);
    fragment.querySelector(".stat-label").textContent = item.label;
    fragment.querySelector(".stat-value").textContent = item.value;
    fragment.querySelector(".stat-meta").textContent = item.meta;
    elements.overviewGrid.appendChild(fragment);
  });
}

function renderFilters(summary, records) {
  const years = [...new Set(records.map((record) => String(record.series_year)))].sort();
  const jurisdictions = summary.dimensions.jurisdictions;

  elements.yearSelect.innerHTML = [`<option value="all">All years</option>`]
    .concat(years.map((year) => `<option value="${year}">${year}</option>`))
    .join("");
  elements.yearSelect.value = state.year;

  elements.jurisdictionSelect.innerHTML = [`<option value="all">National</option>`]
    .concat(jurisdictions.map((value) => `<option value="${value}">${value}</option>`))
    .join("");
  elements.jurisdictionSelect.value = state.jurisdiction;

  elements.measureSelect.innerHTML = [
    { key: "total_actions", label: "Total actions" },
    { key: "fines", label: "Fines" },
    { key: "charges", label: "Charges" },
    { key: "arrests", label: "Arrests" },
  ]
    .map((item) => `<option value="${item.key}">${item.label}</option>`)
    .join("");
  elements.measureSelect.value = state.measure;
}

function renderCharts() {
  const dataset = getCurrentDataset();
  if (!dataset) {
    return;
  }

  const { records, summary } = dataset;
  const filtered = records.filter((record) => {
    const yearMatch = state.year === "all" || String(record.series_year) === state.year;
    const jurisdictionMatch = state.jurisdiction === "all" || record.jurisdiction === state.jurisdiction;
    return yearMatch && jurisdictionMatch;
  });

  renderTimeseries(filtered, summary);
  renderMetricChart(filtered);
  renderJurisdictionChart(records);
  renderDetectionChart(records);
}

function renderTimeseries(filtered, summary) {
  const grouped = groupBy(filtered, (record) => record.period_start, (bucket, record) => {
    bucket.period_label = record.period_label;
    bucket[state.measure] = (bucket[state.measure] || 0) + record[state.measure];
    return bucket;
  }, {});

  const points = Object.entries(grouped)
    .map(([period, values]) => ({ period, label: values.period_label, value: values[state.measure] || 0 }))
    .sort((a, b) => a.period.localeCompare(b.period));

  elements.trendCopy.textContent =
    state.year === "all"
      ? `Historical ${labelForMeasure(state.measure).toLowerCase()} across the cleaned series.`
      : `${labelForMeasure(state.measure)} inside ${state.year}${state.jurisdiction === "all" ? " nationally" : ` for ${state.jurisdiction}`}.`;

  if (!points.length) {
    elements.timeseriesChart.innerHTML = emptyState("No timeseries points match the current filter.");
    return;
  }

  elements.timeseriesChart.innerHTML = createLineChart(points, {
    label: labelForMeasure(state.measure),
    stroke: chartColors[0],
  });
}

function renderMetricChart(filtered) {
  const grouped = groupBy(filtered, (record) => record.metric_label, (bucket, record) => {
    bucket.value = (bucket.value || 0) + record[state.measure];
    return bucket;
  }, {});

  const rows = Object.entries(grouped)
    .map(([label, values]) => ({ label, value: values.value || 0 }))
    .sort((a, b) => b.value - a.value);

  elements.metricCopy.textContent =
    state.jurisdiction === "all"
      ? `${labelForMeasure(state.measure)} by enforcement category${state.year === "all" ? " across all available years" : ` in ${state.year}`}.`
      : `${labelForMeasure(state.measure)} by enforcement category for ${state.jurisdiction}${state.year === "all" ? " across all available years" : ` in ${state.year}`}.`;

  if (!rows.length) {
    elements.metricChart.innerHTML = emptyState("No metric distribution matches the current filter.");
    return;
  }

  elements.metricChart.innerHTML = createHorizontalBarChart(rows, { color: chartColors[1] });
}

function renderJurisdictionChart(records) {
  const yearTarget = state.year === "all" ? String(getCurrentDataset().summary.latest_year) : state.year;
  const relevant = records.filter((record) => String(record.series_year) === yearTarget);
  const grouped = groupBy(relevant, (record) => record.jurisdiction, (bucket, record) => {
    bucket.value = (bucket.value || 0) + record[state.measure];
    return bucket;
  }, {});

  const rows = Object.entries(grouped)
    .map(([label, values]) => ({ label, value: values.value || 0 }))
    .sort((a, b) => b.value - a.value);

  elements.jurisdictionCopy.textContent = `${labelForMeasure(state.measure)} by jurisdiction in ${yearTarget}.`;

  if (!rows.length) {
    elements.jurisdictionChart.innerHTML = emptyState("No jurisdiction comparisons are available for the current year.");
    return;
  }

  elements.jurisdictionChart.innerHTML = createVerticalBarChart(rows, { color: chartColors[2] });
}

function renderDetectionChart(records) {
  const yearTarget = state.year === "all" ? String(getCurrentDataset().summary.latest_year) : state.year;
  const filtered = records.filter((record) => String(record.series_year) === yearTarget);
  const relevant = state.jurisdiction === "all"
    ? filtered
    : filtered.filter((record) => record.jurisdiction === state.jurisdiction);

  const grouped = {};
  relevant.forEach((record) => {
    const key = `${record.metric_label}__${record.detection_method}`;
    if (!grouped[key]) {
      grouped[key] = {
        metric: record.metric_label,
        detection: record.detection_method,
        value: 0,
      };
    }
    grouped[key].value += record.fines;
  });

  const rows = Object.values(grouped)
    .sort((a, b) => a.metric.localeCompare(b.metric) || b.value - a.value)
    .slice(0, 12);

  elements.detectionCopy.textContent = `Fines by detection method in ${yearTarget}${state.jurisdiction === "all" ? "" : ` for ${state.jurisdiction}`}.`;

  if (!rows.length) {
    elements.detectionChart.innerHTML = emptyState("No detection method detail is available for this selection.");
    return;
  }

  elements.detectionChart.innerHTML = createTable(rows, [
    { key: "metric", label: "Metric" },
    { key: "detection", label: "Detection method" },
    { key: "value", label: "Fines", format: formatNumber },
  ]);
}

function renderInsights(summary) {
  const metricLeader = summary.aggregates.metric_totals[0];
  const latestJurisdiction = summary.aggregates.latest_year_by_jurisdiction[0];
  const latestPeriod = summary.aggregates.timeseries[summary.aggregates.timeseries.length - 1];
  const notes = [
    {
      title: "Series concentration",
      body: `${metricLeader.metric_label} dominates the cleaned series with ${formatNumber(metricLeader.total_actions)} recorded actions, making it the clearest long-run signal in the current release.`,
    },
    {
      title: "Latest-year scale",
      body: `${latestJurisdiction.jurisdiction} records the highest 2024 total at ${formatNumber(latestJurisdiction.total_actions)} actions, reflecting both enforcement intensity and reporting scope.`,
    },
    {
      title: "Recent reporting period",
      body: `The latest published period in this file is ${latestPeriod.period_label}, where the cleaned table records ${formatNumber(latestPeriod.total_actions)} total actions nationally.`,
    },
    {
      title: "Interpretation caution",
      body: `BITRE notes that definitions and collection practices vary across jurisdictions, so cross-state comparisons should be treated as indicative rather than perfectly harmonized.`,
    },
  ];

  elements.insightsGrid.innerHTML = notes
    .map(
      (note) => `
        <article class="note-card">
          <h3>${note.title}</h3>
          <p>${note.body}</p>
        </article>
      `
    )
    .join("");
}

function renderDownloads(dataset) {
  const { catalog } = dataset;
  const files = [
    {
      title: "Original workbook",
      copy: `${catalog.source_file} • BITRE source file`,
      href: `./data/${catalog.source_file}`,
    },
    {
      title: "Cleaned CSV",
      copy: `${catalog.csv_file} • analysis-friendly export`,
      href: `./data/${catalog.csv_file}`,
    },
    {
      title: "Cleaned JSON",
      copy: `${catalog.records_file} • normalized row-level dataset`,
      href: `./data/${catalog.records_file}`,
    },
    {
      title: "Summary JSON",
      copy: `${catalog.summary_file} • aggregates, dimensions, and quality checks`,
      href: `./data/${catalog.summary_file}`,
    },
  ];

  elements.downloadsList.innerHTML = files
    .map(
      (file) => `
        <article class="download-card">
          <div>
            <p class="download-title">${file.title}</p>
            <p class="download-copy">${file.copy}</p>
          </div>
          <a class="download-link" href="${file.href}" download>Download</a>
        </article>
      `
    )
    .join("");
}

function renderScaffolding(dataset) {
  const notes = dataset.catalog.future_agent_notes.concat([
    "The front end reads from data/catalog.json, so adding a new dataset card only requires updating catalog metadata and processed assets.",
    "The cleaning pipeline lives in scripts/build_police_enforcement_data.py and can be copied or generalized for related BITRE workbooks.",
    "Visual modules accept normalized records, which keeps chart logic separate from workbook parsing concerns.",
  ]);

  elements.scaffoldList.innerHTML = notes
    .map(
      (note, index) => `
        <article class="scaffold-item">
          <h3>Path ${index + 1}</h3>
          <p>${note}</p>
        </article>
      `
    )
    .join("");
}

function createLineChart(points, config) {
  const width = 760;
  const height = 320;
  const margin = { top: 24, right: 16, bottom: 42, left: 64 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...points.map((point) => point.value), 1);

  const path = points
    .map((point, index) => {
      const x = margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
      const y = margin.top + innerHeight - (point.value / maxValue) * innerHeight;
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const circles = points
    .map((point, index) => {
      const x = margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
      const y = margin.top + innerHeight - (point.value / maxValue) * innerHeight;
      return `<circle cx="${x}" cy="${y}" r="3.5" fill="${config.stroke}"><title>${point.label}: ${formatNumber(point.value)}</title></circle>`;
    })
    .join("");

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((step) => {
    const value = Math.round(maxValue * step);
    const y = margin.top + innerHeight - step * innerHeight;
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e5dbce" />
      <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#645541">${formatCompactNumber(value)}</text>
    `;
  }).join("");

  const firstLabel = points[0].period.slice(0, 4);
  const lastLabel = points[points.length - 1].period.slice(0, 4);

  return `
    <div class="chart-title-row"><strong>${config.label}</strong><span class="legend">${firstLabel} to ${lastLabel}</span></div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${config.label} line chart">
      ${ticks}
      <path d="${path}" fill="none" stroke="${config.stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      ${circles}
      <text x="${margin.left}" y="${height - 10}" font-size="12" fill="#645541">${firstLabel}</text>
      <text x="${width - margin.right}" y="${height - 10}" text-anchor="end" font-size="12" fill="#645541">${lastLabel}</text>
    </svg>
  `;
}

function createHorizontalBarChart(rows, options) {
  const width = 760;
  const barHeight = 36;
  const gap = 12;
  const height = rows.length * (barHeight + gap) + 30;
  const margin = { top: 12, right: 16, bottom: 12, left: 180 };
  const innerWidth = width - margin.left - margin.right;
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  const bars = rows
    .map((row, index) => {
      const y = margin.top + index * (barHeight + gap);
      const barWidth = (row.value / maxValue) * innerWidth;
      return `
        <text x="${margin.left - 12}" y="${y + 23}" text-anchor="end" font-size="12" fill="#2f2418">${row.label}</text>
        <rect x="${margin.left}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${options.color}" opacity="0.88" rx="4"></rect>
        <text x="${margin.left + barWidth + 8}" y="${y + 23}" font-size="12" fill="#645541">${formatCompactNumber(row.value)}</text>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Horizontal bar chart">
      ${bars}
    </svg>
  `;
}

function createVerticalBarChart(rows, options) {
  const width = 760;
  const height = 320;
  const margin = { top: 20, right: 10, bottom: 70, left: 56 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...rows.map((row) => row.value), 1);
  const barWidth = innerWidth / rows.length - 10;

  const bars = rows
    .map((row, index) => {
      const x = margin.left + index * (barWidth + 10);
      const heightValue = (row.value / maxValue) * innerHeight;
      const y = margin.top + innerHeight - heightValue;
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${heightValue}" fill="${options.color}" rx="4"></rect>
        <text x="${x + barWidth / 2}" y="${height - 26}" text-anchor="middle" font-size="12" fill="#2f2418">${row.label}</text>
        <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" font-size="11" fill="#645541">${formatCompactNumber(row.value)}</text>
      `;
    })
    .join("");

  const ticks = [0, 0.5, 1].map((step) => {
    const value = Math.round(maxValue * step);
    const y = margin.top + innerHeight - step * innerHeight;
    return `
      <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e5dbce"></line>
      <text x="${margin.left - 8}" y="${y + 4}" text-anchor="end" font-size="12" fill="#645541">${formatCompactNumber(value)}</text>
    `;
  }).join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Vertical bar chart">
      ${ticks}
      ${bars}
    </svg>
  `;
}

function createTable(rows, columns) {
  const header = columns.map((column) => `<th>${column.label}</th>`).join("");
  const body = rows
    .map(
      (row) => `<tr>${columns
        .map((column) => `<td>${column.format ? column.format(row[column.key]) : row[column.key]}</td>`)
        .join("")}</tr>`
    )
    .join("");
  return `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`;
}

function groupBy(items, keyFn, reducer, seed) {
  return items.reduce((accumulator, item) => {
    const key = keyFn(item);
    accumulator[key] = reducer(accumulator[key] || cloneSeed(seed), item);
    return accumulator;
  }, {});
}

function cloneSeed(seed) {
  return JSON.parse(JSON.stringify(seed));
}

function labelForMeasure(measure) {
  if (measure === "fines") return "Fines";
  if (measure === "charges") return "Charges";
  if (measure === "arrests") return "Arrests";
  return "Total actions";
}

function emptyState(message) {
  return `<div class="empty-state">${message}</div>`;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-AU").format(value);
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function getCurrentDataset() {
  return state.datasets.get(state.currentDatasetKey);
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}
