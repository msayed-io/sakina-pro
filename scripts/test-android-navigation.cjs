// Exercise the Android-mode Vite build served locally (not a real Android device).
// Start a static server for dist with the normal API backend, then run:
// SAKINA_TEST_URL=http://127.0.0.1:3011 node scripts/test-android-navigation.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const errors = [], requests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => requests.push(request.url()));
    await page.addInitScript(() => {
      window.__screenLoaders = [];
      document.addEventListener('DOMContentLoaded', () => {
        new MutationObserver(() => {
          for (const node of document.querySelectorAll('[role="status"]')) {
            const label = (node.getAttribute('aria-label') || node.textContent || '').trim();
            if (!/^جارٍ تحميل (القرآن|كتب الحديث|الأذكار|العداد|أسماء الله الحسنى|الإعدادات|مكتبة سكينة|إعدادات الصلاة|سكينة AI)\.\.\.$/.test(label)) continue;
            const rect = node.getBoundingClientRect();
            const style = getComputedStyle(node);
            if (rect.width && rect.height && style.visibility !== 'hidden' && style.display !== 'none') {
              window.__screenLoaders.push(label);
            }
          }
        }).observe(document.body, { childList: true, subtree: true, attributes: true });
      });
    });
    await page.goto(process.env.SAKINA_TEST_URL || 'http://127.0.0.1:3011');
    await page.locator('nav button').first().click({ trial: true, timeout: 60000 });
    const bootRequests = requests.slice();
    assert(!bootRequests.some(url => url.includes('mp3quran.net/api/')),
      'A screen data request ran before navigation');
    const labels = ['AzkarTabScreen-', 'AzkarReferenceScreen-', 'QuranTabScreen-', 'HadithBooksScreen-', 'SakinaLibraryScreen-', 'SakeenahAIScreen-', 'AsmaAlHusnaScreen-', 'SettingsScreen-', 'PrayerSettingsScreen-'];
    for (const label of labels) assert(bootRequests.some(url => url.includes(label)), `Not prepared at boot: ${label}`);

    await page.locator('nav button').nth(1).click();
    await page.getByText('الاستماع', { exact: true }).first().waitFor({ state: 'visible' });
    await page.locator('nav button').nth(2).click();
    await page.getByRole('button', { name: 'فهمت ذلك' }).click();
    await page.getByRole('button', { name: /الدروس والمحاضرات/ }).click();
    await page.getByRole('button', { name: 'الخروج من مكتبة سكينة' }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'الخروج من مكتبة سكينة' }).click();
    await page.locator('nav button').nth(3).click();
    await page.getByRole('button', { name: /أذكار الصباح إشراقة يومك/ }).click();
    await page.locator('#az_back').waitFor({ state: 'visible' });
    await page.locator('#az_back').click();
    await page.getByRole('button', { name: /أسماء الله الحسنى تعلّم/ }).click();
    await page.getByRole('button', { name: 'رجوع', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'رجوع', exact: true }).click();
    await page.locator('nav button').first().click();
    await page.getByRole('button', { name: 'فتح الإعدادات' }).first().click();
    await page.getByRole('button', { name: 'رجوع', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'رجوع', exact: true }).click();
    await page.getByRole('button', { name: /إعدادات الإشعار/ }).first().click();
    await page.getByRole('button', { name: 'الخروج', exact: true }).waitFor({ state: 'visible' });
    await page.getByRole('button', { name: 'الخروج', exact: true }).click();
    await page.locator('nav button').nth(4).click();
    await page.getByRole('button', { name: 'المتابعة باستخدام Google' }).waitFor({ state: 'visible' });
    assert.deepEqual(await page.evaluate(() => window.__screenLoaders), []);
    assert.deepEqual(errors, []);
    console.log(`${process.env.SAKINA_BUILD_NAME || 'Android-mode'} browser test: all nine screen modules prepared before navigation.`);
    console.log('Quran, books, library, azkar, counter, names, settings, prayer settings and AI entry opened without screen-loading fallbacks.');
    console.log('No Quran-reciter or Hadith data request was started by preloading screen code.');
    await context.close();

    // A deliberately delayed bundled chunk tests the bounded startup and, more
    // importantly, that a late module never remounts an already active page.
    const slow = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const slowPage = await slow.newPage();
    let delayed = false;
    await slowPage.route('**/assets/QuranTabScreen-*.js', async route => {
      delayed = true;
      await new Promise(resolve => setTimeout(resolve, 7000));
      await route.continue();
    });
    const started = Date.now();
    await slowPage.goto(process.env.SAKINA_TEST_URL || 'http://127.0.0.1:3011', { waitUntil: 'domcontentloaded' });
    await slowPage.locator('nav button').first().click({ trial: true, timeout: 30000 });
    const startupMs = Date.now() - started;
    assert(delayed && startupMs < 10000, `Bounded startup failed: ${startupMs} ms`);
    await slowPage.locator('nav button').nth(3).click();
    const task = slowPage.getByRole('button', { name: 'صلاة الفجر في وقتها', exact: true });
    await task.click();
    await slowPage.evaluate(() => {
      window.__trackedTask = [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'صلاة الفجر في وقتها');
    });
    await slowPage.waitForTimeout(5000);
    assert(await slowPage.evaluate(() => window.__trackedTask?.isConnected &&
      [...document.querySelectorAll('button')].find(button => button.textContent.trim() === 'صلاة الفجر في وقتها') === window.__trackedTask));
    assert((await slowPage.locator('body').innerText()).includes('1 / 12'), 'Azkar task state was lost');
    await slowPage.locator('nav button').nth(1).click();
    await slowPage.getByText('الاستماع', { exact: true }).first().waitFor({ state: 'visible', timeout: 30000 });
    await slow.close();
    console.log(`Delayed-module test: startup ${startupMs} ms; active screen and task state preserved.`);

    // Use real bundled assets with all external and app data API requests blocked.
    const offline = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const offlinePage = await offline.newPage();
    await offlinePage.route('**/*', route => {
      const url = new URL(route.request().url());
      return !['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname.startsWith('/api/')
        ? route.abort() : route.continue();
    });
    await offlinePage.goto(process.env.SAKINA_TEST_URL || 'http://127.0.0.1:3011', { waitUntil: 'domcontentloaded' });
    await offlinePage.locator('nav button').first().click({ trial: true, timeout: 30000 });
    await offlinePage.locator('nav button').nth(1).click();
    await offlinePage.getByText('الاستماع', { exact: true }).first().waitFor({ state: 'visible' });
    await offlinePage.locator('nav button').nth(2).click();
    await offlinePage.getByRole('button', { name: 'فهمت ذلك' }).click();
    await offlinePage.getByText('صحيح البخاري', { exact: true }).first().waitFor({ state: 'visible' });
    await offlinePage.locator('nav button').nth(3).click();
    await offlinePage.getByText('حصن المسلم', { exact: true }).waitFor({ state: 'visible' });
    await offline.close();
    console.log('Simulated offline test: listening, local book metadata, and azkar opened.');

    // Public shared-conversation routes do not need any of the app tabs.
    const shared = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const sharedPage = await shared.newPage();
    const sharedRequests = [];
    sharedPage.on('request', request => sharedRequests.push(request.url()));
    const base = process.env.SAKINA_TEST_URL || 'http://127.0.0.1:3011';
    await sharedPage.goto(new URL('/shared/chat/' + 'a'.repeat(32), base).href, { waitUntil: 'domcontentloaded' });
    await sharedPage.waitForTimeout(4000);
    assert(!sharedRequests.some(url => labels.some(label => url.includes(label))), 'Shared link unnecessarily loaded app screens');
    await shared.close();
    console.log('Public shared-link route: no unrelated app screen bundles loaded.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
