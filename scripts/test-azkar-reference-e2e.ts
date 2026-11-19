import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { azkarData } from '../src/data/azkarData';
import { hisnAlMuslimData as hisn } from '../src/data/hisnAlMuslimData';

(async()=>{
 const browser=await chromium.launch();
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},colorScheme:'dark',acceptDownloads:true});
  const page=await context.newPage();page.setDefaultTimeout(30000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(process.env.SAKINA_TEST_URL||'http://127.0.0.1:3000');
  await page.locator('nav button').nth(3).click();
  await page.getByRole('button',{name:/إشراقة يومك/}).click();
  await page.locator('.azref-root .card').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('.azref-root')?.getAttribute('style')?.includes('pointer-events:')!==true);
  const text=await page.locator('.azref-root .card .tx').allTextContents();
  assert.deepEqual(text,azkarData.morningAzkar.map(i=>i.text));
  assert.equal(await page.locator('.azref-root h1').innerText(),'أذكار الصباح');
  await page.locator('#az_bm').click();
  assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('bookmarked_azkar_keys')||'[]'))).includes('morning_1'));
  await page.locator('#az_src').click();
  assert.equal(await page.locator('#az_srcC').textContent(),azkarData.morningAzkar[0].source);
  assert.equal(await page.locator('#az_secF').isHidden(),true);
  await page.keyboard.press('Escape');
  await page.locator('#az_share').click();
  await page.waitForFunction(()=>Boolean(document.querySelector('#az_k_o_mt')?.textContent));
  assert.equal(await page.locator('#az_k_o_mt').textContent(),azkarData.morningAzkar[0].text);
  assert.equal(await page.locator('#az_k_o_bk').textContent(),azkarData.morningAzkar[0].source);
  assert.equal(await page.locator('#az_k_o_gr').textContent(),'أذكار الصباح');
  const matrix:any[]=[];
  for(let c=0;c<10;c++){
   await page.locator('#az_k_tc').click();await page.locator('#az_k_menu button').nth(c).click();
   for(let f=0;f<4;f++){
    await page.locator('#az_k_tf').click();await page.locator('#az_k_menu button').nth(f).click();
    matrix.push(await page.evaluate(()=>{const b=document.querySelector('#az_k_blk') as HTMLElement,m=document.querySelector('#az_k_mid') as HTMLElement;return {theme:document.querySelector('#az_k_tcn')?.textContent,format:document.querySelector('#az_k_tfn')?.textContent,block:b.offsetHeight,mid:m.clientHeight,text:document.querySelector('#az_k_o_mt')?.textContent}}));
   }
  }
  assert.equal(matrix.length,40);assert(matrix.every(x=>x.block<=x.mid));assert(matrix.every(x=>x.text===azkarData.morningAzkar[0].text));
  await context.setOffline(true);
  await page.locator('#az_k_tc').click();await page.locator('#az_k_menu button').first().click();
  assert.equal(await page.locator('#az_k_o_mt').textContent(),azkarData.morningAzkar[0].text);
  await context.setOffline(false);
  await page.keyboard.press('Escape');
  await page.locator('#az_down').click();await page.waitForTimeout(700);
  await page.locator('#az_share').click();await page.waitForFunction((x)=>document.querySelector('#az_k_o_mt')?.textContent===x,azkarData.morningAzkar[1].text);
  await page.keyboard.press('Escape');await page.keyboard.press('Escape');
  await page.getByText('أذكار الاستيقاظ من النوم',{exact:true}).first().click();
  const item=hisn.getAzkarByCategory('أذكار الاستيقاظ من النوم');
  await page.locator('.azref-root .card').first().waitFor();
  assert.deepEqual(await page.locator('.azref-root .card .tx').allTextContents(),item.map(i=>i.text));
  await page.locator('#az_down').click();await page.waitForTimeout(600);await page.locator('#az_down').click();await page.waitForTimeout(600);await page.locator('#az_down').click();await page.waitForTimeout(600);
  const long=item[3];assert(long.text.length>1500);
  await page.locator('#az_share').click();await page.waitForFunction((s)=>document.querySelector('#az_k_o_mt')?.textContent===s,long.text);
  assert.equal(await page.locator('#az_k_o_bk').textContent(),'');
  const longMatrix:any[]=[];
  for(let c=0;c<10;c++){
   await page.locator('#az_k_tc').click();await page.locator('#az_k_menu button').nth(c).click();
   for(let f=0;f<4;f++){
    await page.locator('#az_k_tf').click();await page.locator('#az_k_menu button').nth(f).click();
    longMatrix.push(await page.evaluate(()=>{const b=document.querySelector('#az_k_blk') as HTMLElement,m=document.querySelector('#az_k_mid') as HTMLElement;return {block:b.offsetHeight,mid:m.clientHeight,text:document.querySelector('#az_k_o_mt')?.textContent}}));
   }
  }
  assert(longMatrix.every(x=>x.text===long.text));assert(longMatrix.every(x=>x.block<=x.mid),JSON.stringify(longMatrix.filter(x=>x.block>x.mid)));
  await page.emulateMedia({colorScheme:'light'});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'light');
  await page.emulateMedia({colorScheme:'dark'});await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),'dark');
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({main: text.length,hisn:item.length,shortAndLongMatrix:matrix.length+longMatrix.length,offline:'PASS',favorites:'PASS',themes:'PASS',exactText:'PASS',errors},null,2));
  await context.close();
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
