// The measurement override is shared if two sheet instances export at once.
let activeMetricExports=0;
async function withExportMetrics(render){
 if(activeMetricExports++===0)document.body.classList.add('hshare-export-metrics');
 try{return await render()}finally{
  if(--activeMetricExports===0)document.body.classList.remove('hshare-export-metrics');
 }
}

const LADDER=[4,3.5,3,2.5,2,1.5,1];
const frames=n=>new Promise(r=>{const f=()=>n--<=0?r():requestAnimationFrame(f);f()});
function pixelBudget(CFG){
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
export async function exportShareImage({CFG,fonts,draw,card,preview}){
 const h2c=CFG.html2canvas||window.html2canvas;if(!h2c)throw new Error('SakinaShare: html2canvas غير مُمرَّرة عبر configure()');
 await fonts();draw();await frames(2);
 const H=card.offsetHeight,cap=pixelBudget(CFG);let last=null;
 for(const s of LADDER){
  const w=Math.round(1080*s),h=Math.round(H*s);
  if((s>1&&w*h>cap)||!canvasOK(w,h))continue;
  let cv=null;
  try{
   cv=await withExportMetrics(()=>h2c(card,{scale:s,backgroundColor:null,logging:false,imageTimeout:0,onclone:d=>{
    let n=d.getElementById(card.id).parentElement;
    while(n&&n!==d.body){n.style.transform='none';n.style.overflow='visible';n=n.parentElement}
    const p=d.getElementById(preview.id);p.style.width='auto';p.style.height='auto';
   }}));
   if(!nonBlank(cv))throw new Error('blank canvas');
   const blob=await new Promise(r=>cv.toBlob(r,'image/png'));
   if(!blob||!blob.size)throw new Error('empty blob');
   const out={blob,width:cv.width,height:cv.height,scale:s};cv.width=cv.height=0;return out;
  }catch(e){last=e;if(cv)cv.width=cv.height=0;await frames(1)}
 }
 throw last||new Error('export failed');
}
