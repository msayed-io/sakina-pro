// 80 real PNGs. Fresh browser per palette to stay within the CI container's memory.
const assert=require('node:assert/strict'),fs=require('node:fs');const {chromium}=require('playwright');
(async()=>{
 const results=[];const base=process.env.SAKINA_TEST_URL||'http://127.0.0.1:3011';
 for(const length of ['short','long'])for(let color=0;color<10;color++){
  const browser=await chromium.launch();try{
   const p=await browser.newPage({viewport:{width:390,height:844},colorScheme:'dark',acceptDownloads:true});
   await p.addInitScript(()=>Object.defineProperty(navigator,'deviceMemory',{value:1,configurable:true}));
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto(base);await p.locator('nav button').nth(3).click();
   if(length==='short')await p.getByRole('button',{name:/إشراقة يومك/}).click();
   else {await p.getByText('أذكار الاستيقاظ من النوم',{exact:true}).first().click();await p.waitForFunction(()=>document.querySelector('.azref-root .tx')?.style.fontSize);for(let i=0;i<3;i++){await p.locator('#az_down').click();await p.waitForTimeout(600)}}
   await p.locator('#az_share').click();await p.waitForFunction(()=>Boolean(document.querySelector('#az_k_o_mt')?.textContent));
   if(length==='long')assert((await p.locator('#az_k_o_mt').textContent()).length>1500);
   await p.locator('#az_k_tc').click();await p.locator('#az_k_menu button').nth(color).click();
   for(let format=0;format<4;format++){
    await p.locator('#az_k_tf').click();await p.locator('#az_k_menu button').nth(format).click();
    let info=await p.evaluate(()=>({color:document.querySelector('#az_k_tcn').textContent,format:document.querySelector('#az_k_tfn').textContent,block:document.querySelector('#az_k_blk').offsetHeight,mid:document.querySelector('#az_k_mid').clientHeight}));
    assert(info.block<=info.mid,JSON.stringify({length,...info}));
    const [download]=await Promise.all([p.waitForEvent('download',{timeout:90000}),p.locator('#az_k_dl').click()]);
    const file=fs.readFileSync(await download.path());assert(file.length>1000);assert.equal(file.subarray(1,4).toString(),'PNG');
    const width=file.readUInt32BE(16),height=file.readUInt32BE(20);assert(width>=1080&&height>=1080);
    results.push({length,...info,width,height,bytes:file.length});
   }
   assert.deepEqual(errors,[]);console.log(length,`color ${color+1}/10`,'exports',results.length);
  }finally{await browser.close()}
 }
 fs.writeFileSync('/home/user/azkar-export-matrix-result.json',JSON.stringify(results,null,2));
 console.log('PASS: 80 PNG exports, 10 colors x 4 formats x short/long, no overflow or page errors');
})().catch(e=>{console.error(e);process.exit(1)});
