// Exercise the real production web build with only the sharing API mocked.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch();try{for(const ok of [true,false]){const c=await b.newContext({viewport:{width:390,height:844},colorScheme:'dark'});const p=await c.newPage();
 await p.route('**/*',route=>{const u=new URL(route.request().url());if(u.pathname==='/functions/v1/sakeenah-sharing')return route.fulfill({status:ok?200:404,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(ok?{conversation:{id:'x',title:'محادثة قياس',created_at:'2026-01-01T00:00:00Z'},messages:[{id:'1',role:'assistant',content:'نص تجريبي'}],share:{createdAt:'2026-01-01T00:00:00Z'}}:{error:'رابط غير صالح'})});return u.hostname==='127.0.0.1'?route.continue():route.abort()});
 const started=Date.now();await p.goto((process.env.SAKINA_TEST_URL||'http://127.0.0.1:3011')+'/shared/chat/'+'a'.repeat(32));await p.getByText(ok?'محادثة قياس':'المحادثة غير متاحة').waitFor({state:'visible',timeout:30000});
 assert.equal(await p.getByText('سَكِينَة',{exact:true}).count(),0,'Public route must not mount the normal splash');if(ok)await p.locator('a:has-text("سَكِينَة AI")').click({trial:true});
 console.log(ok?'Valid share':'Invalid share','mocked response rendered:',Date.now()-started,'ms');await c.close();}}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
