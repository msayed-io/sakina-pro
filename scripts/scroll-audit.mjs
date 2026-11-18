/**
 * Scroll ownership audit — Sakinah (adapted from scroll-audit.mjs to this
 * app's architecture). "No page left behind."
 *
 * Why adapted: this app has NO URL router. Tabs and sub-screens are a React
 * state machine in src/App.tsx with sub-routers in QuranTabScreen
 * (currentScreen) and HadithBooksScreen (viewMode), plus full-screen fixed
 * overlays. There is no a[href] to click and no popstate to dispatch —
 * a reload proves nothing about scroll leakage, exactly as the stock script
 * says. The runner performs navigation through real in-app controls and
 * separately probes native desktop-wheel and mobile-touch scrolling over
 * the home content. Programmatic scrollTop assignments elsewhere only set
 * positions for transition checks; they are not evidence that user input
 * can scroll. Every transition logged as `how` is an in-app control click —
 * never `page.goto` (except the initial load).
 *
 *   node scripts/scroll-audit.mjs --base=http://127.0.0.1:4173
 *
 * Exit code 1 if any reachable screen fails or cannot be navigated to
 * in-app. Screens that cannot be reached in this environment are printed
 * as NOT_CHECKED with reasons (see scripts/routes.mjs) — they never count
 * as PASS.
 */
import { chromium } from 'playwright';
import { screens, notAudited } from './routes.mjs';

const base = (process.argv.find(a => a.startsWith('--base=')) || '--base=http://127.0.0.1:4173').slice(7);

const MEASURE = `(() => {
  const root = document.scrollingElement || document.documentElement;
  const style = getComputedStyle(document.documentElement);
  const inner = [...document.querySelectorAll('*')].filter(el => {
    const s = getComputedStyle(el);
    return /auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1 && el.getClientRects().length;
  });
  return {
    scrollY: Math.round(window.scrollY || root.scrollTop || 0),
    innerCount: inner.length,
    innerMax: inner.reduce((n, el) => Math.max(n, el.scrollTop), 0),
    scrollable: root.scrollHeight > root.clientHeight + 1 || inner.length > 0,
    bodyOverflow: getComputedStyle(document.body).overflow,
    htmlOverflow: style.overflow,
    scrollbarHidden: style.scrollbarWidth === 'none' || getComputedStyle(document.body).scrollbarWidth === 'none',
    overscroll: style.overscrollBehavior.split(' ')[0]
  };
})()`;

const rows = [];
let failures = 0;

const weather = { current_weather: { temperature: 24, weathercode: 0, is_day: 1, windspeed: 5, winddirection: 100, time: '2026-11-14T10:30' } };
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--disable-gpu', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'ar', timezoneId: 'Africa/Cairo', colorScheme: 'dark' });
await context.route('**/api.open-meteo.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(weather) }));
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const measure = () => page.evaluate(MEASURE);
const scrollAllToBottom = () => page.evaluate(() => {
  const root = document.scrollingElement || document.documentElement;
  root.scrollTop = root.scrollHeight;
  for (const el of document.querySelectorAll('*')) {
    const s = getComputedStyle(el);
    if (/auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) el.scrollTop = el.scrollHeight;
  }
});
const wait = (ms) => page.waitForTimeout(ms);
const visible = (sel) => page.locator(sel).first().isVisible().catch(() => false);
const click = async (sel, ms = 700) => { await page.locator(sel).first().click({ timeout: 5000 }); await wait(ms); };

const clickSoft = async (sel, ms = 400) => {
  await page.evaluate((s) => { const el = [...document.querySelectorAll(s)].find(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none'); el && el.click(); }, sel);
  await wait(ms);
};
// real user click with :visible filter — the DOM also carries mounted-but-hidden copies
// (e.g. the auth gate's invisible disabled رجوع); Playwright must not pick them.
// Fails loudly (step marked FAIL) if an overlay/modal intercepts the visible control.
const clickEvaluate = async (sel) => { await click(sel.trim() + ':visible', 800); };

async function anchorMain() {
  // Close any open full-screen surface using its real control, in priority order.
  // clickSoft never hangs on exiting/hidden nodes; worst case the loop just re-tries.
  for (let i = 0; i < 10; i++) {
    // prayer-settings unsaved-changes guard: fresh-state isDirty pops «التغييرات غير محفوظة» — real users must dismiss it too
    if (await visible('button:has-text("امسح التغييرات")')) { await page.locator('button:has-text("امسح التغييرات")').first().click({ timeout: 5000 }); await wait(700); continue; }
    if (await visible('[aria-label="Drag to dismiss or click to close player"]')) { await clickSoft('[aria-label="Drag to dismiss or click to close player"]'); continue; }
    if (await visible('button[aria-label="الخروج من مكتبة سكينة"]')) { await clickSoft('button[aria-label="الخروج من مكتبة سكينة"]'); continue; }
    if (await visible('button[title="رجوع"]')) { await clickSoft('button[title="رجوع"]'); continue; }          // azkar counter
    if (await visible('button[aria-label="رجوع"]:visible')) { await clickSoft('button[aria-label="رجوع"]'); continue; }   // settings / asma / auth / AI
    if (await visible('div.fixed.inset-0.z-50.overflow-y-auto button[aria-label="الخروج"]')) { await page.locator('div.fixed.inset-0.z-50.overflow-y-auto button[aria-label="الخروج"]').first().click({ timeout: 5000 }); await wait(700); continue; }
    // surahs screen (quran sub-router): the only visible chevron-right button is back
    if (await page.locator('text=تشغيل الكل').first().isVisible().catch(() => false)) { await clickSoft('button:has(svg.lucide-chevron-right)'); continue; }
    break;
  }
  // Bottom nav is visible on document-owned tabs (hidden in settings/ai/player/counter/surahs).
  if (await visible('nav button')) {
    const active = await page.evaluate(() => [...document.querySelectorAll('nav button')].findIndex(b => b.className.includes('px-4')));
    if (active !== 0) { await page.locator('nav button').first().click({ timeout: 5000 }); await wait(600); }
  }
}

const navTab = async (index) => { await page.locator('nav button').nth(index).click({ timeout: 5000 }); await wait(1300); };

function record(row) { rows.push(row); if (row.verdict.startsWith('FAIL')) failures++; console.log(JSON.stringify(row)); }

async function probeNativeScroll(page, gesture) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await wait(150);
  const before = await page.evaluate(() => window.scrollY);
  const point = await page.evaluate(() => ({ x: Math.round(innerWidth / 2), y: Math.round(innerHeight * 0.55) }));

  if (gesture === 'wheel') {
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, 520);
  } else {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: point.x, y: point.y }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - 150 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - 320 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }

  await wait(350);
  const after = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await wait(150);
  return { before, after };
}

async function checkNativeInput() {
  const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'ar', timezoneId: 'Africa/Cairo', colorScheme: 'dark' });
  await desktopContext.route('**/api.open-meteo.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(weather) }));
  const desktopPage = await desktopContext.newPage();
  await desktopPage.goto(base, { waitUntil: 'domcontentloaded' });
  await wait(1800);

  const wheel = await probeNativeScroll(desktopPage, 'wheel');
  const touch = await probeNativeScroll(page, 'touch');
  const fails = [];
  if (wheel.after <= wheel.before) fails.push(`desktop wheel did not move the document (scrollY ${wheel.before} → ${wheel.after})`);
  if (touch.after <= touch.before) fails.push(`mobile touch swipe did not move the document (scrollY ${touch.before} → ${touch.after})`);
  record({ route: 'main (native input)', how: 'desktop wheel + mobile touch swipe over page content', owner: 'document', scrollY: `wheel=${wheel.after}; touch=${touch.after}`, inners: 'n/a', scrollbar: 'hidden', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
  await desktopContext.close();
}

async function probeNativeScrollAt(page, selector, gesture) {
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await wait(150);
  const target = page.locator(selector).first();
  await target.scrollIntoViewIfNeeded({ timeout: 5000 });
  await wait(150);
  const box = await target.boundingBox();
  if (!box) throw new Error(`scroll target not visible: ${selector}`);
  const point = await page.evaluate(({ x, y }) => ({
    x: Math.max(2, Math.min(innerWidth - 2, Math.round(x))),
    y: Math.max(45, Math.min(innerHeight - 70, Math.round(y)))
  }), { x: box.x + box.width / 2, y: box.y + box.height / 2 });
  const onTarget = await target.evaluate((el, p) => {
    const hit = document.elementFromPoint(p.x, p.y);
    return hit === el || (hit && el.contains(hit));
  }, point);
  if (!onTarget) throw new Error(`gesture point did not hit the requested target: ${selector}`);
  const before = await page.evaluate(() => window.scrollY);

  if (gesture === 'wheel') {
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, 520);
  } else {
    const cdp = await page.context().newCDPSession(page);
    // Keep the full swipe on-screen even when the card is near the top.
    const distance = Math.min(320, point.y - 20);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - distance / 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: point.x, y: point.y - distance }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await cdp.detach();
  }

  await wait(350);
  const after = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await wait(120);
  return { before, after };
}

async function auditScrollSurfaces({ width, height, mobile, gesture }) {
  const surfaceContext = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, locale: 'ar', timezoneId: 'Africa/Cairo', colorScheme: 'dark' });
  await surfaceContext.route('**/api.open-meteo.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(weather) }));
  // Use the app's bundled 114-surah fallback; live API reciters can have only
  // one surah, in which case there is genuinely no scroll range to test.
  await surfaceContext.route(/https:\/\/www\.mp3quran\.net\/api\/v3\/reciters/, (r) => r.abort());
  const fixtureCatalog = {
    version: 'scroll-audit',
    reciters: Array.from({ length: 10 }, (_, reciterIndex) => ({
      id: reciterIndex === 0 ? 'mohammed-siddiq-al-minshawi' : `scroll-audit-reciter-${reciterIndex}`,
      name: reciterIndex === 0 ? 'محمد صديق المنشاوي' : `قارئ تجريبي ${reciterIndex + 1}`,
      folder: `scroll-audit-${reciterIndex + 1}`,
      tracks: Array.from({ length: 24 }, (_, trackIndex) => ({
        surahId: trackIndex + 1,
        url: `https://audio.invalid/scroll-audit/${reciterIndex + 1}/${String(trackIndex + 1).padStart(3, '0')}.mp3`
      }))
    }))
  };
  await surfaceContext.route('**/quran-audio/catalog/manifest.json', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fixtureCatalog) }));
  const surfacePage = await surfaceContext.newPage();
  await surfacePage.goto(base, { waitUntil: 'domcontentloaded' });
  await wait(2200);

  const nav = async (index) => { await surfacePage.locator('nav button').nth(index).click({ timeout: 5000 }); await wait(1000); };
  const results = [];
  await nav(1);
  results.push(['quran reciter list', await probeNativeScrollAt(surfacePage, 'button:has-text("مشاري العفاسي"):visible', gesture)]);

  await surfacePage.locator('button:has-text("مشاري العفاسي"):visible').first().click({ timeout: 5000 });
  await wait(700);
  results.push(['quran sheikh surah list', await probeNativeScrollAt(surfacePage, '.space-y-3 > div:visible', gesture)]);

  await surfacePage.evaluate(() => {
    const back = [...document.querySelectorAll('button')].find((button) => button.getClientRects().length && button.querySelector('svg.lucide-chevron-right'));
    back?.click();
  });
  await wait(800);
  await surfacePage.locator('button[aria-label="فتح صفحة التلاوات النقية"]:visible').click({ timeout: 5000 });
  await surfacePage.getByText('قارئ تجريبي 2', { exact: false }).first().waitFor({ state: 'visible', timeout: 10000 });
  results.push(['pure recitations list', await probeNativeScrollAt(surfacePage, 'button:has-text("قارئ تجريبي 2"):visible', gesture)]);

  await surfacePage.locator('button:has-text("محمد صديق المنشاوي"):visible').last().click({ timeout: 5000 });
  await wait(700);
  results.push(['pure reciter profile surah list', await probeNativeScrollAt(surfacePage, '.space-y-3 > div:visible', gesture)]);

  await surfacePage.locator('button[aria-label="العودة إلى القراء"]:visible').click({ timeout: 5000 });
  await wait(600);
  await surfacePage.locator('button[aria-label="الخروج إلى صفحة الاستماع"]:visible').click({ timeout: 5000 });
  await wait(800);
  await nav(3);
  results.push(['azkar category cards', await probeNativeScrollAt(surfacePage, 'button:has-text("أذكار الصباح"):visible', gesture)]);

  for (const [route, result] of results) {
    const fails = result.after <= result.before ? [`${gesture} over card did not move document (scrollY ${result.before} → ${result.after})`] : [];
    record({ route: `${route} (${mobile ? 'mobile' : 'desktop'})`, how: gesture === 'wheel' ? 'mouse wheel over the card itself' : 'touch swipe over the card itself', owner: 'document', scrollY: result.after, inners: 'n/a', scrollbar: 'hidden', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
  }
  await surfaceContext.close();
}

async function checkReportedSurfaceInput() {
  await auditScrollSurfaces({ width: 1440, height: 900, mobile: false, gesture: 'wheel' });
  await auditScrollSurfaces({ width: 390, height: 844, mobile: true, gesture: 'touch' });
}

async function checkDocument(route, how, entered, scrolled) {
  const fails = [];
  if (entered.scrollY !== 0) fails.push(`entered at scrollY=${entered.scrollY}`);
  if (entered.innerMax !== 0) fails.push(`inner container kept scrollTop=${entered.innerMax}`);
  if (!entered.scrollbarHidden) fails.push('scrollbar not hidden');
  if (entered.htmlOverflow === 'hidden' || entered.bodyOverflow === 'hidden') fails.push('html/body overflow hidden (a stuck modal lock)');
  if (entered.scrollable) {
    // The destination itself must actually move (the source's scrolled state is not evidence).
    await scrollAllToBottom(); await wait(300);
    const probe = await measure();
    if (!(probe.scrollY > 0 || probe.innerMax > 0)) fails.push('nothing scrolled: scrolling is dead');
  }
  record({ route, how, owner: 'document', scrollY: entered.scrollY, inners: `${entered.innerCount}/${entered.innerMax}`, scrollbar: entered.scrollbarHidden ? 'hidden' : 'VISIBLE', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
}

function checkPanel(route, how, entered, extraFails = [], { bodyLockExpected = false } = {}) {
  const fails = [...extraFails];
  if (entered.innerMax !== 0) fails.push(`inner container kept scrollTop=${entered.innerMax}`);
  if (!entered.scrollbarHidden) fails.push('scrollbar not hidden');
  if (entered.htmlOverflow === 'hidden') fails.push('html overflow hidden (the modal lock applies to body only — html must never be locked)');
  if (!bodyLockExpected && entered.bodyOverflow === 'hidden') fails.push('body overflow hidden (a stuck modal lock)');
  if (bodyLockExpected && entered.bodyOverflow !== 'hidden') fails.push('opaque full-screen overlay open WITHOUT the body scroll lock (wheel would drag the document behind it)');
  record({ route, how, owner: 'panel', scrollY: entered.scrollY, inners: `${entered.innerCount}/${entered.innerMax}`, scrollbar: entered.scrollbarHidden ? 'hidden' : 'VISIBLE', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
}

async function step(name, how, fn) {
  try { await fn(); } catch (e) { failures++; const row = { route: name, how, verdict: 'FAIL — ' + String(e.message || e).slice(0, 160) }; rows.push(row); console.log(JSON.stringify(row)); }
}

console.log(`base=${base} screens=${screens.length}`);
await page.goto(base, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle').catch(() => {}); await wait(4000);
await checkNativeInput();
await checkReportedSurfaceInput();

// ───────── Document-owned tab chain (each transition is a real in-app nav) ─────────
// main → quran
await step('main', 'initial load', async () => {
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  await navTab(1);
  const entered = await measure();
  await await checkDocument('quran', 'bottom-nav → القرآن', entered, scrolled);
});
// quran → surahs (sub-router; regression probe for the new layer-1 placement)
await step('quran', "in-app → سور القارئ", async () => {
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.includes('العفاسي')); el && el.click(); }); await wait(1500);
  const entered = await measure();
  await checkDocument('surahs', 'select reciter → surahs', entered, scrolled);
});
// surahs → player (fixed surface; player must open from a scrolled surahs list)
await step('surahs', 'in-app → player', async () => {
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'تشغيل الكل'); el && el.click(); }); await wait(2500);
  const playerVisible = await visible('[aria-label="Drag to dismiss or click to close player"]');
  const entered = await measure();
  // Player is a full-screen modal: QuranTabScreen sets body overflow:hidden while open and
  // RESTORES it on close (spec §3 modal rule). We assert the lock exists (defense) — restoration is asserted after close.
  const bodyLocked = entered.bodyOverflow === 'hidden' || entered.htmlOverflow === 'hidden';
  const fails = [];
  if (!playerVisible) fails.push('player did not open (play did not start)');
  if (!entered.scrollbarHidden) fails.push('scrollbar not hidden');
  if (!bodyLocked) fails.push('player open without body scroll lock (document would scroll behind the modal)');
  record({ route: 'player', how: 'تشغيل الكل (in-app)', owner: 'fixed', scrollY: entered.scrollY, inners: `${entered.innerCount}/${entered.innerMax}`, scrollbar: entered.scrollbarHidden ? 'hidden' : 'VISIBLE', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
});
// player → close → surahs (back keeps position: document untouched by the fixed player)
await step('player', 'close player (tap drag handle)', async () => {
  const before = await measure();
  await clickEvaluate('[aria-label="Drag to dismiss or click to close player"]');
  const entered = await measure();
  const fails = [];
  if (entered.htmlOverflow === 'hidden' || entered.bodyOverflow === 'hidden') fails.push('body scroll lock not restored after player close');
  if (entered.innerMax !== before.innerMax) fails.push(`surahs scroller moved across player (was ${before.innerMax}, now ${entered.innerMax})`);
  if (entered.scrollY !== before.scrollY) fails.push(`surahs document moved across player (was ${before.scrollY}, now ${entered.scrollY})`);
  record({ route: 'surahs (after player)', how: 'close player', owner: 'document', scrollY: entered.scrollY, inners: `${entered.innerCount}/${entered.innerMax}`, scrollbar: entered.scrollbarHidden ? 'hidden' : 'VISIBLE', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
});
// quran: الاستماع (document owner) ↔ reading subtree — positions must not bleed.
// Headless has no quran pack ⇒ the reading mode shows the QuranDownloadScreen portal gate;
// if the pack IS present it mounts QuranReadingGatewayScreen (fixed panel + inner scroller).
// Both states are handled honestly: the assertion is that the listening document position is
// preserved and that the document behind the opaque panel is not draggable.
async function readingState() {
  const downloadGate = await page.getByText('تنزيل المصحف', { exact: false }).first().isVisible().catch(() => false);
  const gateway = await page.locator('.hide-scrollbar').first().isVisible().catch(() => false);
  return { downloadGate, gateway };
}

await step('surahs (after player)', 'الاستماع → reading subtree', async () => {
  // الـdropdown بتاع نمط العرض موجود في شاشة القراء فقط — ارجع من قائمة السور للقرّاء أولًا
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(b => b.getClientRects().length && b.querySelector('svg.lucide-chevron-right')); el && el.click(); }); await wait(800);
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  const docY = scrolled.scrollY;
  globalThis.__quranDocY = docY;
  // open the mode dropdown in listening mode, then pick «القرآن الكريم»
  await click('button:has-text("الاستماع")', 700);
  await click('button:has-text("القرآن الكريم")', 1500);
  const entered = await measure();
  const state = await readingState();
  const fails = [];
  if (entered.scrollY !== docY) fails.push(`document moved across mode switch (was ${docY}, now ${entered.scrollY})`);
  if (!state.downloadGate && !state.gateway) fails.push('reading subtree did not mount (neither download gate nor gateway visible)');
  // wheel over the opaque panel must not drag the document behind it
  await page.mouse.move(195, 420); await page.mouse.wheel(0, 600); await wait(300);
  const afterWheel = await measure();
  if (afterWheel.scrollY !== docY) fails.push(`wheel over reading panel dragged the document (was ${docY}, now ${afterWheel.scrollY})`);
  record({ route: 'quran-reading', how: state.downloadGate ? 'القرآن الكريم (download gate — no pack headless)' : 'القرآن الكريم (reading panel)', owner: 'panel', scrollY: entered.scrollY, inners: `${entered.innerCount}/${entered.innerMax}`, scrollbar: entered.scrollbarHidden ? 'hidden' : 'VISIBLE', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
});
await step('quran-reading', 'back to الاستماع (listening position preserved)', async () => {
  const docY = globalThis.__quranDocY;
  const state = await readingState();
  if (state.downloadGate) {
    // بوابة التنزيل تعرض زر رجوعًا صريحًا يعيد الاستماع
    await clickEvaluate('button[aria-label="رجوع"]');
  } else {
    // الـgateway نفسه ثابت — افتح قائمة النمط منه ثم اختر الاستماع
    await click('button:has-text("القرآن الكريم")', 600);
    await click('button:has-text("الاستماع")', 1000);
  }
  const entered = await measure();
  const fails = [];
  if (entered.scrollY !== docY) fails.push(`listening document position lost across mode switch (expected ${docY}, got ${entered.scrollY})`);
  const stillGate = await page.getByText('تنزيل المصحف', { exact: false }).first().isVisible().catch(() => false);
  if (stillGate) fails.push('download gate still visible after رجوع (mode did not switch back)');
  record({ route: 'quran (listening again)', how: 'رجوع → الاستماع', owner: 'document', scrollY: entered.scrollY, inners: `${entered.innerCount}/${entered.innerMax}`, scrollbar: entered.scrollbarHidden ? 'hidden' : 'VISIBLE', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
});

// surahs → hadith (leave sub-router via bottom nav)
await step('quran (reciters)', 'bottom-nav → الكتب', async () => {
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(b => b.getClientRects().length && b.querySelector('svg.lucide-chevron-right')); el && el.click(); }); await wait(800);
  await navTab(2);
  const entered = await measure();
  await checkDocument('hadith', 'bottom-nav → الكتب', entered, scrolled);
});
// hadith → azkar
await step('hadith', 'bottom-nav → الأذكار', async () => {
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  await navTab(3);
  const entered = await measure();
  await checkDocument('azkar', 'bottom-nav → الأذكار', entered, scrolled);
});
// azkar → sakeenah-ai
await step('azkar', 'bottom-nav → سكينة AI', async () => {
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  await navTab(4);
  const entered = await measure();
  await checkDocument('sakeenah-ai', 'bottom-nav → سكينة AI', entered, scrolled);
});
// sakeenah-ai → main (in-app back; exercises the app back control + layer-1 reset)
await step('sakeenah-ai', 'back → الرئيسية', async () => {
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  await clickEvaluate('button[aria-label="رجوع"]');
  const entered = await measure();
  await checkDocument('main (after ai)', 'back button → الرئيسية', entered, scrolled);
});
// main → settings (gear; layer-1 reset on tab change)
await step('main', 'gear → الإعدادات', async () => {
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  // while scrolled the hero gear is pointer-events:none by design and the app shows
  // a fixed header gear; use it (fallback: DOM click on the hero gear).
  const fixedGear = page.locator('div.fixed.top-4 button[aria-label="فتح الإعدادات"]').first();
  if (await fixedGear.isVisible().catch(() => false)) { await fixedGear.click(); await wait(1200); }
  else { await clickEvaluate('[aria-label="فتح الإعدادات"]'); }
  const entered = await measure();
  await checkDocument('settings', 'fixed gear (visible while scrolled)', entered, scrolled);
});
// settings → main (back; layer-1 reset)
await step('settings', 'back → الرئيسية', async () => {
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  await clickEvaluate('button[aria-label="رجوع"]');
  const entered = await measure();
  await checkDocument('main (after settings)', 'back button → الرئيسية', entered, scrolled);
});

// ───────── Panel-owned fixed overlays (document is untouched; panel starts at top) ─────────
async function openMainAndScroll() { await anchorMain(); const scrolled = (await scrollAllToBottom(), await wait(300), await measure()); return scrolled; }

await step('main', 'speaker icon → prayer-settings panel', async () => {
  const scrolled = await openMainAndScroll();
  const docY = scrolled.scrollY;
  await page.locator('[aria-label^="إعدادات الإشعار"]').last().click({ timeout: 5000 }); await wait(900);
  const entered = await measure();
  checkPanel('prayer-settings', 'speaker → prayer-settings', entered, entered.scrollY !== docY ? [`document moved across panel (was ${docY}, now ${entered.scrollY})`] : []);
});
await step('prayer-settings', 'close prayer-settings (back to main, position kept)', async () => {
  const before = await measure();
  await scrollAllToBottom(); await wait(300);
  await clickEvaluate('div.fixed.inset-0.z-50.overflow-y-auto button[aria-label="الخروج"]');
  // fresh-state guard pops «التغييرات غير محفوظة» — discard is the neutral no-save path
  const discard = page.locator('button:has-text("امسح التغييرات")').first();
  if (await discard.isVisible().catch(() => false)) { await discard.click({ timeout: 5000 }); await wait(800); }
  const panelGone = !(await page.locator('div.fixed.inset-0.z-50.overflow-y-auto:has(button[aria-label="الخروج"])').first().isVisible().catch(() => false));
  const entered = await measure();
  const fails = [];
  if (!panelGone) fails.push('prayer-settings panel still visible after close attempt');
  if (entered.scrollY !== before.scrollY) fails.push(`main position lost across prayer-settings (was ${before.scrollY}, now ${entered.scrollY})`);
  record({ route: 'main (after prayer-settings)', how: 'إغلاق → back to main', owner: 'document', scrollY: entered.scrollY, inners: `${entered.innerCount}/${entered.innerMax}`, scrollbar: entered.scrollbarHidden ? 'hidden' : 'VISIBLE', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
});

await step('main', 'azkar → counter panel', async () => {
  await anchorMain(); await navTab(3);
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  const docY = scrolled.scrollY;
  globalThis.__azkarDocY = docY;
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.includes('أذكار الصباح')); el && el.click(); }); await wait(1500);
  const entered = await measure();
  checkPanel('azkar-counter', 'الأذكار → أذكار الصباح', entered, [], { bodyLockExpected: true });
});
await step('azkar-counter', 'close counter (azkar position must now be PRESERVED)', async () => {
  // العداد لم يعد يخفي الأذكار من التدفق — الموضع يجب أن يبقى كما كان قبل الفتح
  await clickEvaluate('button[title="رجوع"]');
  const entered = await measure();
  const fails = [];
  const docY = globalThis.__azkarDocY ?? 0;
  if (entered.scrollY !== docY) fails.push(`azkar position lost across counter round trip (was ${docY}, now ${entered.scrollY})`);
  record({ route: 'azkar (after counter)', how: 'رجوع → azkar', owner: 'document', scrollY: entered.scrollY, inners: `${entered.innerCount}/${entered.innerMax}`, scrollbar: entered.scrollbarHidden ? 'hidden' : 'VISIBLE', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
});

await step('main', 'azkar → asma-al-husna panel', async () => {
  await anchorMain(); await navTab(3);
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  const docY = scrolled.scrollY;
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.includes('أسماء الله الحسنى')); el && el.click(); }); await wait(1500);
  const entered = await measure();
  checkPanel('asma-al-husna', 'الأذكار → أسماء الله الحسنى', entered, entered.scrollY !== docY ? [`document moved across panel (was ${docY}, now ${entered.scrollY})`] : [], { bodyLockExpected: true });
});
await step('asma-al-husna', 'close asma (document position kept)', async () => {
  const before = await measure();
  await scrollAllToBottom(); await wait(300);
  await click('button[aria-label="رجوع"]', 800);
  const entered = await measure();
  const fails = [];
  if (entered.scrollY !== before.scrollY) fails.push(`azkar position lost across asma (was ${before.scrollY}, now ${entered.scrollY})`);
  record({ route: 'azkar (after asma)', how: 'رجوع → azkar', owner: 'document', scrollY: entered.scrollY, inners: `${entered.innerCount}/${entered.innerMax}`, scrollbar: entered.scrollbarHidden ? 'hidden' : 'VISIBLE', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
});

await step('main', 'hadith → sakina-library panel', async () => {
  await anchorMain(); await navTab(2);
  const scrolled = (await scrollAllToBottom(), await wait(300), await measure());
  const docY = scrolled.scrollY;
  await page.evaluate(() => { const el = [...document.querySelectorAll('button')].find(b => b.textContent.includes('الدروس والمحاضرات')); el && el.click(); }); await wait(1500);
  const entered = await measure();
  checkPanel('sakina-library', 'الكتب → مكتبة سكينة', entered, entered.scrollY !== docY ? [`document moved across panel (was ${docY}, now ${entered.scrollY})`] : [], { bodyLockExpected: true });
});
await step('sakina-library', 'close library (document position kept)', async () => {
  const before = await measure();
  await scrollAllToBottom(); await wait(300);
  await clickEvaluate('button[aria-label="الخروج من مكتبة سكينة"]');
  const entered = await measure();
  const fails = [];
  if (entered.scrollY !== before.scrollY) fails.push(`hadith position lost across library (was ${before.scrollY}, now ${entered.scrollY})`);
  record({ route: 'hadith (after library)', how: 'إغلاق → hadith', owner: 'document', scrollY: entered.scrollY, inners: `${entered.innerCount}/${entered.innerMax}`, scrollbar: entered.scrollbarHidden ? 'hidden' : 'VISIBLE', verdict: fails.length ? 'FAIL — ' + fails.join(', ') : 'PASS' });
});

console.log('---');
console.log(`audited=${rows.length} failures=${failures}`);
for (const n of notAudited) console.log(`NOT_CHECKED ${n.name} — ${n.reason}`);
if (pageErrors.length) console.log(`pageErrors: ${JSON.stringify(pageErrors.slice(0, 5))}`);
await browser.close();
process.exit(failures ? 1 : 0);
