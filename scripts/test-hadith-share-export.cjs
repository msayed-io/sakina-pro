// Run against a running app, e.g. node scripts/test-hadith-share-export.cjs
// Optional: SAKINA_TEST_URL=http://127.0.0.1:3000
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 1500 },
      colorScheme: 'dark',
      acceptDownloads: true,
    });
    page.setDefaultTimeout(30000);
    // Exercise the real low-memory quality ladder to keep this test lightweight.
    await page.addInitScript(() => Object.defineProperty(navigator, 'deviceMemory', { value: 1, configurable: true }));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.SAKINA_TEST_URL || 'http://127.0.0.1:3000');
    await page.locator('nav button').nth(2).click();
    await page.getByRole('button', { name: 'فهمت ذلك' }).click();
    await page.getByRole('button', { name: 'فتح وتصفح الكتاب' }).first().click();
    await page.locator('button[title="مشاركة الحديث"]').nth(1).click();
    await page.waitForFunction(() => document.querySelector('#hshare-o_nm')?.textContent === '٢');
    await page.waitForTimeout(600);

    // Show the full-size card for comparison without changing its inner layout.
    await page.evaluate(() => {
      const card = document.querySelector('#hshare-card');
      Object.assign(card.style, { position: 'fixed', top: '0', left: '0', zIndex: '9999' });
      for (let parent = card.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        parent.style.transform = 'none';
        parent.style.overflow = 'visible';
      }
    });
    const preview = await page.locator('#hshare-card').screenshot();
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 90000 }),
      page.locator('#hshare-dl').evaluate(button => button.click()),
    ]);
    const png = fs.readFileSync(await download.path());
    const comparison = await page.evaluate(async ({ preview, png }) => {
      const load = data => new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = reject;
        image.src = `data:image/png;base64,${data}`;
      });
      const [first, second] = await Promise.all([load(preview), load(png)]);
      const canvas = document.createElement('canvas');
      canvas.width = first.width;
      canvas.height = first.height;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(first, 0, 0);
      const before = context.getImageData(0, 0, canvas.width, canvas.height).data;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(second, 0, 0, canvas.width, canvas.height);
      const after = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let total = 0, samples = 0;
      for (let y = 0; y < canvas.height; y += 4) {
        for (let x = 0; x < canvas.width; x += 4) {
          const i = (y * canvas.width + x) * 4;
          for (let channel = 0; channel < 3; channel++) {
            total += Math.abs(before[i + channel] - after[i + channel]);
            samples++;
          }
        }
      }
      canvas.width = canvas.height = 0;
      return { meanDifference: total / samples, leaked: document.body.classList.contains('hshare-export-metrics') };
    }, { preview: preview.toString('base64'), png: png.toString('base64') });
    assert(comparison.meanDifference < 12, `Preview/PNG differ too much: ${comparison.meanDifference}`);
    assert.equal(comparison.leaked, false, 'Export measurement class was not removed');
    assert.deepEqual(errors, []);
    console.log(`Preview/PNG mean RGB difference: ${comparison.meanDifference.toFixed(2)} / 255`);
    console.log('Export measurement class cleaned up; no page errors.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
