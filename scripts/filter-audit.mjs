import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";

const outDir = path.resolve("test-results/filter-audit");

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function snap(page, relPath, selector = "body") {
  const full = path.join(outDir, relPath);
  await ensureDir(path.dirname(full));
  const loc = page.locator(selector).first();
  await loc.screenshot({ path: full });
}

async function setSelectIfExists(page, id, value) {
  const sel = page.locator(`#${id}`);
  if (await sel.count()) {
    const options = await sel.locator("option").allTextContents();
    const hasExactValue = await sel.locator(`option[value="${value}"]`).count();
    if (!hasExactValue) {
      const normalized = options.map((o) => o.trim());
      const idx = normalized.findIndex((o) => o.toLowerCase() === String(value).toLowerCase());
      if (idx >= 0) {
        const opt = await sel.locator("option").nth(idx).getAttribute("value");
        if (opt) await sel.selectOption(opt);
      }
      return;
    }
    await sel.selectOption(value);
  }
}

async function auditFines(page) {
  await page.goto("http://localhost:8080/#/fines", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const cases = [
    { name: "baseline", metric: "all", j: "all" },
    { name: "seatbelt_allj", metric: "non_wearing_seatbelts", j: "all" },
    { name: "seatbelt_qld", metric: "non_wearing_seatbelts", j: "QLD" },
    { name: "speed_qld", metric: "speed_fines", j: "QLD" },
    { name: "unlicensed_act", metric: "unlicensed_driving", j: "ACT" },
  ];

  for (const c of cases) {
    await setSelectIfExists(page, "fines-metric", c.metric);
    await setSelectIfExists(page, "fines-jurisdiction", c.j);
    await page.waitForTimeout(900);

    await snap(page, `fines/${c.name}-stat-metrics.png`, "#stat-metrics");
    await snap(page, `fines/${c.name}-metrics-chart.png`, "#metrics .chart-container");
    await snap(page, `fines/${c.name}-stat-map.png`, "#stat-map");
    await snap(page, `fines/${c.name}-map-chart.png`, "#map .chart-container");
    await snap(page, `fines/${c.name}-stat-slope.png`, "#stat-slope");
    await snap(page, `fines/${c.name}-slope-chart.png`, "#slope .chart-container");
    await snap(page, `fines/${c.name}-comparison-chart.png`, "#comparison .chart-container");
  }
}

async function auditBreath(page) {
  await page.goto("http://localhost:8080/#/breath-tests", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const cases = [
    { name: "baseline", age: "all", j: "all" },
    { name: "single_age_allj", age: "26-39", j: "all" },
    { name: "single_age_qld", age: "26-39", j: "QLD" },
    { name: "unknown_age_allj", age: "Unknown", j: "all" },
  ];

  for (const c of cases) {
    await setSelectIfExists(page, "breath-age-filter", c.age);
    await setSelectIfExists(page, "breath-jurisdiction", c.j);
    await page.waitForTimeout(900);

    await snap(page, `breath/${c.name}-stat-age.png`, "#stat-age");
    await snap(page, `breath/${c.name}-age-chart.png`, "#age .chart-container");
    await snap(page, `breath/${c.name}-stat-slope.png`, "#stat-slope");
    await snap(page, `breath/${c.name}-slope-chart.png`, "#slope .chart-container");
  }
}

async function auditDrug(page) {
  await page.goto("http://localhost:8080/#/drug-tests", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  const cases = [
    { name: "baseline", stage: "all", j: "all" },
    { name: "stage1_allj", stage: "Stage 1 roadside screening", j: "all" },
    { name: "stage1_qld", stage: "Stage 1 roadside screening", j: "QLD" },
    { name: "confirmatory_qld", stage: "Stage 2 confirmatory test", j: "QLD" },
  ];

  for (const c of cases) {
    await setSelectIfExists(page, "drug-stage", c.stage);
    await setSelectIfExists(page, "drug-jurisdiction", c.j);
    await page.waitForTimeout(900);

    await snap(page, `drug/${c.name}-stat-stages.png`, "#stat-stages");
    await snap(page, `drug/${c.name}-stages-chart.png`, "#stages .chart-container");
    await snap(page, `drug/${c.name}-stat-slope.png`, "#stat-slope");
    await snap(page, `drug/${c.name}-slope-chart.png`, "#slope .chart-container");
  }
}

(async () => {
  await ensureDir(outDir);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });

  const issues = [];
  page.on("console", (m) => {
    if (m.type() === "error") issues.push(`console:${m.text()}`);
  });
  page.on("pageerror", (e) => issues.push(`pageerror:${e.message}`));

  await auditFines(page);
  await auditBreath(page);
  await auditDrug(page);

  await fs.writeFile(path.join(outDir, "issues.txt"), issues.join("\n"));
  await browser.close();
})();
