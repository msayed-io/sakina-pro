// Uses built web assets and the local preview server; no real notification API.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch();try{for(const theme of ['dark','light']) {
 const p=await b.newPage({viewport:{width:390,height:844},colorScheme:theme,acceptDownloads:true});
 const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(process.env.SAKINA_TEST_URL||'http://127.0.0.1:3011');
 await p.locator('nav button').nth(3).click(); await p.getByRole('button',{name:/أذكار الصباح إشراقة يومك/}).click();
 await p.getByTitle('تغيير حجم الخط').click(); const toast=p.locator('.app-toast').filter({hasText:'حجم الخط'});await toast.waitFor();
 const box=await toast.boundingBox();assert(box.y>=70 && box.y<150,JSON.stringify(box));assert(await toast.evaluate(e=>e.classList.contains('app-toast--success')));await toast.waitFor({state:'hidden',timeout:3500});
 await p.getByTitle('رجوع').click();await p.locator('nav button').nth(2).click();await p.getByRole('button',{name:'فهمت ذلك'}).click();await p.getByRole('button',{name:'فتح وتصفح الكتاب'}).first().click();await p.locator('button[title="مشاركة الحديث"]').nth(1).click();await p.waitForFunction(()=>document.querySelector('#hshare-o_nm')?.textContent==='٢');
 const [download]=await Promise.all([p.waitForEvent('download',{timeout:90000}),p.locator('#hshare-dl').click()]);assert(download);
 const t=p.locator('#hshare-toast');await t.waitFor({state:'visible'});const info=await t.evaluate(e=>({rect:e.getBoundingClientRect().toJSON(),position:getComputedStyle(e).position,success:e.classList.contains('app-toast--success'),insideWell:!!e.closest('.hshare-well')}));
 assert(info.position==='fixed' && info.rect.y>=70 && info.rect.y<150 && info.success && !info.insideWell,JSON.stringify(info));
 await p.getByRole('button',{name:'إغلاق',exact:true}).last().click(); await p.waitForTimeout(300);assert(!(await t.evaluate(e=>e.classList.contains('hshare-on'))));
 await p.getByTitle('الإبلاغ عن تصحيح في التشكيل أو النص').first().click(); await p.getByPlaceholder('اكتب التشكيل الصحيح أو الملاحظة بالتفصيل...').fill('ملاحظة اختبار محلية');await p.getByRole('button',{name:'حفظ البلاغ في السجل'}).click();
 const report=p.locator('.app-toast').filter({hasText:'تم تدوين وحفظ ملاحظتك'}); await report.waitFor();await p.waitForTimeout(350);const reportBox=await report.boundingBox();assert(reportBox.y>=70 && reportBox.y<150,JSON.stringify(reportBox));await report.waitFor({state:'hidden',timeout:5000});assert.deepEqual(errors,[]);
 console.log(theme,'Azkar/report notices top/expiry; share export notice top/close cleanup: PASS');await p.close();
 }}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
