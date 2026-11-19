const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const base = process.env.SAKINA_TEST_URL || 'http://127.0.0.1:4197';
(async()=>{const browser=await chromium.launch();try {
 const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',timezoneId:'Africa/Cairo',reducedMotion:'reduce'});
 const page=await context.newPage(), peer=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.clock.setFixedTime(new Date('2026-11-14T12:00:00+02:00'));
 await page.goto(base,{waitUntil:'domcontentloaded'});const entry=page.getByRole('button',{name:'فتح صفحة الشهر الهجري'});await entry.waitFor({state:'visible',timeout:60000});await entry.click({timeout:60000});await page.locator('.hm-root').waitFor({state:'visible'});
 await peer.goto(base,{waitUntil:'domcontentloaded'});
 async function compare(day,year='١٤٤٨'){
   await page.waitForFunction(n=>document.querySelector('.hm-chips')?.textContent.includes('اليوم '+n+' من الشهر'),day,{timeout:12000});
   const title=await page.locator('.hm-hero h1').innerText(), card=await entry.locator('..').innerText(), chips=await page.locator('.hm-chips').innerText();
   assert(card.includes(`${day} ${title} ${year}`),JSON.stringify({card,title,day,year,chips}));
   const years=await page.locator('.hm-event-text small,.hm-next-text p span:first-child').allInnerTexts();
   assert(years.every(s=>s.includes(year)&&!s.includes(year==='١٤٤٨'?'١٤٤٩':'١٤٥٠')),JSON.stringify(years));
   assert.equal(await page.locator('.hm-past-header').count(),0);return card;
 }
 const changes=[];changes.push([0,await compare('٤'),await page.locator('.hm-next-count').innerText()]);
 for(const [value,day,expectDays] of [[2,'٦','بعد ٨٤ يوماً'],[-2,'٢','بعد ٨٨ يوماً'],[0,'٤','بعد ٨٦ يوماً']]){
   await peer.evaluate(v=>localStorage.setItem('hijriOffset',String(v)),value);changes.push([value,await compare(day),await page.locator('.hm-next-count').innerText()]);assert((await page.locator('.hm-next-count').innerText()).includes(expectDays));
 }
 await peer.evaluate(()=>localStorage.setItem('hijriOffset','2.5'));await compare('٤');assert((await page.locator('.hm-next-count').innerText()).includes('بعد ٨٦ يوماً'));
 for(const [iso,text,day] of [['2027-02-05T12:00:00+02:00','بعد ٣ أيام','٢٨'],['2027-02-06T12:00:00+02:00','بعد غد','٢٩'],['2027-02-07T12:00:00+02:00','غداً','٣٠'],['2027-02-08T12:00:00+02:00','اليوم','١']]){
   await page.clock.setFixedTime(new Date(iso));await page.waitForFunction(({text})=>document.querySelector('.hm-next-count')?.textContent.includes(text),{text},{timeout:10000});await compare(day);
 }
 await page.clock.setFixedTime(new Date('2027-05-17T12:00:00+03:00'));await page.waitForFunction(()=>document.querySelector('.hm-main')?.textContent.includes('لا توجد مناسبات قادمة في هذا العام الهجري'),null,{timeout:10000});await compare('١١');assert.equal(await page.locator('.hm-next,.hm-event').count(),0);
 await page.clock.setFixedTime(new Date('2027-06-06T12:00:00+03:00'));await page.waitForFunction(()=>document.querySelector('.hm-next-count')?.textContent.includes('اليوم'),null,{timeout:10000});await compare('١','١٤٤٩');assert((await page.locator('.hm-next').innerText()).includes('بداية العام الهجري'));
 await context.setOffline(true);await page.goBack();await page.locator('.hm-root').waitFor({state:'hidden'});await entry.click();await page.locator('.hm-root').waitFor({state:'visible'});await compare('١','١٤٤٩');assert.equal(await page.locator('.hm-hero img').evaluate(i=>i.naturalWidth),1122);
 assert.deepEqual(errors,[]);console.log('Unified browser: live offset, all countdown phrases, no past/future-year events, year rollover, matched card/page, offline: PASS',JSON.stringify(changes));await context.close();
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
