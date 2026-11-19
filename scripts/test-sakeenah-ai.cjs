const { chromium } = require('playwright');
const assert = require('node:assert/strict');
// Run a Vite server with VITE_SUPABASE_URL=https://mock.invalid and a test public key.
// All mock.invalid traffic is intercepted; no real account or server is used.
const base=(process.env.SAKINA_AI_TEST_URL || 'http://127.0.0.1:4189') + '/scripts/fixtures/sakeenah-ai.html';
const now='2026-11-14T10:00:00.000Z';
const conv={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',user_id:'test-user',title:'محادثة اختبار',context_summary:null,summary_updated_at:null,last_message_at:now,created_at:now,updated_at:now,pinned_at:null};
const rows=['السؤال الأول','إجابة محفوظة أولى','السؤال الثاني','إجابة محفوظة ثانية'].map((content,i)=>({id:'msg'+i,conversation_id:conv.id,user_id:'test-user',role:i%2?'assistant':'user',content,created_at:now}));
async function main(){ const browser=await chromium.launch();try {for(const theme of ['dark','light']) {
 const ctx=await browser.newContext({viewport:{width:390,height:844},colorScheme:theme,permissions:['clipboard-read','clipboard-write']});
 await ctx.addInitScript(()=>{localStorage.setItem('sakeenah-auth:session', JSON.stringify({access_token:'test-token',refresh_token:'test-refresh',expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer',user:{id:'test-user',aud:'authenticated',user_metadata:{name:'test'}}}));});
 let mode='fail';
 await ctx.route('https://mock.invalid/**',async route=>{const req=route.request(); const url=req.url(); let body='{}'; let contentType='application/json';
 if(req.method()==='OPTIONS') return route.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
 if(url.includes('/rest/v1/ai_conversations')) body=JSON.stringify([conv]);
 else if(url.includes('/rest/v1/ai_messages')) body=JSON.stringify(rows);
 else if(url.includes('/functions/v1/sakeenah-ai')) { contentType='text/event-stream'; body=mode==='fail'?'data: {"text":"رد لم يؤكد حفظه"}\n\ndata: {"error":"Failed to generate stream response"}\n\ndata: [DONE]\n\n':'data: {"text":"رد ناجح"}\n\ndata: [DONE]\n\n'; }
 else if(url.includes('/functions/v1/sakeenah-sharing')) body=JSON.stringify({conversation:conv,messages:rows.map(x=>({id:x.id,role:x.role,content:x.content,createdAt:x.created_at})),share:{createdAt:now,expiresAt:null}});
 await route.fulfill({status:200,contentType,body,headers:{'access-control-allow-origin':'*'}});
 });
 const page=await ctx.newPage(); let errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base); await page.getByRole('button',{name:'فتح المحادثات المحفوظة'}).click(); await page.getByText('محادثة اختبار').click();
 await page.getByText('إجابة محفوظة أولى').waitFor(); await page.getByText('إجابة محفوظة ثانية').waitFor();
 assert.equal(await page.getByTitle('نسخ الإجابة').count(),1);
 await page.getByText('إجابة محفوظة أولى').click(); await page.getByTitle('نسخ الإجابة').click(); await page.waitForTimeout(100); assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'إجابة محفوظة أولى');
 await page.getByText('إجابة محفوظة ثانية').click(); await page.getByTitle('نسخ الإجابة').click(); await page.waitForTimeout(100); assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'إجابة محفوظة ثانية');
 let textarea=page.getByPlaceholder('اسأل عن أي أمر فقهي أو شرعي...'); await textarea.focus();
 if(theme==='dark') {const style=await textarea.evaluate(el=>({outline:getComputedStyle(el).outlineStyle})); assert.equal(style.outline,'none');}
 await page.getByRole('button',{name:'فتح المحادثات المحفوظة'}).click(); await page.waitForTimeout(200);
 const drawer=await page.locator('aside').evaluate(el=>{let s=getComputedStyle(el);return {bg:s.backgroundColor,blur:s.backdropFilter,border:s.borderWidth}}); assert.equal(drawer.blur,'none');assert(!drawer.bg.includes('rgba'),JSON.stringify(drawer));assert.equal(drawer.border,'0px');
 await page.locator('aside').getByRole('button',{name:'إغلاق قائمة المحادثات'}).click();
 await textarea.fill('سؤال تجريبي');await page.getByRole('button',{name:'إرسال السؤال'}).click();
 await page.getByText('رد لم يؤكد حفظه').waitFor();await page.getByText('تعذر تأكيد حفظ الرد.',{exact:false}).waitFor(); await page.getByText('رد لم يؤكد حفظه').click(); await page.getByTitle('نسخ الإجابة').click(); assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'رد لم يؤكد حفظه');
 mode='success'; await textarea.fill('سؤال ناجح'); await page.getByRole('button',{name:'إرسال السؤال'}).click(); await page.getByText('رد ناجح',{exact:true}).waitFor(); await page.getByText('تعذر تأكيد حفظ الرد.',{exact:false}).waitFor({state:'hidden'}); assert.deepEqual(errors,[]); console.log(theme,'saved replies render and recoverable tools, opaque drawer, focus and failed-save warning: PASS');
 const shared=await ctx.newPage();await shared.goto(base+'?shared=1'); await shared.getByText('محادثة اختبار').waitFor(); assert.equal(await shared.locator('text='+base).count(),0);
 let s=await shared.locator('h1').evaluate(el=>({bg:getComputedStyle(el.parentElement).backgroundColor,bubble:getComputedStyle([...document.querySelectorAll('div')].find(e=>e.textContent==='السؤال الأول')).backgroundImage}));
 if(theme==='dark') { assert.equal(s.bg,'rgb(28, 28, 30)');assert.equal(s.bubble,'none'); }
 await shared.getByRole('button',{name:'نسخ رابط المحادثة'}).click();assert.equal(await shared.evaluate(()=>navigator.clipboard.readText()),base+'?shared=1');
 console.log(theme,'shared page style, no visible URL and copy action: PASS',s);await ctx.close();
 }}finally {await browser.close();}}
main().catch(e=>{console.error(e);process.exit(1)});
