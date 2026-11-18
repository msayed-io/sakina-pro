// Actual touch/wheel input over reachable app surfaces. No assignment of
// scrollTop after a gesture is used as evidence of user scrolling.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const base = process.env.SAKINA_TEST_URL || 'http://127.0.0.1:3011';
const browser = await chromium.launch();
try {
  for (const gesture of ['touch', 'wheel']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 560 }, isMobile: gesture === 'touch', hasTouch: gesture === 'touch', colorScheme: 'dark' });
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('azkar_font_size', '30'));
    await context.route(/https:\/\/www\.mp3quran\.net\/api\/v3\/reciters/, route => route.abort());
    await page.goto(base);
    await page.locator('nav button').first().click({ trial: true, timeout: 60000 });
    const rows = [];
    async function probe(label, mayFit = false) {
      // Locate the actual scroll container under the user's finger/wheel.
      const target = await page.evaluate(() => {
        const x = Math.round(innerWidth / 2), y = Math.round(innerHeight * .58);
        let node = document.elementFromPoint(x, y), root = document.scrollingElement, fixedAncestor = false;
        for (let el = node; el; el = el.parentElement) {
          const style = getComputedStyle(el);
          if (style.position === 'fixed') fixedAncestor = true;
          if (/(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight + 5) {
            window.__testedScroll = el;
            el.scrollTop = 0;
            return { x, y, owner: el === root ? 'document' : 'element', range: el.scrollHeight - el.clientHeight };
          }
        }
        if (!fixedAncestor && root && root.scrollHeight > root.clientHeight + 5 && getComputedStyle(document.body).overflowY !== 'hidden') {
          window.__testedScroll = root; root.scrollTop = 0;
          return { x, y, owner: 'document', range: root.scrollHeight - root.clientHeight };
        }
        window.__testedScroll = null;
        return { x, y, owner: 'no-scroll-range', range: 0 };
      });
      await page.waitForTimeout(200);
      if (!target.range) {
        assert(mayFit, `${label}: no scrollable ancestor at test point`);
        rows.push(`${label}: no scroll range at test point`);
        return;
      }
      if (gesture === 'wheel') {
        await page.mouse.move(target.x, target.y);
        await page.mouse.wheel(0, 420);
      } else {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: target.x, y: target.y }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x, y: target.y - 120 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: target.x, y: target.y - 250 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      }
      await page.waitForTimeout(450);
      const moved = await page.evaluate(() => window.__testedScroll?.scrollTop || 0);
      assert(moved > 0, `${label}: ${target.owner} did not move under ${gesture} input`);
      rows.push(`${label}: ${target.owner} moved ${Math.round(moved)} px`);
    }
    async function nav(i) { await page.locator('nav button').nth(i).click(); await page.waitForTimeout(500); }
    await probe('home');
    await nav(1); await probe('quran reciters');
    await nav(2); const gotIt = page.getByRole('button', { name: 'فهمت ذلك' }); if (await gotIt.isVisible()) await gotIt.click();
    await probe('hadith books');
    await page.getByRole('button', { name: /الدروس والمحاضرات/ }).click();
    await page.getByRole('button', { name: 'الخروج من مكتبة سكينة' }).waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    await probe('library panel', true);
    await page.getByRole('button', { name: 'الخروج من مكتبة سكينة' }).click();
    await nav(3); await probe('azkar');
    await page.getByRole('button', { name: /أذكار الصباح إشراقة يومك/ }).click();
    await page.getByTitle('رجوع').waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    const text = page.locator('div.flex-1.overflow-y-auto p').first();
    const beforeText = await text.innerText();
    await probe('long azkar text');
    assert.equal(await text.innerText(), beforeText, 'Scrolling text must not navigate to another item');
    assert((await page.locator('div.touch-none').first().innerText()).includes('0 من 1'), 'Scrolling must not increment the counter');
    await text.click();
    assert((await page.locator('div.touch-none').first().innerText()).includes('1 من 1'), 'Tapping text must still increment the counter');
    rows.push('azkar tap: counter incremented');
    if (gesture === 'touch') {
      // Preserve the distinct card-swipe navigation gesture outside the text.
      const card = await page.locator('div.touch-none').first().boundingBox();
      const x = card.x + 12, y = card.y + card.height * .8;
      const cdp = await context.newCDPSession(page);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      for (const dy of [35, 70, 115, 165]) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - dy }] });
        await page.waitForTimeout(35);
      }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await cdp.detach(); await page.waitForTimeout(700);
      const secondText = await text.innerText();
      assert.notEqual(secondText, beforeText, 'Card swipe should still navigate');
      rows.push('azkar card swipe: next item');
    }
    await page.getByTitle('رجوع').click();
    await page.getByRole('button', { name: /أسماء الله الحسنى تعلّم/ }).click();
    await page.getByRole('button', { name: 'رجوع', exact: true }).waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    await probe('names panel');
    await page.getByRole('button', { name: 'رجوع', exact: true }).click();
    await nav(0);
    await page.getByRole('button', { name: /إعدادات الإشعار/ }).first().click();
    await page.getByRole('button', { name: 'الخروج', exact: true }).waitFor({ state: 'visible' }); await page.waitForTimeout(800);
    await probe('prayer settings panel', true);
    await page.getByRole('button', { name: 'الخروج', exact: true }).click();
    await page.getByRole('button', { name: 'فتح الإعدادات' }).first().click();
    await probe('settings');
    console.log(`${gesture}: ${rows.join('; ')}`);
    await context.close();
  }
} finally { await browser.close(); }
