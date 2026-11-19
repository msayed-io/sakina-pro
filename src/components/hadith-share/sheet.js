import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { saveHadithImage } from '@/services/hadith-share-native';
import markup from './sheet.html?raw';
import './sheet.css';

// The measurement override is shared if two sheet instances export at once.
let activeMetricExports=0;
async function withExportMetrics(render){
 if(activeMetricExports++===0)document.body.classList.add('hshare-export-metrics');
 try{return await render()}finally{
  if(--activeMetricExports===0)document.body.classList.remove('hshare-export-metrics');
 }
}

export function createHadithShare(){
const root=document.createElement('div');root.className='hshare-root';root.dir='rtl';root.innerHTML=markup;document.body.appendChild(root);

const $=i=>root.querySelector("#hshare-"+i);
const toAr=s=>String(s).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
/* ===== هوية التطبيق ===== */
let BRAND={name:'سكينة',tag:'تطبيق إسلامي'};
/* ===== نقاط الربط مع التطبيق (SakinaShare.configure) =====
   html2canvas : الدالة المستوردة من الحزمة المحلية (إلزامي)           fonts : {text,title,brand,ui} أسماء خطوط التطبيق
   saveImage(blob,fileName) : تحفظ الصورة (معرض/ملف) وتُرجع 'gallery' أو 'shared'  — الافتراضي تنزيل المتصفح
   brand : {name,tag}          maxPixels : سقف بكسلات التصدير (اختياري)    builtInRim:false لتعطيل الحافة المضمّنة واستخدام نظام التطبيق
   الربط:  SakinaShare.open({source,book,chapter,number,grade,text})  أو  isnad+matn بدل text
   زر Back: if(SakinaShare.handleBack())return; */
const CFG={html2canvas:null,saveImage:null,maxPixels:0};
/* ===== الأنماط اللونية ===== */
const T={
 fajr:{n:'فجر',b1:'#080c1f',b2:'#17224d',o1:'rgba(255,198,152,.95)',o2:'rgba(255,122,142,.55)',o3:'rgba(104,84,222,.30)',tx:'#f6f2ea',mu:'#a9afcb',ac:'#ffc08f',ln:'rgba(246,242,234,.17)',vg:'rgba(0,0,0,.45)',gc:1,go:.9},
 night:{n:'ليل',b1:'#06090e',b2:'#121c29',o1:'rgba(216,234,255,.92)',o2:'rgba(122,170,224,.5)',o3:'rgba(60,100,160,.24)',tx:'#eef3f8',mu:'#98a8b8',ac:'#a9cdf2',ln:'rgba(238,243,248,.16)',vg:'rgba(0,0,0,.5)',gc:1,go:.9},
 olive:{n:'زيتون',b1:'#090f07',b2:'#1e2c14',o1:'rgba(228,240,172,.92)',o2:'rgba(150,186,92,.5)',o3:'rgba(80,122,50,.26)',tx:'#f2f4e6',mu:'#a6b394',ac:'#cfe08c',ln:'rgba(242,244,230,.16)',vg:'rgba(0,0,0,.48)',gc:1,go:.9},
 amber:{n:'عنبر',b1:'#13060b',b2:'#35111b',o1:'rgba(255,216,152,.93)',o2:'rgba(240,132,82,.52)',o3:'rgba(190,52,82,.28)',tx:'#f9efe6',mu:'#bfa1a2',ac:'#ffcf92',ln:'rgba(249,239,230,.16)',vg:'rgba(0,0,0,.46)',gc:1,go:.9},
 teal:{n:'بحر',b1:'#021418',b2:'#0b4650',o1:'rgba(170,255,236,.92)',o2:'rgba(46,206,196,.52)',o3:'rgba(24,120,160,.28)',tx:'#eefaf8',mu:'#9dbfbd',ac:'#8ff0dc',ln:'rgba(238,250,248,.17)',vg:'rgba(0,0,0,.46)',gc:1,go:.9},
 violet:{n:'بنفسج',b1:'#0d0615',b2:'#2c1450',o1:'rgba(238,196,255,.93)',o2:'rgba(192,104,242,.52)',o3:'rgba(110,62,224,.30)',tx:'#f6effb',mu:'#b5a6cc',ac:'#e4bbff',ln:'rgba(246,239,251,.17)',vg:'rgba(0,0,0,.46)',gc:1,go:.9},
 plat:{n:'بلاتين',b1:'#08090b',b2:'#2a2c32',o1:'rgba(255,255,255,.88)',o2:'rgba(196,201,212,.42)',o3:'rgba(120,126,142,.22)',tx:'#f3f4f7',mu:'#9fa3ae',ac:'#e6e9f0',ln:'rgba(243,244,247,.16)',vg:'rgba(0,0,0,.5)',gc:1,go:.9},
 lapis:{n:'لازورد',b1:'#020716',b2:'#0b36b0',o1:'rgba(170,214,255,.97)',o2:'rgba(36,118,255,.66)',o3:'rgba(0,196,255,.36)',tx:'#f1f6ff',mu:'#9fb8e6',ac:'#7fd2ff',ln:'rgba(241,246,255,.2)',vg:'rgba(0,0,12,.5)',gc:1,go:.9},
 dusk:{n:'شفق',b1:'#16042a',b2:'#8a1d63',o1:'rgba(255,222,130,.98)',o2:'rgba(255,108,56,.66)',o3:'rgba(240,40,124,.4)',tx:'#fff4ea',mu:'#e2b7c9',ac:'#ffc47e',ln:'rgba(255,244,234,.2)',vg:'rgba(10,0,20,.48)',gc:1,go:.9},
 mist:{n:'ضباب',lt:1,b1:'#d2dce3',b2:'#f0f3f5',o1:'rgba(255,255,255,1)',o2:'rgba(255,255,255,.72)',o3:'rgba(150,196,222,.42)',tx:'#0e1a22',mu:'#4b5d6a',ac:'#1f6584',ln:'rgba(14,26,34,.2)',vg:'rgba(80,112,132,.24)',gc:0,go:.9}
};
const grain=(c,o)=>'url("data:image/svg+xml,'+encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 0 ${c} 0 0 0 ${o} 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`)+'")';
const FM=[['٤:٥','منشور',1350],['١:١','مربع',1080],['٩:١٦','ستوري',1920],['تلقائي','حسب النص',0]];
const FZ=[['تلقائي',1],['أصغر قليلًا',.9],['أصغر',.8],['الأصغر',.7]];
let D={},S={cur:'fajr',fmt:1350,isn:true,short:false,fz:1},fontUsable=false;
/* ===== معالجة النص تلقائيًا: تنظيف الترقيم + فصل السند عن المتن + إبراز أول جملة ===== */
function split(txt){
 const qi=txt.search(/[\"“«]/),qj=Math.max(txt.lastIndexOf('\"'),txt.lastIndexOf('”'),txt.lastIndexOf('»'));
 if(qi>=0&&qj>qi+10)return [txt.slice(0,qi),txt.slice(qi)];
 const keep=[];let base='';
 for(let i=0;i<txt.length;i++)if(!/[\u064B-\u065F\u0670\u0640]/.test(txt[i])){keep.push(i);base+=txt[i]}
 const m=/(?:(?:رسول الله|النبي)[^:]{0,60}?(?:يقول|قال)|(?:يقول|قال)\s+(?:رسول الله|النبي)[^:]{0,60}?)\s*:/.exec(base);
 if(m){const e=keep[m.index+m[0].length-1]+1;if(txt.length-e>25)return [txt.slice(0,e),txt.slice(e)]}
 return ['',txt];
}
function hl(m){const i=m.search(/[،؛.:]/);return(i>=14&&i<=70&&m.length>i+40)?[m.slice(0,i),m.slice(i)]:[m,'']}
function put(id,v){const e=$(id);e.textContent=v;e.style.display=v?'':'none'}
function size(px){$('o_mt').style.fontSize=px+'px';$('o_ld').style.fontSize=Math.max(21,px*(S.short?.5:.4))+'px'}
/* ===== ضبط حجم الخط تلقائيًا ليملأ المساحة بأكبر حجم ممكن ===== */
function layout(){
 if(!fontUsable)return;
 const c=$('card'),mid=$('mid'),blk=$('blk'),v=S.fz,L=$('o_mt').textContent.length;let note='';
 if(!S.fmt){c.style.height='auto';c.style.minHeight='1350px';size((L<120?70:L<260?60:L<480?52:L<800?44:L<1200?38:32)*v)}
 else{
  c.style.height=S.fmt+'px';c.style.minHeight='0';let lo=20,hi=86;size(lo);
  if(blk.offsetHeight>mid.clientHeight){S.fmt=0;sync();layout();toast('النص طويل على هذا المقاس. اختر «تلقائي» أو مقاسًا أطول.','er',3400);return;}
  else{while(hi-lo>.4){const m=(lo+hi)/2;size(m);blk.offsetHeight<=mid.clientHeight?lo=m:hi=m}size(lo*Math.min(1,v))}
 }
 if(note)toast(note,'er',3400);view();
}
function view(){
 const w=$('well'),h=$('card').offsetHeight;if(!h)return;
 const s=Math.max(.001,Math.min((w.clientWidth-32)/1080,(w.clientHeight-32)/h));
 $('st').style.transform=`scale(${s})`;$('pv').style.width=1080*s+'px';$('pv').style.height=h*s+'px';
}
function draw(){
 if(!fontUsable)return;
 const t=T[S.cur],c=$('card');
 for(const k in t)if(!['n','gc','go','lt'].includes(k))c.style.setProperty('--'+k,t[k]);
 $('grn').style.backgroundImage=grain(t.gc,t.go);$('grn').style.opacity=t.gc?.07:.1;
 const [is,mt]=D.matn!==undefined?[D.isnad||'',D.matn||'']:split(D.text||'');
 S.short=is.length<120;
 if(D.source){put('o_bk',D.source);put('o_kt',D.book||'')}else{put('o_bk',D.book||'');put('o_kt','')}
 put('o_bb',D.chapter||'');
 put('o_ld',S.isn?is:'');
 const m=$('o_mt'),[a,b]=D.highlight===false?[mt,'']:hl(mt);m.textContent='';
 [[a,b?'em':'span'],[b,'span']].forEach(([x,tag])=>{if(x){const e=document.createElement(tag);e.textContent=x;m.appendChild(e)}});
 const n=String(D.number??'').trim();put('o_nm',n?toAr(n):'');$('o_nm').previousElementSibling.style.display=n?'':'none';
 put('o_gr',D.grade||'');put('o_br',BRAND.name);put('o_tg',BRAND.tag);
 layout();
}
/* ===== انتظار الخطوط المحلية (بمهلة أمان؛ فشل خط لا يوقف العملية) ===== */
async function fonts(){
 const cs=getComputedStyle(root),f=['text','title','brand','ui'].map(k=>cs.getPropertyValue('--sk-f-'+k).trim());
 const specs=[['400 40px',0],['700 40px',0],['400 30px',1],['500 30px',1],['700 30px',1],['400 30px',2],['400 20px',3],['600 20px',3]];
 const job=Promise.all(specs.map(([w,i])=>document.fonts.load(w+' '+f[i],'ابتثحديث'))).then(()=>document.fonts.ready);
 await Promise.race([job,new Promise(r=>setTimeout(r,3000))]);
 if(!specs.every(([w,i])=>document.fonts.check(w+' '+f[i],'ابتثحديث'))) throw new Error('Local fonts unavailable');
 fontUsable=true;
}
let tt;function toast(m,k='',ms=2800){if(!isOpen())return;const e=$('toast');e.textContent=m;e.className='hshare-toast app-toast '+(k==='ok'?'app-toast--success':k==='er'?'app-toast--error':'app-toast--info')+' hshare-on';e.setAttribute('role',k==='er'?'alert':'status');clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('hshare-on'),Math.min(5000,Math.max(2000,ms)))}
/* ===== التصدير: سلّم جودة تلقائي صامت (4K ثم أقل حتى ينجح) ===== */
const LADDER=[4,3.5,3,2.5,2,1.5,1],MSG={gallery:'تم الحفظ في المعرض',shared:'تم تجهيز الصورة للمشاركة',download:'تم التنزيل'};
const frames=n=>new Promise(r=>{const f=()=>n--<=0?r():requestAnimationFrame(f);f()});
function pixelBudget(){
 if(CFG.maxPixels)return CFG.maxPixels;const m=navigator.deviceMemory;
 let c=m>=8?48e6:m>=6?40e6:m>=4?28e6:m>=3?20e6:m>=2?14e6:m?8e6:24e6;
 if(/iP(hone|ad|od)/.test(navigator.userAgent))c=Math.min(c,16e6);return c;
}
function canvasOK(w,h){ /* بعض الـWebView يعيد لوحة فارغة بلا خطأ: نتحقق بكتابة بكسل وقراءته */
 try{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');if(!x)return false;
  x.fillStyle='#f00';x.fillRect(w-1,h-1,1,1);const ok=x.getImageData(w-1,h-1,1,1).data[0]===255;c.width=c.height=0;return ok}catch(e){return false}
}
function nonBlank(cv){
 try{const x=cv.getContext('2d');let n=0;
  for(let i=1;i<=5;i++)for(let j=1;j<=5;j++)if(x.getImageData(Math.floor(cv.width*i/6),Math.floor(cv.height*j/6),1,1).data[3]>0)n++;
  return n>=12}catch(e){return false}
}
async function exportImage(){
 const h2c=CFG.html2canvas||window.html2canvas;if(!h2c)throw new Error('SakinaShare: html2canvas غير مُمرَّرة عبر configure()');
 await fonts();draw();await frames(2);
 const card=$('card'),H=card.offsetHeight,cap=pixelBudget();let last=null;
 for(const s of LADDER){
  const w=Math.round(1080*s),h=Math.round(H*s);
  if((s>1&&w*h>cap)||!canvasOK(w,h))continue;
  let cv=null;
  try{
   cv=await withExportMetrics(()=>h2c(card,{scale:s,backgroundColor:null,logging:false,imageTimeout:0,onclone:d=>{
    let n=d.getElementById('hshare-card').parentElement;
    while(n&&n!==d.body){n.style.transform='none';n.style.overflow='visible';n=n.parentElement}
    const p=d.getElementById('hshare-pv');p.style.width='auto';p.style.height='auto';
   }}));
   if(!nonBlank(cv))throw new Error('blank canvas');
   const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
   if(!blob||!blob.size)throw new Error('empty blob');
   const out={blob,width:cv.width,height:cv.height,scale:s};cv.width=cv.height=0;return out;
  }catch(e){last=e;if(cv)cv.width=cv.height=0;await frames(1)}
 }
 throw last||new Error('export failed');
}
function webDownload(blob,name){
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),5000);return 'download';
}
async function dl(){
 const b=$('dl'),t=$('dlt');if(b.disabled)return;b.disabled=true;t.textContent='جارٍ…';
 try{
  const r=await exportImage(),name='sakina-hadith-'+String(D.number||'card')+'.png';
  const how=CFG.saveImage?(await CFG.saveImage(r.blob,name))||'gallery':webDownload(r.blob,name);
  if(how==='cancelled'){t.textContent='تنزيل';b.disabled=false;return}
  t.textContent='تم ✓';toast(`${MSG[how]||MSG.download}${r.scale>=4?' بجودة 4K':''} · ${r.width}×${r.height}`,'ok',3400);
 }catch(e){console.error('[SakinaShare]',e);t.textContent='أعد المحاولة';toast('تعذّر الحفظ، حاول مرة أخرى','er')}
 setTimeout(()=>{t.textContent='تنزيل'},2200);b.disabled=false;
}
/* ===== فتح وإغلاق البطاقة السفلية ===== */
let previousOverflow='', backHandle=null, backGeneration=0, active=false, drawGeneration=0;
const pointerHandler=e=>{if(openT&&!menu.contains(e.target)&&!openT.contains(e.target))closeMenu()};
const keyHandler=e=>{if(e.key==='Escape')openT?closeMenu():close()};
function install(){
 if(active)return;active=true;previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 document.addEventListener('pointerdown',pointerHandler,true);window.addEventListener('keydown',keyHandler);window.addEventListener('resize',view);
 const gen=++backGeneration;if(Capacitor.isNativePlatform())CapacitorApp.addListener('backButton',()=>handleBack()).then(h=>{if(gen!==backGeneration)h.remove();else backHandle=h});
}
function uninstall(){
 if(!active)return;active=false;document.body.style.overflow=previousOverflow;document.removeEventListener('pointerdown',pointerHandler,true);window.removeEventListener('keydown',keyHandler);window.removeEventListener('resize',view);++backGeneration;if(backHandle){backHandle.remove();backHandle=null}
}
function open(d){
 if(d)D=d;for(const id of ['o_bk','o_kt','o_bb','o_nm','o_ld','o_mt','o_gr','o_br','o_tg'])$(id).textContent='';sync();install();$('scrim').classList.add('hshare-on');const s=$('sheet');s.classList.add('hshare-on');s.setAttribute('aria-hidden','false');
 const generation=++drawGeneration;fonts().then(()=>{if(isOpen()&&generation===drawGeneration)draw()}).catch(()=>{if(isOpen()&&generation===drawGeneration)toast('تعذّر تحميل الخطوط، حاول مرة أخرى','er')});$('x').focus({preventScroll:true});
}
function close(){++drawGeneration;clearTimeout(tt);$('toast').classList.remove('hshare-on');closeMenu();$('scrim').classList.remove('hshare-on');const s=$('sheet');s.classList.remove('hshare-on');s.setAttribute('aria-hidden','true');uninstall()}
const isOpen=()=>$('sheet').classList.contains('hshare-on');
function handleBack(){if(!isOpen())return false;if(openT)closeMenu();else close();return true}
function configure(o={}){
 const{fonts:fo,brand,...rest}=o;Object.assign(CFG,rest);
 if(fo)for(const k in fo)root.style.setProperty('--sk-f-'+k,fo[k]);
 if(brand)BRAND={...BRAND,...brand};
 /* builtInRim is disabled; the app owns all rims. */
 if(isOpen())draw();
}

/* ===== القوائم المنسدلة على طريقة Apple ===== */
const CK='<svg class="hshare-i hshare-ck" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const sw=k=>`radial-gradient(circle at 25% 80%,${T[k].o2},transparent 60%),linear-gradient(160deg,${T[k].b2},${T[k].b1})`;
const menu=$('menu');let openT=null;
function sync(){
 $('tcd').style.background=sw(S.cur);$('tcn').textContent=T[S.cur].n;
 $('tfn').textContent=FM.find(f=>f[2]===S.fmt)[0];$('tz').classList.toggle('hshare-mod',S.fz!==1);
 $('isn').classList.toggle('hshare-on',S.isn);$('isn').setAttribute('aria-pressed',S.isn);
}
function closeMenu(){menu.classList.remove('hshare-on');if(openT){openT.setAttribute('aria-expanded','false');openT=null}}
function openMenu(t,build){
 if(openT===t)return closeMenu();closeMenu();menu.innerHTML='';build(menu);
 const sr=$('sheet').getBoundingClientRect(),tr=t.getBoundingClientRect(),mw=menu.offsetWidth;
 const right=Math.max(12,Math.min(sr.right-tr.right,sr.width-mw-12));
 menu.style.right=right+'px';menu.style.bottom=(sr.bottom-tr.top+8)+'px';
 menu.style.transformOrigin=(tr.left+tr.width/2-(sr.right-right-mw))+'px bottom';
 menu.classList.add('hshare-on');t.setAttribute('aria-expanded','true');openT=t;
}
function item(label,sub,sel,fn){
 const b=document.createElement('button');b.className='hshare-mi'+(sel?' hshare-sel':'');b.setAttribute('role','menuitem');
 b.innerHTML=CK+'<span></span>'+(sub?'<small></small>':'');b.children[1].textContent=label;if(sub)b.children[2].textContent=sub;
 b.onclick=()=>{fn();closeMenu()};return b;
}
$('tc').onclick=()=>openMenu($('tc'),m=>{
 const g=document.createElement('div');g.className='hshare-pal';
 Object.keys(T).forEach(k=>{const b=document.createElement('button');b.title=T[k].n;b.setAttribute('aria-label',T[k].n);b.style.background=sw(k);
  if(k===S.cur)b.classList.add('hshare-sel');b.onclick=()=>{S.cur=k;sync();draw();closeMenu()};g.appendChild(b)});
 m.appendChild(g);
});
$('tf').onclick=()=>openMenu($('tf'),m=>FM.forEach(([a,b,h])=>m.appendChild(item(a,b,h===S.fmt,()=>{S.fmt=h;sync();layout()}))));
$('tz').onclick=()=>openMenu($('tz'),m=>FZ.forEach(([n,v])=>m.appendChild(item(n,'',v===S.fz,()=>{S.fz=v;sync();layout()}))));
$('isn').onclick=()=>{S.isn=!S.isn;sync();draw()};
$('dl').onclick=dl;$('x').onclick=close;$('scrim').onclick=close;

/* سحب المقبض للأسفل لإغلاق البطاقة */
let y0=null;const g=$('grab'),sh=$('sheet');
g.onpointerdown=e=>{y0=e.clientY;g.setPointerCapture(e.pointerId);sh.style.transition='none'};
g.onpointermove=e=>{if(y0!=null)sh.style.transform=`translate(-50%,${Math.max(0,e.clientY-y0)}px)`};
g.onpointerup=e=>{if(y0==null)return;const d=e.clientY-y0;y0=null;sh.style.transition='';sh.style.transform='';if(d>110)close()};

sync();
configure({html2canvas,builtInRim:false,fonts:{text:'"Thmanyah Serif Text"',title:'"Thmanyah Sans"',brand:'"Thmanyah Serif Display"',ui:'"Thmanyah Sans"'},saveImage:Capacitor.isNativePlatform()?saveHadithImage:null});
const ready=fonts().catch(()=>undefined);
return {open,close,isOpen,handleBack,destroy(){close();clearTimeout(tt);root.remove()},ready};
}
