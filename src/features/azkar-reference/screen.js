import html2canvas from 'html2canvas';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { saveHadithImage } from '@/services/hadith-share-native';
import { exportShareImage } from '@/components/hadith-share/export-engine';
import '@/components/hadith-share/sheet.css';
import markup from './screen.html?raw';
import './screen.css';

export function mountAzkarReference(root,data,onClose){
 root.className='azref-root';root.dir='rtl';root.innerHTML=markup;root.style.pointerEvents='none';
 root.querySelector('h1').textContent=data.title;
 root.querySelector('.done .sub').textContent=`أتممت ${data.title}`;
 const abort=new AbortController();let destroyed=false,fontReady=false,backListener=null;
 const ITEMS=data.items.map(o=>({t:o.text,n:o.count,s:o.source||'',key:o.bookmarkKey}));
 const readBookmarks=()=>{try{const x=JSON.parse(localStorage.getItem('bookmarked_azkar_keys')||'[]');return Array.isArray(x)?x:[]}catch{return []}};
 let fontsJob;
 function ensureFonts(){
  if(!fontsJob){const specs=['400 30px "Thmanyah Sans"','700 30px "Thmanyah Sans"','400 40px "Thmanyah Serif Text"','500 40px "Thmanyah Serif Text"','700 30px "Thmanyah Serif Display"'];
   fontsJob=Promise.race([Promise.all(specs.map(s=>document.fonts.load(s,'سُبْحَانَ اللَّهِ'))).then(()=>document.fonts.ready),new Promise(r=>setTimeout(r,3000))]).then(()=>{if(!specs.every(s=>document.fonts.check(s,'سُبْحَانَ اللَّهِ')))throw Error('Local fonts unavailable')});
  }return fontsJob;
 }
 function handleBack(){if(SakinaAzkarShare.handleBack())return;if(root.querySelector('#az_sheet').classList.contains('on')){sheet(false);return}if(root.querySelector('#az_done').classList.contains('on')){closeDone();return}onClose()}
 if(Capacitor.isNativePlatform())CapacitorApp.addListener('backButton',handleBack).then(h=>{if(destroyed)h.remove();else backListener=h});
const N=ITEMS.length,$=id=>root.querySelector("#az_"+id),stage=$("stage");
ITEMS.forEach(o=>{o.c=0;o.bm=readBookmarks().includes(o.key)});
const cards=ITEMS.map((o,i)=>{
  const c=document.createElement("div");c.className="card";
  c.innerHTML=`<div class="in"><div class="idx sk-rim">${i+1} / ${N}</div><div class="txt"><div class="tx"></div></div><div class="cnt sk-rim"><i></i><span></span></div></div>`;
  const tx=c.querySelector(".tx");
  const s=document.createElement("div");s.className="sg";s.textContent=o.t;tx.appendChild(s);
  stage.appendChild(c);return c;
});
let H=1,pos=0,target=0,vel=0,raf=0,cur=-1,locked=false;
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
function fit(c){
  const box=c.querySelector(".txt"),tx=box.firstElementChild,mh=box.clientHeight-2;
  const run=lh=>{tx.style.lineHeight=lh;tx.style.fontSize="11px";let lo=tx.offsetHeight>mh?4:11,hi=40;while(hi-lo>.25){const m=(lo+hi)/2;tx.style.fontSize=m+"px";tx.offsetHeight<=mh?lo=m:hi=m}return lo};
  let lh=1.95,f=run(lh);
  if(f<22){const f2=run(1.7);if(f2>f+.5){lh=1.7;f=f2}}
  tx.style.lineHeight=lh;tx.style.fontSize=f+"px";
  const lp=f*lh;
  tx.querySelectorAll(".sg:not(.bsm)").forEach(s=>{
    const lines=Math.max(1,Math.round(s.offsetHeight/lp)),words=s.textContent.trim().split(/\s+/).length;
    s.classList.toggle("ctr",words/lines<4.5);
  });
}
function pill(i){
  const o=ITEMS[i],c=cards[i],done=o.c>=o.n;
  c.querySelector(".cnt i").style.transform=`scaleX(${Math.min(o.c/o.n,1)})`;
  c.querySelector(".cnt span").textContent=done?(o.c>o.n?`تم ✓  +${o.c-o.n}`:"تم ✓"):`${o.c} من ${o.n} ${o.n===1?"مرة":o.n===2?"مرتين":o.n<=10?"مرات":"مرة"}`;
}
function render(){
  for(let i=0;i<N;i++){
    const d=i-pos,a=Math.min(Math.abs(d),1),c=cards[i];
    c.style.visibility=Math.abs(d)<1.25?"visible":"hidden";
    c.style.transform=`translate3d(0,${d*(H+14)}px,0) scale(${1-a*.07})`;
    c.style.opacity=1-a*.55;
  }
  const k=clamp(Math.round(pos),0,N-1);
  if(k!==cur){cur=k;$("bm").classList.toggle("on",ITEMS[k].bm);$("up").disabled=k===0;$("down").disabled=k===N-1}
}
function go(t){
  target=clamp(t,0,N-1);cancelAnimationFrame(raf);
  let last=performance.now();const K=240,C=2*Math.sqrt(K)*.95;
  const step=now=>{
    const dt=Math.min((now-last)/1000,.032);last=now;
    vel+=(-K*(pos-target)-C*vel)*dt;pos+=vel*dt;render();
    if(Math.abs(pos-target)<.0004&&Math.abs(vel)<.01){pos=target;vel=0;render();return}
    raf=requestAnimationFrame(step);
  };
  raf=requestAnimationFrame(step);
}
function toast(m){const t=$("toast");t.textContent=m;t.classList.add("on");clearTimeout(toast.h);toast.h=setTimeout(()=>t.classList.remove("on"),1900)}
let adv=0;
function afterDone(i){
  clearTimeout(adv);const o=ITEMS[i];
  adv=setTimeout(()=>{
    if(Math.round(pos)!==i||drag||locked)return;
    if(ITEMS.every(x=>x.c>=x.n))celebrate();
    else if(i<N-1){if(!o.over)go(i+1)}
    else toast(`بقي ${ITEMS.filter(x=>x.c<x.n).length} أذكار لم تكتمل`);
  },o.n===1?450:o.c>o.n?2200:1100);
}
function count(){
  const i=clamp(Math.round(pos),0,N-1),o=ITEMS[i];
  if(o.c>=o.n&&o.n===1){toast(i<N-1?"اكتمل هذا الذكر، اسحب للتالي":"اكتمل هذا الذكر");return}
  o.c++;if(o.c>o.n)o.over=true;pill(i);
  const el=cards[i].querySelector(".cnt"),fin=o.c===o.n;
  navigator.vibrate&&navigator.vibrate(fin?[12,40,12]:8);
  el.animate([{transform:"scale(1)"},{transform:"scale(1.07)"},{transform:"scale(1)"}],{duration:320,easing:"cubic-bezier(.2,.8,.2,1)"});
  if(fin)el.animate([{boxShadow:"0 0 0 0 var(--goldfill)"},{boxShadow:"0 0 0 16px transparent"}],{duration:750,easing:"cubic-bezier(.2,.8,.2,1)"});
  if(o.c===o.n+1)toast("ما شاء الله، زدت على المطلوب");
  if(o.c>=o.n)afterDone(i);
}
let drag=null;
stage.addEventListener("pointerdown",e=>{
  if(locked)return;
  cancelAnimationFrame(raf);stage.setPointerCapture(e.pointerId);
  drag={y:e.clientY,x:e.clientX,p:pos,moved:false,t:performance.now(),pts:[[performance.now(),e.clientY]]};
  cards[clamp(Math.round(pos),0,N-1)].classList.add("press");
});
stage.addEventListener("pointermove",e=>{
  if(!drag)return;
  const dy=e.clientY-drag.y,dx=e.clientX-drag.x;
  if(!drag.moved){if(Math.abs(dy)<7)return;if(Math.abs(dx)>Math.abs(dy)*1.4){return}drag.moved=true;cards.forEach(c=>c.classList.remove("press"))}
  let r=drag.p-dy/H;
  if(r<0)r*=.35;else if(r>N-1)r=N-1+(r-(N-1))*.35;
  pos=r;render();
  const n=performance.now();drag.pts.push([n,e.clientY]);
  while(drag.pts.length>2&&n-drag.pts[0][0]>90)drag.pts.shift();
});
function end(e){
  if(!drag)return;const d=drag;drag=null;
  cards.forEach(c=>c.classList.remove("press"));
  if(!d.moved){if(e.type==="pointerup")count();go(Math.round(pos));return}
  const a=d.pts[0],b=d.pts[d.pts.length-1],dt=Math.max((b[0]-a[0])/1000,.016);
  vel=-((b[1]-a[1])/H)/dt;vel=clamp(vel,-6,6);
  const start=Math.round(d.p);
  go(clamp(Math.round(pos+vel*.12),start-1,start+1));
}
stage.addEventListener("pointerup",end);stage.addEventListener("pointercancel",end);
$("up").onclick=()=>go(Math.round(pos)-1);
$("down").onclick=()=>go(Math.round(pos)+1);
$("back").onclick=handleBack;
$("bm").onclick=()=>{const o=ITEMS[cur];o.bm=!o.bm;const all=readBookmarks().filter(k=>k!==o.key);if(o.bm)all.push(o.key);localStorage.setItem("bookmarked_azkar_keys",JSON.stringify(all));$("bm").classList.toggle("on",o.bm);$("bm").animate([{transform:"scale(1)"},{transform:"scale(1.18)"},{transform:"scale(1)"}],{duration:340,easing:"cubic-bezier(.2,.8,.2,1)"});toast(o.bm?"تم حفظ الذكر":"أُزيل من المحفوظات")};
$("share").onclick=()=>{const o=ITEMS[cur];SakinaAzkarShare.open({t:o.t,source:o.s,n:o.n,i:cur+1,category:data.title})};
function sheet(on){locked=on;$("scrim").classList.toggle("on",on);$("sheet").classList.toggle("on",on)}
function srcFill(s){
  $("secF").hidden=true;const c=$("srcC");c.textContent="";c.parentElement.hidden=!s;
  if(s){const e=document.createElement("span");e.className="chip";e.textContent=s;c.appendChild(e)}
}
$("src").onclick=()=>{srcFill(ITEMS[cur].s);sheet(true)};
$("sclose").onclick=()=>sheet(false);
{let y0=null;const g=$("sgrab"),s=$("sheet");
g.onpointerdown=e=>{y0=e.clientY;g.setPointerCapture(e.pointerId);s.style.transition="none"};
g.onpointermove=e=>{if(y0!=null)s.style.transform=`translateY(${Math.max(0,e.clientY-y0)}px)`};
g.onpointerup=e=>{if(y0==null)return;const d=e.clientY-y0;y0=null;s.style.transition="";s.style.transform="";if(d>90)sheet(false)}}
$("scrim").onclick=()=>sheet(false);
window.addEventListener("keydown",e=>{
  if(e.key==="Escape"){handleBack();return;}
  else if(locked||!fontReady)return;
  else if(e.key==="ArrowDown")go(Math.round(pos)+1);
  else if(e.key==="ArrowUp")go(Math.round(pos)-1);
  else if(e.key===" "||e.key==="Enter"){e.preventDefault();count()}
},{signal:abort.signal});
function layout(){H=stage.clientHeight||1;cards.forEach(fit);render()}
const resizeObserver=new ResizeObserver(()=>{if(fontReady)layout()});resizeObserver.observe(stage);
cards.forEach((_,i)=>pill(i));
ensureFonts().then(()=>{if(!destroyed){fontReady=true;layout();root.style.pointerEvents=''}}).catch(()=>{if(!destroyed){root.querySelector('#az_back').style.pointerEvents='auto';toast("تعذّر تحميل الخطوط المحلية")}});

function streak(){let s=1;try{const k="adhkar-streak",d=new Date(),t=d.toDateString(),y=new Date(d-864e5).toDateString(),v=JSON.parse(localStorage.getItem(k)||"null");if(v&&v.d===t)s=v.s;else if(v&&v.d===y)s=v.s+1;localStorage.setItem(k,JSON.stringify({d:t,s}))}catch(_){}return s}
function celebrate(){
  const s=streak();
  $("s1").textContent=N;$("s2").textContent=ITEMS.reduce((a,o)=>a+o.c,0);$("s3").textContent=s;
  $("s3l").textContent=s===1?"بداية الاستمرار":s===2?"يومان متتاليان":"أيام متتالية";
  locked=true;$("done").classList.add("on");$("done").setAttribute("aria-hidden","false");
  navigator.vibrate&&navigator.vibrate([14,60,14,60,28]);
  const w=$("rw");
  for(let k=0;k<16;k++){
    const d=document.createElement("i"),a=k/16*2*Math.PI+Math.random()*.3,r=64+Math.random()*28;d.className="bp";w.appendChild(d);
    d.animate([{transform:"translate(0,0) scale(.4)",opacity:0},{opacity:1,offset:.25},{transform:`translate(${Math.cos(a)*r}px,${Math.sin(a)*r}px) scale(1)`,opacity:0}],{duration:1100+Math.random()*400,delay:900,easing:"cubic-bezier(.2,.8,.2,1)",fill:"backwards"}).onfinish=()=>d.remove();
  }
}
function closeDone(){locked=false;$("done").classList.remove("on");$("done").setAttribute("aria-hidden","true")}
$("dclose").onclick=closeDone;
$("dreset").onclick=()=>{ITEMS.forEach(o=>{o.c=0;o.over=false});cards.forEach((_,i)=>pill(i));closeDone();go(0)};


const SakinaAzkarShare=(()=>{
const $=i=>root.querySelector("#az_k_"+i);
const toAr=s=>String(s).replace(/\d/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
let BRAND={name:'سكينة',tag:'تطبيق إسلامي'};
/* The independent image design uses the shared export and native save engine. */
const CFG={html2canvas,maxPixels:0,saveImage:Capacitor.isNativePlatform()?saveHadithImage:webDownload};
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
let D={},S={cur:'dusk',fmt:1350,ss:true,short:false,fz:1};
function hl(m){const i=m.search(/[،؛.:]/);return(i>=14&&i<=70&&m.length>i+40)?[m.slice(0,i),m.slice(i)]:[m,'']}
function put(id,v){const e=$(id);e.textContent=v;e.style.display=v?'':'none'}
function size(px){$('o_mt').style.fontSize=px+'px';$('o_ld').style.fontSize=Math.max(21,px*(S.short?.5:.4))+'px'}
/* ===== ضبط حجم الخط تلقائيًا ليملأ المساحة بأكبر حجم ممكن ===== */
function layout(){
 const c=$('card'),mid=$('mid'),blk=$('blk'),v=S.fz,L=$('o_mt').textContent.length;let note='';
 if(!S.fmt){c.style.height='auto';c.style.minHeight='1350px';size((L<120?70:L<260?60:L<480?52:L<800?44:L<1200?38:32)*v)}
 else{
  c.style.height=S.fmt+'px';c.style.minHeight='0';let lo=20,hi=120;size(lo);
  if(blk.offsetHeight>mid.clientHeight)note='النص طويل على هذا المقاس. اختر «تلقائي» أو مقاسًا أطول.';
  else{while(hi-lo>.4){const m=(lo+hi)/2;size(m);blk.offsetHeight<=mid.clientHeight?lo=m:hi=m}size(lo*Math.min(1,v))}
 }
 if(note)toast(note,'er',3400);view();
}
function view(){
 const w=$('well'),h=$('card').offsetHeight;if(!h)return;
 const s=Math.max(.05,Math.min((w.clientWidth-32)/1080,(w.clientHeight-32)/h));
 $('st').style.transform=`scale(${s})`;$('pv').style.width=1080*s+'px';$('pv').style.height=h*s+'px';
}
const cl=n=>n===1?'مرة واحدة':n===2?'مرتان':n<=10?toAr(n)+' مرات':toAr(n)+' مرة';
function draw(){
 const t=T[S.cur],c=$('card');
 for(const k in t)if(!['n','gc','go','lt'].includes(k))c.style.setProperty('--'+k,t[k]);
 $('grn').style.backgroundImage=grain(t.gc,t.go);$('grn').style.opacity=t.gc?.07:.1;
 S.short=true;
 put('o_bk',D.source||'');put('o_kt','');put('o_bb','');put('o_ld','');
 const m=$('o_mt');m.textContent='';
 const [a,b]=hl(D.t);[[a,b?'em':'span'],[b,'span']].forEach(([x,tag])=>{if(x){const e=document.createElement(tag);e.textContent=x;m.appendChild(e)}});
 put('o_nm',cl(D.n));put('o_gr',D.category||'');put('o_br',BRAND.name);put('o_tg',BRAND.tag);
 layout();
}
/* ===== انتظار الخطوط المحلية (بمهلة أمان؛ فشل خط لا يوقف العملية) ===== */
async function fonts(){await ensureFonts()}
let tt;function toast(m,k='',ms=2800){const e=$('toast');e.textContent=m;e.className='k-toast on '+k;clearTimeout(tt);tt=setTimeout(()=>e.classList.remove('on'),ms)}
/* ===== التصدير: سلّم جودة تلقائي صامت (4K ثم أقل حتى ينجح) ===== */
const MSG={gallery:'تم الحفظ في المعرض',shared:'تم تجهيز الصورة للمشاركة',download:'تم التنزيل'};
async function exportImage(){await fonts();draw();if($('blk').offsetHeight>$('mid').clientHeight)throw new Error('text-overflow');return exportShareImage({CFG,fonts,draw,card:$('card'),preview:$('pv')})}
function webDownload(blob,name){
 const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(a.href),5000);return 'download';
}
let dlTimer;
async function dl(){
 const b=$('dl'),t=$('dlt');if(b.disabled)return;b.disabled=true;t.textContent='جارٍ…';
 try{
  const r=await exportImage(),name='sakina-dhikr-'+String(D.i||'card')+'.png';
  if(destroyed)return;
  const how=(await CFG.saveImage(r.blob,name))||'gallery';
  if(how==='cancelled'){t.textContent='حفظ';b.disabled=false;return}
  t.textContent='تم ✓';toast(`${MSG[how]||MSG.download}${r.scale>=4?' بجودة 4K':''} · ${r.width}×${r.height}`,'ok',3400);
 }catch(e){if(e?.message==='text-overflow'){t.textContent='حفظ';toast('النص طويل على هذا المقاس. اختر «تلقائي» أو مقاسًا أطول.','er',5000)}else{console.error('[SakinaAzkarShare]',e);t.textContent='أعد المحاولة';toast('تعذّر الحفظ، حاول مرة أخرى','er',5000)}}
 clearTimeout(dlTimer);dlTimer=setTimeout(()=>{t.textContent='حفظ'},2200);b.disabled=false;
}
/* ===== فتح وإغلاق البطاقة السفلية ===== */
function open(d){
 if(d)D=d;$('ss').hidden=!D.f;sync();
 $('scrim').classList.add('on');const s=$('sheet');s.classList.add('on');s.setAttribute('aria-hidden','false');
 locked=true;const gen=++generation;fonts().then(()=>{if(!destroyed&&isOpen()&&gen===generation)draw()}).catch(()=>toast('تعذّر تحميل الخطوط المحلية','er'));$('x').focus({preventScroll:true});
}
let generation=0;
function close(){++generation;closeMenu();$('scrim').classList.remove('on');const s=$('sheet');s.classList.remove('on');s.setAttribute('aria-hidden','true');locked=false}
const isOpen=()=>$('sheet').classList.contains('on');
function handleBack(){if(!isOpen())return false;if(openT)closeMenu();else close();return true}
function configure(o={}){
 const{fonts:fo,brand,...rest}=o;Object.assign(CFG,rest);
 if(fo)for(const k in fo)root.style.setProperty('--sk-f-'+k,fo[k]);
 if(brand)BRAND={...BRAND,...brand};
 if(isOpen())draw();
}

/* ===== القوائم المنسدلة على طريقة Apple ===== */
const CK='<svg class="k-i k-ck" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>';
const sw=k=>`radial-gradient(circle at 25% 80%,${T[k].o2},transparent 60%),linear-gradient(160deg,${T[k].b2},${T[k].b1})`;
const menu=$('menu');let openT=null;
function sync(){
 $('tcd').style.background=sw(S.cur);$('tcn').textContent=T[S.cur].n;
 $('tfn').textContent=FM.find(f=>f[2]===S.fmt)[0];$('tz').classList.toggle('mod',S.fz!==1);
 $('ss').classList.toggle('on',S.ss);$('ss').setAttribute('aria-pressed',S.ss);
}
function closeMenu(){menu.classList.remove('on');if(openT){openT.setAttribute('aria-expanded','false');openT=null}}
function openMenu(t,build){
 if(openT===t)return closeMenu();closeMenu();menu.innerHTML='';build(menu);
 const sr=$('sheet').getBoundingClientRect(),tr=t.getBoundingClientRect(),mw=menu.offsetWidth;
 const right=Math.max(12,Math.min(sr.right-tr.right,sr.width-mw-12));
 menu.style.right=right+'px';menu.style.bottom=(sr.bottom-tr.top+8)+'px';
 menu.style.transformOrigin=(tr.left+tr.width/2-(sr.right-right-mw))+'px bottom';
 menu.classList.add('on');t.setAttribute('aria-expanded','true');openT=t;
}
function item(label,sub,sel,fn){
 const b=document.createElement('button');b.className='mi'+(sel?' sel':'');b.setAttribute('role','menuitem');
 b.innerHTML=CK+'<span></span>'+(sub?'<small></small>':'');b.children[1].textContent=label;if(sub)b.children[2].textContent=sub;
 b.onclick=()=>{fn();closeMenu()};return b;
}
$('tc').onclick=()=>openMenu($('tc'),m=>{
 const g=document.createElement('div');g.className='pal';
 Object.keys(T).forEach(k=>{const b=document.createElement('button');b.title=T[k].n;b.setAttribute('aria-label',T[k].n);b.style.background=sw(k);
  if(k===S.cur)b.classList.add('sel');b.onclick=()=>{S.cur=k;sync();draw();closeMenu()};g.appendChild(b)});
 m.appendChild(g);
});
$('tf').onclick=()=>openMenu($('tf'),m=>FM.forEach(([a,b,h])=>m.appendChild(item(a,b,h===S.fmt,()=>{S.fmt=h;sync();layout()}))));
$('tz').onclick=()=>openMenu($('tz'),m=>FZ.forEach(([n,v])=>m.appendChild(item(n,'',v===S.fz,()=>{S.fz=v;sync();layout()}))));
$('ss').onclick=()=>{S.ss=!S.ss;sync();draw()};
$('dl').onclick=dl;$('x').onclick=close;$('scrim').onclick=close;
document.addEventListener('pointerdown',e=>{if(openT&&!menu.contains(e.target)&&!openT.contains(e.target))closeMenu()},{capture:true,signal:abort.signal});

window.addEventListener('resize',view,{signal:abort.signal});
/* سحب المقبض للأسفل لإغلاق البطاقة */
let y0=null;const g=$('grab'),sh=$('sheet');
g.onpointerdown=e=>{y0=e.clientY;g.setPointerCapture(e.pointerId);sh.style.transition='none'};
g.onpointermove=e=>{if(y0!=null)sh.style.transform=`translate(-50%,${Math.max(0,e.clientY-y0)}px)`};
g.onpointerup=e=>{if(y0==null)return;const d=e.clientY-y0;y0=null;sh.style.transition='';sh.style.transform='';if(d>110)close()};

sync();
return {open,close,isOpen,handleBack,destroy(){close();clearTimeout(tt);clearTimeout(dlTimer)}};
})();
 return ()=>{destroyed=true;abort.abort();resizeObserver.disconnect();cancelAnimationFrame(raf);clearTimeout(adv);clearTimeout(toast.h);SakinaAzkarShare.destroy();if(backListener)backListener.remove();root.replaceChildren()};
}
