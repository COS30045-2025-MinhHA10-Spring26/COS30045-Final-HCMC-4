import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";

const outPath = path.resolve("test-results/filter-audit/analysis.json");

async function getOptions(page, id) {
  const sel = page.locator(`#${id}`);
  if (!(await sel.count())) return [];
  return await sel.locator("option").evaluateAll((opts) => opts.map((o) => ({ value: o.value, label: o.textContent?.trim() || o.value })));
}

async function setSelect(page, id, value) {
  const sel = page.locator(`#${id}`);
  if (await sel.count()) await sel.selectOption(value);
}

async function chartSnapshot(page) {
  return await page.evaluate(() => {
    const out = {};
    const chart = window.Chart;
    if (!chart || !chart.instances) return out;
    const instances = Object.values(chart.instances);
    for (const c of instances) {
      const id = c?.canvas?.id;
      if (!id) continue;
      const labels = c?.data?.labels || [];
      const dsets = c?.data?.datasets || [];
      let nonZero = 0;
      let points = 0;
      for (const ds of dsets) {
        for (const v of (ds.data || [])) {
          points++;
          const num = typeof v === 'object' && v !== null ? (v.value ?? 0) : Number(v || 0);
          if (num !== 0 && !Number.isNaN(num)) nonZero++;
        }
      }
      out[id] = { type: c.config.type, labels: labels.length, datasets: dsets.length, points, nonZero };
    }
    return out;
  });
}

async function collectCommon(page) {
  const statIds = ["stat-map","stat-trend","stat-metrics","stat-jurisdictions","stat-detection","stat-slope","stat-comparison","stat-age","stat-indexed","stat-substances","stat-stages","stat-composition"];
  const stats = {};
  for (const id of statIds) {
    const loc = page.locator(`#${id}`);
    if (await loc.count()) stats[id] = (await loc.innerText()).trim();
  }
  const noData = await page.locator('.chart-container').evaluateAll((els) => els.map((el, idx) => ({idx, text: (el.textContent||'').trim()})).filter((x) => /No data available|Need at least/.test(x.text)));
  return { stats, noData, charts: await chartSnapshot(page) };
}

async function runFines(page, report) {
  await page.goto('http://localhost:8080/#/fines', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const ms = await getOptions(page, 'fines-metric');
  const js = await getOptions(page, 'fines-jurisdiction');
  for (const m of ms) {
    for (const j of js) {
      await setSelect(page, 'fines-metric', m.value);
      await setSelect(page, 'fines-jurisdiction', j.value);
      await page.waitForTimeout(250);
      report.push({ page: 'fines', metric: m.value, jurisdiction: j.value, ...(await collectCommon(page)) });
    }
  }
}

async function runBreath(page, report) {
  await page.goto('http://localhost:8080/#/breath-tests', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const ages = await getOptions(page, 'breath-age-filter');
  const js = await getOptions(page, 'breath-jurisdiction');
  for (const a of ages) {
    for (const j of js) {
      await setSelect(page, 'breath-age-filter', a.value);
      await setSelect(page, 'breath-jurisdiction', j.value);
      await page.waitForTimeout(250);
      report.push({ page: 'breath', age: a.value, jurisdiction: j.value, ...(await collectCommon(page)) });
    }
  }
}

async function runDrug(page, report) {
  await page.goto('http://localhost:8080/#/drug-tests', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(900);
  const stages = await getOptions(page, 'drug-stage');
  const js = await getOptions(page, 'drug-jurisdiction');
  for (const s of stages) {
    for (const j of js) {
      await setSelect(page, 'drug-stage', s.value);
      await setSelect(page, 'drug-jurisdiction', j.value);
      await page.waitForTimeout(250);
      report.push({ page: 'drug', stage: s.value, jurisdiction: j.value, ...(await collectCommon(page)) });
    }
  }
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const report = [];
  await runFines(page, report);
  await runBreath(page, report);
  await runDrug(page, report);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(report, null, 2));
  await browser.close();
})();
