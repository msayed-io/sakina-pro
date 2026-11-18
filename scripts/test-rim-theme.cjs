const assert = require('node:assert/strict');
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(process.env.SAKINA_TEST_URL || 'http://127.0.0.1:3011');
    await page.locator('nav button').first().click({ trial: true, timeout: 60000 });
    await page.waitForFunction(() => document.querySelectorAll('canvas.qf-specular-rim').length > 0);
    const dark = await page.locator('canvas.qf-specular-rim').count();
    await page.emulateMedia({ colorScheme: 'light' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'light' && !document.querySelector('canvas.qf-specular-rim'));
    assert.equal(await page.locator('[data-qf-rim]').count(), 0);
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark' && document.querySelectorAll('canvas.qf-specular-rim').length > 0);
    assert.deepEqual(errors, []);
    console.log(`Dark → light cleanup → dark restored: PASS (initial rim canvases: ${dark})`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
