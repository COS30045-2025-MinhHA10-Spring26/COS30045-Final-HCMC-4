import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:8080';

test.beforeAll(async ({ request }) => {
  await request.get(BASE);
});

test.describe('Homepage', () => {
  test.describe.configure({ mode: 'serial' });

  test('loads and shows dataset cards', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Road Safety Enforcement Data/);

    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
    await expect(heading).toContainText('Australian road safety enforcement data');

    const cards = page.locator('.dataset-card');
    await expect(cards).toHaveCount(4);

    const cardText = await page.locator('.dataset-grid').textContent();
    expect(cardText).toContain('Police enforcement fines');
    expect(cardText).toContain('Positive breath tests');
    expect(cardText).toContain('Positive drug tests');
    expect(cardText).toContain('About this project');
  });

  test('navigation links work', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    await page.locator('.nav-links .nav-link').nth(0).click();
    await expect(page).toHaveURL(/#\/fines/);

    await page.locator('.nav-links .nav-link').nth(1).click();
    await expect(page).toHaveURL(/#\/breath-tests/);

    await page.locator('.nav-links .nav-link').nth(2).click();
    await expect(page).toHaveURL(/#\/drug-tests/);

    await page.locator('.nav-links .nav-link').nth(3).click();
    await expect(page).toHaveURL(/#\/about/);
  });

  test('dataset cards are clickable', async ({ page }) => {
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    await page.locator('.dataset-card').first().click();
    await expect(page).toHaveURL(/#\/fines/);
  });
});

test.describe('Fines Page', () => {
  test('loads with charts and filters', async ({ page }) => {
    await page.goto(`${BASE}/#/fines`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const statCallouts = page.locator('.stat-callout');
    await expect(statCallouts).toHaveCount(7);

    const filterBar = page.locator('#filter-bar');
    await expect(filterBar).toBeVisible();

    const selects = filterBar.locator('select');
    await expect(selects).toHaveCount(4);

    const statRow = page.locator('#stat-row');
    await expect(statRow).toBeVisible();

    const statBoxes = statRow.locator('.stat-box');
    await expect(statBoxes).toHaveCount(4);
  });

  test('renders all chart sections', async ({ page }) => {
    await page.goto(`${BASE}/#/fines`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const sections = page.locator('.chart-section');
    await expect(sections).toHaveCount(7);

    await expect(page.locator('#fines-map')).toBeVisible();
    await expect(page.locator('#fines-trend')).toBeVisible();
    await expect(page.locator('#fines-metrics')).toBeVisible();
    await expect(page.locator('#fines-jurisdictions')).toBeVisible();
    await expect(page.locator('#fines-detection')).toBeVisible();
    await expect(page.locator('#fines-slope')).toBeVisible();
    await expect(page.locator('#fines-comparison')).toBeVisible();
  });

  test('renders geographic map canvas', async ({ page }) => {
    await page.goto(`${BASE}/#/fines`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const mapCanvas = page.locator('#fines-map');
    await expect(mapCanvas).toBeVisible();

    const box = await mapCanvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('renders slope chart SVG', async ({ page }) => {
    await page.goto(`${BASE}/#/fines`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const slopeSvg = page.locator('#fines-slope');
    await expect(slopeSvg).toBeVisible();

    const lines = slopeSvg.locator('line');
    const count = await lines.count();
    expect(count).toBeGreaterThan(0);
  });

  test('filters update the header', async ({ page }) => {
    await page.goto(`${BASE}/#/fines`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.selectOption('#fines-jurisdiction', 'NSW');
    await page.waitForTimeout(800);

    // The old rotating header was replaced by per-section stat callouts.
    // Check the map stat callout for updated content after filtering.
    const headerText = await page.locator('#stat-map h2').textContent();
    expect(headerText).toMatch(/NSW|Speeding|enforcement|fined|enforcement actions/i);
  });

  test('ToC sidebar is present', async ({ page }) => {
    await page.goto(`${BASE}/#/fines`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const toc = page.locator('.toc-sidebar');
    await expect(toc).toBeVisible();

    const tocLinks = toc.locator('.toc-link');
    await expect(tocLinks).toHaveCount(7);
  });
});

test.describe('Breath Tests Page', () => {
  test('loads with charts and filters', async ({ page }) => {
    await page.goto(`${BASE}/#/breath-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // The page now exposes per-section stat callouts above each chart.
    const statCallouts = page.locator('.stat-callout');
    await expect(statCallouts).toHaveCount(6);

    const filterBar = page.locator('#filter-bar');
    await expect(filterBar).toBeVisible();

    const selects = filterBar.locator('select');
    await expect(selects).toHaveCount(4);
  });

  test('renders all chart sections', async ({ page }) => {
    await page.goto(`${BASE}/#/breath-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const sections = page.locator('.chart-section');
    await expect(sections).toHaveCount(6);
  });

  test('renders geographic map canvas', async ({ page }) => {
    await page.goto(`${BASE}/#/breath-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const mapCanvas = page.locator('#breath-map');
    await expect(mapCanvas).toBeVisible();

    const box = await mapCanvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('renders slope chart', async ({ page }) => {
    await page.goto(`${BASE}/#/breath-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const slopeSvg = page.locator('#breath-slope');
    await expect(slopeSvg).toBeVisible();

    const lines = slopeSvg.locator('line');
    const count = await lines.count();
    expect(count).toBeGreaterThan(0);
  });

  test('renders age group chart canvas', async ({ page }) => {
    await page.goto(`${BASE}/#/breath-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const canvas = page.locator('#breath-age-chart');
    await expect(canvas).toBeVisible();
  });

  test('filters work correctly', async ({ page }) => {
    await page.goto(`${BASE}/#/breath-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.selectOption('#breath-jurisdiction', 'VIC');
    await page.waitForTimeout(800);

    // Verify a stat callout heading updated (map callout always contains "positive breath").
    const headerText = await page.locator('#stat-map h2').textContent();
    expect(headerText).toMatch(/VIC|positive breath/i);
  });
});

test.describe('Drug Tests Page', () => {
  test('loads with charts and filters', async ({ page }) => {
    await page.goto(`${BASE}/#/drug-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    // The page now exposes per-section stat callouts above each chart.
    const statCallouts = page.locator('.stat-callout');
    await expect(statCallouts).toHaveCount(7);

    const filterBar = page.locator('#filter-bar');
    await expect(filterBar).toBeVisible();

    const selects = filterBar.locator('select');
    await expect(selects).toHaveCount(4);
  });

  test('renders all chart sections', async ({ page }) => {
    await page.goto(`${BASE}/#/drug-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const sections = page.locator('.chart-section');
    await expect(sections).toHaveCount(7);
  });

  test('renders geographic map canvas', async ({ page }) => {
    await page.goto(`${BASE}/#/drug-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const mapCanvas = page.locator('#drug-map');
    await expect(mapCanvas).toBeVisible();

    const box = await mapCanvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('renders slope chart', async ({ page }) => {
    await page.goto(`${BASE}/#/drug-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const slopeSvg = page.locator('#drug-slope');
    await expect(slopeSvg).toBeVisible();
  });

  test('renders substance breakdown chart', async ({ page }) => {
    await page.goto(`${BASE}/#/drug-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const canvas = page.locator('#drug-substances');
    await expect(canvas).toBeVisible();
  });

  test('filters work correctly', async ({ page }) => {
    await page.goto(`${BASE}/#/drug-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    await page.selectOption('#drug-jurisdiction', 'QLD');
    await page.waitForTimeout(800);

    const headerText = await page.locator('#stat-map h2').textContent();
    expect(headerText).toMatch(/QLD|positive drug|positive drug tests/i);
  });
});

test.describe('About Page', () => {
  test('loads with content', async ({ page }) => {
    await page.goto(`${BASE}/#/about`, { waitUntil: 'domcontentloaded' });

    const headings = page.locator('.about-section h2');
    await expect(headings).toHaveCount(5);

    const headingsText = await headings.allTextContents();
    expect(headingsText.some(t => t.includes('About this project'))).toBe(true);
    expect(headingsText.some(t => t.includes('Data sources'))).toBe(true);
    expect(headingsText.some(t => t.includes('Methodology'))).toBe(true);
    expect(headingsText.some(t => t.includes('Data limitations'))).toBe(true);
    expect(headingsText.some(t => t.includes('Colour palette'))).toBe(true);
  });

  test('shows jurisdiction color legend', async ({ page }) => {
    await page.goto(`${BASE}/#/about`, { waitUntil: 'domcontentloaded' });

    const statBoxes = page.locator('.about-section .stat-row .stat-box');
    await expect(statBoxes).toHaveCount(8);
  });
});

test.describe('No JavaScript errors', () => {
  test('console has no errors on homepage', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });

  test('console has no errors on fines page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(`${BASE}/#/fines`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });

  test('console has no errors on breath tests page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(`${BASE}/#/breath-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });

  test('console has no errors on drug tests page', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

    await page.goto(`${BASE}/#/drug-tests`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    expect(errors).toEqual([]);
  });
});
