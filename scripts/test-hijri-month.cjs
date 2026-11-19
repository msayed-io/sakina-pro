// Browser UI integration against the built app; no mocked dates, data or events.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.SAKINA_TEST_URL || 'http://127.0.0.1:4197';
(async () => { const browser = await chromium.launch(); try {
  for (const [theme, viewport, instant] of [
    ['dark',{width:390,height:844},'2026-11-14T12:00:00+02:00'],
    ['light',{width:390,height:844},'2027-05-17T12:00:00+03:00'],
    ['dark',{width:1440,height:900},'2027-02-08T12:00:00+02:00'],
    ['light',{width:1440,height:900},'2027-03-09T12:00:00+02:00'],
  ]) {
    const ctx = await browser.newContext({viewport,colorScheme:theme,timezoneId:'Africa/Cairo',reducedMotion:'reduce'}), page = await ctx.newPage();
    const errors=[], external=[];page.on('pageerror',e=>errors.push(e.message));let tracking=false;page.on('request',req=>{if(tracking&&!req.url().startsWith(base))external.push(req.url())});
    await page.clock.setFixedTime(new Date(instant));await page.goto(base,{waitUntil:'domcontentloaded'});await page.locator('nav button').first().waitFor({state:'visible',timeout:60000});
    const entry=page.getByRole('button',{name:'فتح صفحة الشهر الهجري'});await entry.waitFor({state:'visible'});await page.waitForFunction(()=>{const b=document.querySelector('[aria-label="فتح صفحة الشهر الهجري"]');if(!b)return false;const r=b.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b},{timeout:60000});
    await page.evaluate(()=>window.scrollTo(0,220));await page.waitForTimeout(300);const beforeScroll=await page.evaluate(()=>window.scrollY);const card=await entry.locator('..').innerText();
    const hit=await entry.boundingBox();assert(hit.height>=44,`touch size ${hit.height}`);
    // Observe the inserted image as early as possible, before its first rendering opportunity.
    await page.evaluate(()=>{window.__firstHijriImage=null;new MutationObserver(()=>{const i=document.querySelector('.hm-hero img');if(i&&!window.__firstHijriImage)window.__firstHijriImage={complete:i.complete,width:i.naturalWidth,opacity:getComputedStyle(i).opacity}}).observe(document.body,{childList:true,subtree:true})});
    tracking=true;const start=Date.now();await page.mouse.click(hit.x + hit.width/2, hit.y + hit.height/2);await page.locator('.hm-root').waitFor({state:'visible'});const elapsed=Date.now()-start;
    const first=await page.evaluate(()=>window.__firstHijriImage);assert(first&&first.complete&&first.width===1122&&first.opacity==='1',JSON.stringify(first));
    assert.equal(await page.locator('.hm-root .progressive-blur').count(),0);
    assert.equal(await page.locator('nav').count(),0);assert.equal((await page.locator('.hm-root .qf-specular-rim').count()),theme==='dark'?2:0);
    const info=await page.evaluate(()=>({hero:document.querySelector('.hm-hero').getBoundingClientRect().toJSON(),fonts:[document.fonts.check('700 15px "Thmanyah Sans"'),document.fonts.check('900 40px "Thmanyah Serif Display"')],header:document.querySelector('.hm-next')?.innerText,day:document.querySelector('.hm-chips')?.innerText}));assert(info.fonts.every(Boolean));assert.equal(info.hero.height,viewport.width<900?viewport.width*1.25:480);
    if(instant.startsWith('2026'))assert(info.day.includes('٤'),JSON.stringify(info));
    if(instant.startsWith('2027-05'))assert(info.header.includes('بداية العام الهجري'),JSON.stringify(info));
    if(instant.startsWith('2027-02'))assert(info.header.includes('شهر رمضان')&&info.header.includes('اليوم'),JSON.stringify(info));
    if(instant.startsWith('2027-03'))assert(info.header.includes('عيد الفطر')&&info.header.includes('اليوم'),JSON.stringify(info));
    const scroll=page.locator('.hm-scroll');await scroll.evaluate(el=>el.scrollTo(0,300));await page.waitForTimeout(100);assert.equal(await page.locator('.hm-root .progressive-blur').count(),1);await scroll.evaluate(el=>el.scrollTo(0,0));await page.waitForTimeout(100);assert.equal(await page.locator('.hm-root .progressive-blur').count(),0);
    const past=page.locator('.hm-past-header');if(await past.count()){await past.scrollIntoViewIfNeeded();await past.click();assert.equal(await past.getAttribute('aria-expanded'),'true');await past.click();assert.equal(await past.getAttribute('aria-expanded'),'false')}
    await page.locator('.hm-back').click();await page.locator('.hm-root').waitFor({state:'hidden'});assert.equal(await entry.locator('..').innerText(),card);assert.equal(await page.evaluate(()=>window.scrollY),beforeScroll);assert.deepEqual(errors,[]);
    console.log(JSON.stringify({theme,width:viewport.width,instant,openMs:elapsed,first,card,day:info.day,scrollRestored:beforeScroll,externalWhileOpen:external}));
    // Once local assets are warm, opening and data remain functional with browser offline.
    await ctx.setOffline(true);await entry.click();await page.locator('.hm-root').waitFor({state:'visible'});assert(await page.locator('.hm-next').count());assert.equal(await page.locator('.hm-hero img').evaluate(i=>i.naturalWidth),1122);await page.goBack();await page.locator('.hm-root').waitFor({state:'hidden'});await ctx.close();
  }
 } finally {await browser.close()}})().catch(error=>{console.error(error);process.exitCode=1});
