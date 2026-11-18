// Run against a production build served at SAKINA_TEST_URL. Optional:
// HADITH_TEST_FIXTURE=/path/to/ara-bukhari.min.json (the real upstream file).
// Tests isolated browser storage; does not alter a user's existing data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const base = process.env.SAKINA_TEST_URL || 'http://127.0.0.1:3011';
  const fixture = process.env.HADITH_TEST_FIXTURE ? fs.readFileSync(process.env.HADITH_TEST_FIXTURE) : null;
  try {
    for (const mode of ['worker', 'unavailable', 'startup-failure']) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      if (fixture) {
        await context.route('https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/**', route =>
          route.fulfill({ status: 200, contentType: 'application/json', body: fixture }));
      }
      const page = await context.newPage();
      const errors = [], workers = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('worker', worker => workers.push(worker.url()));
      page.on('dialog', async dialog => { errors.push(dialog.message()); await dialog.dismiss(); });
      await page.route('**/api/hadith/books', route => route.fulfill({ status: 502, body: '' }));
      if (mode === 'unavailable') await page.addInitScript(() => { window.Worker = undefined; });
      if (mode === 'startup-failure') await page.addInitScript(() => {
        window.Worker = class {
          constructor() { setTimeout(() => this.onerror?.({ message: 'simulated startup failure' }), 0); }
          terminate() {}
        };
      });
      await page.goto(base);
      await page.locator('nav button').first().click({ trial: true, timeout: 60000 });
      await page.locator('nav button').nth(2).click();
      await page.getByRole('button', { name: 'فهمت ذلك' }).click();
      await page.getByTitle('تحميل للقراءة والبحث بدون إنترنت').first().click();
      // Leave the screen while the work is in progress, then return.
      await page.locator('nav button').nth(3).click();
      await page.getByText('حصن المسلم', { exact: true }).waitFor({ state: 'visible' });
      await page.locator('nav button').nth(2).click();
      await page.getByTitle('محمل ومتاح بدون إنترنت - اضغط للحذف').first().waitFor({ state: 'visible', timeout: 90000 });
      const { count, hash } = await page.evaluate(async () => {
        const stored = await new Promise((resolve, reject) => {
          const open = indexedDB.open('hadith_db');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const request = db.transaction('books_data').objectStore('books_data').get('bukhari');
            request.onsuccess = () => { db.close(); resolve(request.result); };
            request.onerror = () => reject(request.error);
          };
        });
        const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(stored)));
        return { count: stored.hadiths.length, hash: Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('') };
      });
      assert.equal(count, 7589, 'The whole Bukhari edition must be stored');
      assert.equal(hash, '26c6b30086d4b2d3ec6fca6b3903d611e76cbc77a6959034b72aab7d06752abb', 'Stored data changed');
      await page.getByPlaceholder('ابحث بالنص أو الكلمة أو رقم الحديث في جميع الكتب النبوية...').fill('2731');
      await page.getByRole('button', { name: 'بحث شامل' }).click();
      await page.getByText('نتائج البحث الشامل', { exact: true }).first().waitFor({ state: 'visible' });
      await page.getByText('جارٍ إجراء البحث الفائق في أمهات كتب السنة...').waitFor({ state: 'hidden', timeout: 30000 });
      assert((await page.locator('body').innerText()).includes('2731'), 'Search results did not appear');
      if (mode === 'worker') assert(workers.filter(url => url.includes('hadith-offline.worker')).length >= 2, 'Index and search should each use the bundled worker');
      else assert.equal(workers.length, 0);
      assert.deepEqual(errors, []);
      console.log(`${mode}: index, navigation during download, exact stored dataset and offline search passed`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
