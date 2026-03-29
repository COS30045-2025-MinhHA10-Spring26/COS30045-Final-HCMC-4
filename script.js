const METRIC_COLORS = {
  "Mobile phone use": "#8e5214",
  "Seatbelt non-compliance": "#2f6953",
  "Speeding fines": "#8c4f3f",
  "Unlicensed driving": "#6f6d33",
};

const FALLBACK_COLORS = ["#8e5214", "#2f6953", "#8c4f3f", "#6f6d33", "#c0893d", "#253040"];

const elements = {
  datasetTabs: document.querySelector("#dataset-tabs"),
  tabTemplate: document.querySelector("#tab-template"),
  metricTemplate: document.querySelector("#metric-template"),
  datasetStatus: document.querySelector("#dataset-status"),
  datasetHeroTitle: document.querySelector("#dataset-hero-title"),
  datasetHeroDeck: document.querySelector("#dataset-hero-deck"),
  heroMetrics: document.querySelector("#hero-metrics"),
  controlsPanel: document.querySelector(".controls-panel"),
  yearSelect: document.querySelector("#year-select"),
  jurisdictionSelect: document.querySelector("#jurisdiction-select"),
  measureSelect: document.querySelector("#measure-select"),
  storyContent: document.querySelector("#story-content"),
  downloadsList: document.querySelector("#downloads-list"),
  scaffoldList: document.querySelector("#scaffold-list"),
  tooltip: document.querySelector("#chart-tooltip"),
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
  elements.storyContent.innerHTML = `<div class="panel-surface story-card"><div class="empty-state">Unable to load the observatory assets. Serve the project from a local web server and reload.</div></div>`;
});

async function init() {
  state.catalog = await fetchJson("./data/catalog.json");

  const readyDatasets = state.catalog.datasets.filter((dataset) => dataset.status === "ready");
  const loaded = await Promise.all(
    readyDatasets.map(async (dataset) => {
      const summary = await fetchJson(`./data/${dataset.summary_file}`);
      const records = await fetchJson(`./data/${dataset.records_file}`);
      return [dataset.key, { catalog: dataset, summary, records }];
    })
  );

  loaded.forEach(([key, value]) => state.datasets.set(key, value));
  state.currentDatasetKey = state.catalog.datasets[0]?.key || null;

  bindGlobalEvents();
  renderTabs();
  renderDataset();
}

function bindGlobalEvents() {
  elements.yearSelect.addEventListener("change", (event) => {
    state.year = event.target.value;
    renderDataset();
  });

  elements.jurisdictionSelect.addEventListener("change", (event) => {
    state.jurisdiction = event.target.value;
    renderDataset();
  });

  elements.measureSelect.addEventListener("change", (event) => {
    state.measure = event.target.value;
    renderDataset();
  });

  window.addEventListener("scroll", hideTooltip, { passive: true });
}

function renderTabs() {
  elements.datasetTabs.innerHTML = "";

  state.catalog.datasets.forEach((dataset) => {
    const fragment = elements.tabTemplate.content.cloneNode(true);
    const button = fragment.querySelector("button");
    button.dataset.key = dataset.key;
    button.dataset.status = dataset.status;
    button.setAttribute("aria-selected", String(state.currentDatasetKey === dataset.key));
    button.setAttribute("tabindex", state.currentDatasetKey === dataset.key ? "0" : "-1");
    button.querySelector(".tab-title").textContent = dataset.short_title || dataset.title;
    button.querySelector(".tab-meta").textContent = labelForStatus(dataset.status);
    button.addEventListener("click", () => selectDataset(dataset.key));
    elements.datasetTabs.appendChild(fragment);
  });
}

function selectDataset(datasetKey) {
  state.currentDatasetKey = datasetKey;
  state.year = "all";
  state.jurisdiction = "all";
  state.measure = "total_actions";
  renderTabs();
  renderDataset();
}

function renderDataset() {
  const datasetMeta = getCurrentDatasetMeta();
  if (!datasetMeta) {
    return;
  }

  renderHero(datasetMeta);
  renderDownloads(datasetMeta);
  renderScaffolding(datasetMeta);

  if (datasetMeta.status === "ready") {
    const dataset = state.datasets.get(datasetMeta.key);
    renderControls(dataset.summary, dataset.records);
    renderReadyStory(datasetMeta, dataset.summary, dataset.records);
  } else {
    elements.controlsPanel.hidden = true;
    renderPlannedStory(datasetMeta);
  }

  bindTooltips(elements.storyContent);
}

function renderHero(datasetMeta) {
  const loaded = state.datasets.get(datasetMeta.key);
  const hero = datasetMeta.hero || {};

  elements.datasetStatus.textContent = hero.eyebrow || labelForStatus(datasetMeta.status);
  elements.datasetHeroTitle.textContent = hero.headline || datasetMeta.title;
  elements.datasetHeroDeck.textContent = hero.deck || datasetMeta.description;
  elements.heroMetrics.innerHTML = "";

  const cards = loaded ? buildHeroMetrics(loaded.summary) : buildPlaceholderMetrics(datasetMeta);
  cards.forEach((card) => {
    const fragment = elements.metricTemplate.content.cloneNode(true);
    fragment.querySelector(".metric-label").textContent = card.label;
    fragment.querySelector(".metric-value").textContent = card.value;
    fragment.querySelector(".metric-meta").textContent = card.meta;
    elements.heroMetrics.appendChild(fragment);
  });
}

function renderControls(summary, records) {
  elements.controlsPanel.hidden = false;

  const years = [...new Set(records.map((record) => String(record.series_year)))].sort();
  const jurisdictions = summary.dimensions.jurisdictions;
  const measures = [
    { key: "total_actions", label: "Total actions" },
    { key: "fines", label: "Fines" },
    { key: "charges", label: "Charges" },
    { key: "arrests", label: "Arrests" },
  ];

  elements.yearSelect.innerHTML = [`<option value="all">All years</option>`]
    .concat(years.map((year) => `<option value="${year}">${year}</option>`))
    .join("");
  elements.jurisdictionSelect.innerHTML = [`<option value="all">National</option>`]
    .concat(jurisdictions.map((jurisdiction) => `<option value="${jurisdiction}">${jurisdiction}</option>`))
    .join("");
  elements.measureSelect.innerHTML = measures
    .map((measure) => `<option value="${measure.key}">${measure.label}</option>`)
    .join("");

  elements.yearSelect.value = state.year;
  elements.jurisdictionSelect.value = state.jurisdiction;
  elements.measureSelect.value = state.measure;
}

function renderReadyStory(datasetMeta, summary, records) {
  const filtered = filterRecords(records);
  const yearTarget = state.year === "all" ? String(summary.latest_year) : state.year;
  const scopeLabel = `${state.jurisdiction === "all" ? "national" : state.jurisdiction.toLowerCase()} ${labelForMeasure(state.measure).toLowerCase()}`;

  const timeseries = aggregateBy(filtered, (record) => record.period_start, (bucket, record) => {
    bucket.label = record.period_label;
    bucket.value += record[state.measure];
  }, () => ({ label: "", value: 0 }));
  const timeseriesRows = Object.entries(timeseries)
    .map(([period, values]) => ({ period, label: values.label, value: values.value }))
    .sort((a, b) => a.period.localeCompare(b.period));

  const metricTotals = aggregateBy(filtered, (record) => record.metric_label, (bucket, record) => {
    bucket.value += record[state.measure];
  }, () => ({ value: 0 }));
  const metricRows = Object.entries(metricTotals)
    .map(([label, values]) => ({ label, value: values.value, color: colorForMetric(label) }))
    .sort((a, b) => b.value - a.value);

  const jurisdictionYearRecords = records.filter((record) => String(record.series_year) === yearTarget);
  const heatmapRows = buildJurisdictionMetricMatrix(jurisdictionYearRecords, state.measure);
  const detectionRows = buildDetectionBreakdown(jurisdictionYearRecords, state.jurisdiction);

  const strongestMetric = metricRows[0];
  const peakPeriod = [...timeseriesRows].sort((a, b) => b.value - a.value)[0];
  const strongestJurisdiction = [...summary.aggregates.latest_year_by_jurisdiction].sort((a, b) => b[state.measure] - a[state.measure])[0];

  elements.storyContent.innerHTML = [
    createStoryCard({
      kicker: "Chapter 1",
      title: "The national line tells you when enforcement pressure changed",
      body: [
        `The first view keeps the story simple: how much ${labelForMeasure(state.measure).toLowerCase()} was recorded over time for the current lens.`,
        peakPeriod
          ? `${capitalize(labelForMeasure(state.measure).toLowerCase())} peaks in ${peakPeriod.label} at ${formatNumber(peakPeriod.value)} under the current filter.`
          : "No peak can be calculated for the current filter.",
      ],
      asideTitle: "What to look for",
      asideItems: [
        "Hover each point for the exact period value.",
        "Use the year filter to isolate annual reporting changes.",
        "Switch jurisdiction to see whether a national shift is driven by one state or territory.",
      ],
      chart: createChartShell({
        title: `Trend of ${labelForMeasure(state.measure).toLowerCase()}`,
        subtitle: `Current scope: ${scopeLabel}`,
        frame: timeseriesRows.length
          ? createLineChart(timeseriesRows, labelForMeasure(state.measure))
          : emptyState("No timeseries points match the current filters."),
        note: datasetMeta.story_sections?.[0]?.summary || "Long-run trend chart for the cleaned series.",
      }),
    }),
    createStoryCard({
      kicker: "Chapter 2",
      title: "Not all enforcement categories carry the same weight",
      body: [
        strongestMetric
          ? `${strongestMetric.label} is the largest category in the current selection, with ${formatNumber(strongestMetric.value)} recorded ${labelForMeasure(state.measure).toLowerCase()}.`
          : "No category is available for the current filter.",
        "This chart is where the site shifts from scale to composition: it shows which risky behaviours dominate the record rather than just how large the total is.",
      ],
      asideTitle: "Why this graph exists",
      asideItems: [
        "Colour encodes the offence category so the same palette repeats through the story.",
        "Hover bars for exact values and relative share.",
        "Use it to compare whether the current view is dominated by speeding, phones, seatbelts, or unlicensed driving.",
      ],
      chart: createChartShell({
        title: "Metric composition",
        subtitle: `Measured as ${labelForMeasure(state.measure).toLowerCase()}`,
        frame: metricRows.length
          ? createHorizontalBars(metricRows, metricRows.reduce((sum, row) => sum + row.value, 0))
          : emptyState("No metric totals match the current filters."),
        note: "Each bar captures a distinct behavioural story, not just a rank order.",
        legend: metricRows.map((row) => ({ label: row.label, color: row.color })),
      }),
    }),
    createStoryCard({
      kicker: "Chapter 3",
      title: "The state and territory picture is uneven",
      body: [
        `This matrix stays on ${yearTarget} so cross-jurisdiction comparison is anchored to the same reporting year.`,
        strongestJurisdiction
          ? `${strongestJurisdiction.jurisdiction} currently leads the published ${summary.latest_year} total with ${formatNumber(strongestJurisdiction[state.measure])} ${labelForMeasure(state.measure).toLowerCase()}.`
          : "Jurisdiction highlights are unavailable.",
      ],
      asideTitle: "How to read the matrix",
      asideItems: [
        "Darker cells indicate higher recorded values.",
        "Hover any cell to compare a metric inside one jurisdiction.",
        "This view makes outliers visible without flattening every category into a single total.",
      ],
      chart: createChartShell({
        title: `Jurisdiction by metric in ${yearTarget}`,
        subtitle: "A hotspot-style matrix for annual comparison",
        frame: heatmapRows.cells.length
          ? createHeatmap(heatmapRows)
          : emptyState("No jurisdiction comparison is available for this year."),
        note: "The matrix is designed to show concentration and spread at the same time.",
      }),
    }),
    createStoryCard({
      kicker: "Chapter 4",
      title: "Detection method changes the meaning of the count",
      body: [
        "Police-issued activity and camera-led activity should not be read as identical forms of enforcement, even when they produce the same legal outcome.",
        `This final chart keeps the story in ${yearTarget} and shows how fines are being detected${state.jurisdiction === "all" ? " nationally" : ` in ${state.jurisdiction}`}.`,
      ],
      asideTitle: "Why the last graph matters",
      asideItems: [
        "Hover each segment for metric, detection method, and exact count.",
        "The stacked format reveals whether a category is mostly camera-led or officer-led.",
        "It prevents raw fine counts from being interpreted without enforcement context.",
      ],
      chart: createChartShell({
        title: "Detection mix by metric",
        subtitle: "Fine counts only, split by detection method",
        frame: detectionRows.length
          ? createStackedDetectionChart(detectionRows)
          : emptyState("No detection-method detail is available for this selection."),
        note: datasetMeta.story_sections?.[1]?.summary || "Detection mix exposes differences between automated and police-issued enforcement.",
      }),
    }),
    createQualityCard(summary),
  ].join("");
}

function renderPlannedStory(datasetMeta) {
  elements.storyContent.innerHTML = `
    <section class="panel-surface story-card">
      <div class="story-card-grid">
        <div class="story-body">
          <p class="story-kicker">Scaffold</p>
          <div class="story-header">
            <h2>${escapeHtml(datasetMeta.title)} is reserved but not yet imported</h2>
            <p>${escapeHtml(datasetMeta.description)}</p>
          </div>
          <p>This tab is intentionally not empty. It tells the next agent what the page should explain, what the charts should show, and which fields are expected from the source file.</p>
        </div>
        <aside class="story-aside">
          <h3>Expected source</h3>
          <p>${escapeHtml(datasetMeta.expected_source_file || "Source file pending")}</p>
          <p class="story-footnote">Reference period: ${escapeHtml(datasetMeta.reference_period || "Not yet defined")}</p>
        </aside>
      </div>
    </section>
    <section class="placeholder-grid">
      <article class="panel-surface placeholder-panel">
        <h3>Story sections</h3>
        <ul class="placeholder-list">
          ${(datasetMeta.story_sections || []).map((section) => `<li><strong>${escapeHtml(section.title)}:</strong> ${escapeHtml(section.summary)}</li>`).join("")}
        </ul>
      </article>
      <article class="panel-surface placeholder-panel">
        <h3>Planned visuals</h3>
        <ul class="placeholder-list">
          ${(datasetMeta.planned_visuals || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </article>
      <article class="panel-surface placeholder-panel">
        <h3>Expected fields</h3>
        <ul class="placeholder-list">
          ${((datasetMeta.expected_fields && datasetMeta.expected_fields.length ? datasetMeta.expected_fields : ["Fields to be defined during import"]).map((field) => `<li>${escapeHtml(field)}</li>`).join(""))}
        </ul>
      </article>
    </section>
  `;
}

function renderDownloads(datasetMeta) {
  const downloads = datasetMeta.downloads || [];
  elements.downloadsList.innerHTML = downloads
    .map((file) => {
      const isReady = file.status === "ready";
      const href = isReady ? `./data/${file.href}` : "#";
      return `
        <article class="download-card">
          <div>
            <p class="download-title">${escapeHtml(file.title)}</p>
            <p class="download-meta">${escapeHtml((file.kind || "file").toUpperCase())} • ${escapeHtml(labelForStatus(file.status || datasetMeta.status))}</p>
          </div>
          <a class="download-link ${isReady ? "" : "is-disabled"}" href="${href}" ${isReady ? "download" : "aria-disabled=\"true\""}>${isReady ? "Download" : "Planned"}</a>
        </article>
      `;
    })
    .join("");
}

function renderScaffolding(datasetMeta) {
  const notes = (datasetMeta.future_agent_notes || []).concat([
    "Dataset tabs are driven by data/catalog.json, so new pages should be added there first.",
    "The same story layout can render both ready datasets and planned placeholders.",
    "Interactive charts read normalized JSON, keeping workbook parsing separate from UI behaviour.",
  ]);

  elements.scaffoldList.innerHTML = notes
    .map(
      (note, index) => `
        <article class="scaffold-item">
          <strong>Step ${index + 1}</strong>
          <p>${escapeHtml(note)}</p>
        </article>
      `
    )
    .join("");
}

function buildHeroMetrics(summary) {
  return [
    {
      label: "Coverage",
      value: `${summary.period_coverage.start.slice(0, 4)}-${summary.period_coverage.end.slice(0, 4)}`,
      meta: `${summary.period_coverage.count} reporting periods`,
    },
    {
      label: `Latest year total`,
      value: formatNumber(summary.latest_year_totals.total_actions),
      meta: `${summary.latest_year} across fines, charges, and arrests`,
    },
    {
      label: "Jurisdictions",
      value: String(summary.dimensions.jurisdictions.length),
      meta: summary.dimensions.jurisdictions.join(", "),
    },
    {
      label: "Data quality",
      value: summary.quality.rows_skipped === 0 ? "No skipped rows" : `${summary.quality.rows_skipped} skipped`,
      meta: `${formatNumber(summary.record_count)} records emitted`,
    },
  ];
}

function buildPlaceholderMetrics(datasetMeta) {
  return [
    {
      label: "Status",
      value: labelForStatus(datasetMeta.status),
      meta: datasetMeta.expected_source_file || "Source file pending",
    },
    {
      label: "Reference period",
      value: datasetMeta.reference_period || "Planned",
      meta: "Will update once the source file is imported",
    },
    {
      label: "Story sections",
      value: String((datasetMeta.story_sections || []).length),
      meta: "Narrative chapters already scaffolded",
    },
    {
      label: "Planned visuals",
      value: String((datasetMeta.planned_visuals || []).length),
      meta: "Charts reserved for future implementation",
    },
  ];
}

function createStoryCard({ kicker, title, body, asideTitle, asideItems, chart }) {
  return `
    <section class="panel-surface story-card">
      <div class="story-card-grid">
        <div>
          <div class="story-header">
            <p class="story-kicker">${escapeHtml(kicker)}</p>
            <h2>${escapeHtml(title)}</h2>
          </div>
          <div class="story-body">
            ${body.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
          </div>
          ${chart}
        </div>
        <aside class="story-aside">
          <h3>${escapeHtml(asideTitle)}</h3>
          <ul>
            ${asideItems.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </aside>
      </div>
    </section>
  `;
}

function createChartShell({ title, subtitle, frame, note, legend = [] }) {
  return `
    <div class="chart-shell">
      <div class="chart-title-row">
        <strong>${escapeHtml(title)}</strong>
        <span class="chart-note">${escapeHtml(subtitle)}</span>
      </div>
      <div class="chart-frame">${frame}</div>
      ${legend.length ? `<div class="legend-row">${legend.map((item) => `<span class="legend-chip"><span class="legend-swatch" style="background:${item.color}"></span>${escapeHtml(item.label)}</span>`).join("")}</div>` : ""}
      <p class="chart-note">${escapeHtml(note)}</p>
    </div>
  `;
}

function createQualityCard(summary) {
  const notes = (summary.notes || []).map((note) => `<li>${escapeHtml(note)}</li>`).join("");
  return `
    <section class="panel-surface story-card">
      <div class="story-card-grid">
        <div>
          <div class="story-header">
            <p class="story-kicker">Method</p>
            <h2>Data cleaning and interpretation guardrails stay visible</h2>
          </div>
          <div class="story-body">
            <p>The site treats cleaning as part of the story. Dates are normalized, categorical values are trimmed, and zeroes are preserved as observed values rather than erased as nulls.</p>
            <p>That matters for a PSA-style experience: users should understand what they are seeing and where caution is still required.</p>
          </div>
        </div>
        <aside class="story-aside">
          <h3>Current quality notes</h3>
          <ul>${notes}</ul>
        </aside>
      </div>
    </section>
  `;
}

function createLineChart(points, measureLabel) {
  const width = 840;
  const height = 320;
  const margin = { top: 18, right: 16, bottom: 44, left: 62 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const minValue = 0;

  const path = points
    .map((point, index) => {
      const x = margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
      const y = scaleY(point.value, minValue, maxValue, margin.top, innerHeight);
      return `${index === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const area = `${path} L ${margin.left + innerWidth},${margin.top + innerHeight} L ${margin.left},${margin.top + innerHeight} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1]
    .map((step) => {
      const value = Math.round(maxValue * step);
      const y = scaleY(value, minValue, maxValue, margin.top, innerHeight);
      return `
        <line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" stroke="#e3d7ca"></line>
        <text x="${margin.left - 10}" y="${y + 4}" text-anchor="end" font-size="12" fill="#665746">${formatCompactNumber(value)}</text>
      `;
    })
    .join("");

  const pointsMarkup = points
    .map((point, index) => {
      const x = margin.left + (index / Math.max(points.length - 1, 1)) * innerWidth;
      const y = scaleY(point.value, minValue, maxValue, margin.top, innerHeight);
      return `
        <circle
          class="chart-interactive"
          cx="${x}"
          cy="${y}"
          r="5"
          fill="#8e5214"
          tabindex="0"
          data-tooltip-title="${escapeAttribute(point.label)}"
          data-tooltip-value="${escapeAttribute(formatNumber(point.value))} ${escapeAttribute(measureLabel.toLowerCase())}"
          data-tooltip-meta="Period start: ${escapeAttribute(point.period)}"
        ></circle>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeAttribute(measureLabel)} trend chart">
      ${ticks}
      <path d="${area}" fill="rgba(142, 82, 20, 0.12)"></path>
      <path d="${path}" fill="none" stroke="#8e5214" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"></path>
      ${pointsMarkup}
      <text x="${margin.left}" y="${height - 14}" font-size="12" fill="#665746">${escapeHtml(points[0].period.slice(0, 4))}</text>
      <text x="${width - margin.right}" y="${height - 14}" text-anchor="end" font-size="12" fill="#665746">${escapeHtml(points[points.length - 1].period.slice(0, 4))}</text>
    </svg>
  `;
}

function createHorizontalBars(rows, total) {
  const width = 840;
  const barHeight = 34;
  const gap = 14;
  const height = rows.length * (barHeight + gap) + 16;
  const margin = { top: 6, right: 16, bottom: 6, left: 196 };
  const innerWidth = width - margin.left - margin.right;
  const maxValue = Math.max(...rows.map((row) => row.value), 1);

  const bars = rows
    .map((row, index) => {
      const y = margin.top + index * (barHeight + gap);
      const barWidth = (row.value / maxValue) * innerWidth;
      const share = total ? `${((row.value / total) * 100).toFixed(1)}% of current scope` : "0%";
      return `
        <text x="${margin.left - 12}" y="${y + 22}" text-anchor="end" font-size="12" fill="#2d2218">${escapeHtml(row.label)}</text>
        <rect x="${margin.left}" y="${y}" width="${innerWidth}" height="${barHeight}" fill="#efe6dc" rx="4"></rect>
        <rect
          class="chart-interactive"
          x="${margin.left}"
          y="${y}"
          width="${barWidth}"
          height="${barHeight}"
          fill="${row.color}"
          rx="4"
          tabindex="0"
          data-tooltip-title="${escapeAttribute(row.label)}"
          data-tooltip-value="${escapeAttribute(formatNumber(row.value))}"
          data-tooltip-meta="${escapeAttribute(share)}"
        ></rect>
        <text x="${margin.left + barWidth + 8}" y="${y + 22}" font-size="12" fill="#665746">${formatCompactNumber(row.value)}</text>
      `;
    })
    .join("");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Metric comparison chart">${bars}</svg>`;
}

function createHeatmap(matrix) {
  const width = 840;
  const rowHeight = 42;
  const columnWidth = 132;
  const height = 88 + matrix.rows.length * rowHeight;
  const margin = { top: 52, left: 116 };

  const labels = matrix.columns
    .map((column, index) => `<text x="${margin.left + index * columnWidth + columnWidth / 2}" y="30" text-anchor="middle" font-size="12" fill="#665746">${escapeHtml(column.shortLabel)}</text>`)
    .join("");

  const rowLabels = matrix.rows
    .map((row, index) => `<text x="${margin.left - 12}" y="${margin.top + index * rowHeight + 24}" text-anchor="end" font-size="12" fill="#2d2218">${escapeHtml(row)}</text>`)
    .join("");

  const cells = matrix.cells
    .map((cell) => {
      const x = margin.left + cell.columnIndex * columnWidth;
      const y = margin.top + cell.rowIndex * rowHeight;
      return `
        <rect
          class="chart-interactive"
          x="${x}"
          y="${y}"
          width="${columnWidth - 8}"
          height="${rowHeight - 8}"
          rx="4"
          fill="${cell.color}"
          tabindex="0"
          data-tooltip-title="${escapeAttribute(`${cell.jurisdiction} - ${cell.metric}`)}"
          data-tooltip-value="${escapeAttribute(formatNumber(cell.value))}"
          data-tooltip-meta="${escapeAttribute(cell.measureLabel)}"
        ></rect>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Jurisdiction hotspot matrix">
      ${labels}
      ${rowLabels}
      ${cells}
    </svg>
  `;
}

function createStackedDetectionChart(rows) {
  const width = 840;
  const rowHeight = 34;
  const gap = 16;
  const height = rows.length * (rowHeight + gap) + 16;
  const margin = { top: 8, right: 16, bottom: 8, left: 200 };
  const innerWidth = width - margin.left - margin.right;

  const methodColors = buildMethodColorMap(rows.flatMap((row) => row.segments.map((segment) => segment.method)));
  let legendMarkup = Object.entries(methodColors)
    .map(([method, color]) => `<span class="legend-chip"><span class="legend-swatch" style="background:${color}"></span>${escapeHtml(method)}</span>`)
    .join("");

  const bars = rows
    .map((row, index) => {
      const y = margin.top + index * (rowHeight + gap);
      let x = margin.left;
      const segments = row.segments
        .map((segment) => {
          const segmentWidth = row.total ? (segment.value / row.total) * innerWidth : 0;
          const markup = `
            <rect
              class="chart-interactive"
              x="${x}"
              y="${y}"
              width="${segmentWidth}"
              height="${rowHeight}"
              fill="${methodColors[segment.method]}"
              rx="3"
              tabindex="0"
              data-tooltip-title="${escapeAttribute(row.metric)}"
              data-tooltip-value="${escapeAttribute(formatNumber(segment.value))} fines via ${escapeAttribute(segment.method)}"
              data-tooltip-meta="${escapeAttribute(`${segment.share.toFixed(1)}% of ${row.metric}`)}"
            ></rect>
          `;
          x += segmentWidth;
          return markup;
        })
        .join("");

      return `
        <text x="${margin.left - 12}" y="${y + 22}" text-anchor="end" font-size="12" fill="#2d2218">${escapeHtml(row.metric)}</text>
        <rect x="${margin.left}" y="${y}" width="${innerWidth}" height="${rowHeight}" fill="#efe6dc" rx="4"></rect>
        ${segments}
        <text x="${margin.left + innerWidth + 8}" y="${y + 22}" font-size="12" fill="#665746">${formatCompactNumber(row.total)}</text>
      `;
    })
    .join("");

  return `
    <div>${legendMarkup ? `<div class="legend-row">${legendMarkup}</div>` : ""}</div>
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Detection method stacked bars">
      ${bars}
    </svg>
  `;
}

function buildJurisdictionMetricMatrix(records, measure) {
  const jurisdictions = [...new Set(records.map((record) => record.jurisdiction))].sort();
  const metrics = [...new Set(records.map((record) => record.metric_label))]
    .sort((left, right) => left.localeCompare(right))
    .map((metric) => ({ label: metric, shortLabel: metric.replace(" non-compliance", "") }));

  const values = new Map();
  records.forEach((record) => {
    const key = `${record.jurisdiction}__${record.metric_label}`;
    values.set(key, (values.get(key) || 0) + record[measure]);
  });

  const maxValue = Math.max(...Array.from(values.values()), 1);
  const cells = [];
  jurisdictions.forEach((jurisdiction, rowIndex) => {
    metrics.forEach((metric, columnIndex) => {
      const value = values.get(`${jurisdiction}__${metric.label}`) || 0;
      cells.push({
        jurisdiction,
        metric: metric.label,
        value,
        measureLabel: labelForMeasure(measure),
        rowIndex,
        columnIndex,
        color: interpolateColor(value / maxValue),
      });
    });
  });

  return { rows: jurisdictions, columns: metrics, cells };
}

function buildDetectionBreakdown(records, jurisdiction) {
  const relevant = jurisdiction === "all" ? records : records.filter((record) => record.jurisdiction === jurisdiction);
  const grouped = new Map();

  relevant.forEach((record) => {
    const metricBucket = grouped.get(record.metric_label) || new Map();
    metricBucket.set(record.detection_method, (metricBucket.get(record.detection_method) || 0) + record.fines);
    grouped.set(record.metric_label, metricBucket);
  });

  return [...grouped.entries()]
    .map(([metric, methodMap]) => {
      const total = Array.from(methodMap.values()).reduce((sum, value) => sum + value, 0);
      const segments = [...methodMap.entries()]
        .map(([method, value]) => ({ method, value, share: total ? (value / total) * 100 : 0 }))
        .sort((left, right) => right.value - left.value);
      return { metric, total, segments };
    })
    .sort((left, right) => right.total - left.total);
}

function aggregateBy(items, keyFn, reducer, seedFactory) {
  return items.reduce((accumulator, item) => {
    const key = keyFn(item);
    const current = accumulator[key] || seedFactory();
    reducer(current, item);
    accumulator[key] = current;
    return accumulator;
  }, {});
}

function filterRecords(records) {
  return records.filter((record) => {
    const matchesYear = state.year === "all" || String(record.series_year) === state.year;
    const matchesJurisdiction = state.jurisdiction === "all" || record.jurisdiction === state.jurisdiction;
    return matchesYear && matchesJurisdiction;
  });
}

function labelForMeasure(measure) {
  if (measure === "fines") return "Fines";
  if (measure === "charges") return "Charges";
  if (measure === "arrests") return "Arrests";
  return "Total actions";
}

function labelForStatus(status) {
  if (status === "ready") return "Live now";
  if (status === "reference") return "Reference tab";
  return "Scaffolded next";
}

function colorForMetric(metricLabel) {
  return METRIC_COLORS[metricLabel] || FALLBACK_COLORS[Object.keys(METRIC_COLORS).length % FALLBACK_COLORS.length];
}

function buildMethodColorMap(methods) {
  const unique = [...new Set(methods)];
  return unique.reduce((map, method, index) => {
    map[method] = FALLBACK_COLORS[index % FALLBACK_COLORS.length];
    return map;
  }, {});
}

function interpolateColor(ratio) {
  const clamped = Math.max(0.08, Math.min(1, ratio));
  const lightness = 92 - clamped * 38;
  return `hsl(28 58% ${lightness}%)`;
}

function scaleY(value, minValue, maxValue, top, innerHeight) {
  const normalized = (value - minValue) / Math.max(maxValue - minValue, 1);
  return top + innerHeight - normalized * innerHeight;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-AU").format(value);
}

function formatCompactNumber(value) {
  return new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getCurrentDatasetMeta() {
  return state.catalog.datasets.find((dataset) => dataset.key === state.currentDatasetKey) || null;
}

function bindTooltips(scope) {
  scope.querySelectorAll(".chart-interactive").forEach((node) => {
    node.addEventListener("mouseenter", showTooltip);
    node.addEventListener("mousemove", moveTooltip);
    node.addEventListener("mouseleave", hideTooltip);
    node.addEventListener("focus", showTooltip);
    node.addEventListener("blur", hideTooltip);
  });
}

function showTooltip(event) {
  const node = event.currentTarget;
  const title = node.dataset.tooltipTitle;
  const value = node.dataset.tooltipValue;
  const meta = node.dataset.tooltipMeta;
  elements.tooltip.innerHTML = `
    <span class="tooltip-title">${escapeHtml(title)}</span>
    <div>${escapeHtml(value)}</div>
    ${meta ? `<div class="tooltip-meta">${escapeHtml(meta)}</div>` : ""}
  `;
  elements.tooltip.hidden = false;
  moveTooltip(event);
}

function moveTooltip(event) {
  if (elements.tooltip.hidden) {
    return;
  }
  const pointX = event.clientX || event.currentTarget.getBoundingClientRect().left + 24;
  const pointY = event.clientY || event.currentTarget.getBoundingClientRect().top + 24;
  elements.tooltip.style.left = `${pointX + 16}px`;
  elements.tooltip.style.top = `${pointY + 16}px`;
}

function hideTooltip() {
  elements.tooltip.hidden = true;
}

function emptyState(message) {
  return `<div class="empty-state">${escapeHtml(message)}</div>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load ${path}`);
  }
  return response.json();
}
