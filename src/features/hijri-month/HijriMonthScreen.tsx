import { useMemo, useState, useEffect } from 'react';
import ProgressiveBlur from '@/components/ProgressiveBlur';
import { fromCivilDay, localCivilDay, toCivilDay, HIJRI_MONTH_NAMES, OCCASIONS } from './calendar';
import './hijri-month.css';

export const HIJRI_HERO = `${import.meta.env.BASE_URL}images/hijri-month/courtyard.webp`;
let heroReady: Promise<void> | undefined;
let predecodedHero: HTMLImageElement | undefined;
export function preloadHijriHero() {
  if (!heroReady) {
    predecodedHero = new Image(); predecodedHero.src = HIJRI_HERO;
    heroReady = predecodedHero.decode().catch(() => undefined);
  }
  return heroReady;
}
const digits = (number: number) => String(number).replace(/[0-9]/g, n => '٠١٢٣٤٥٦٧٨٩'[+n]);
const gregorianMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const hijriLabel = (day: number, month: number, year: number) => `${digits(day)} ${HIJRI_MONTH_NAMES[month - 1]} ${digits(year)}`;
const gregorianLabel = (civil: number) => { const date = new Date(civil * 86400000); return `${digits(date.getUTCDate())} ${gregorianMonths[date.getUTCMonth()]} ${digits(date.getUTCFullYear())}`; };
const unit = (days: number) => days === 1 ? 'يوم' : days === 2 ? 'يومان' : days <= 10 ? 'أيام' : 'يومًا';
function Arrow() { return <svg className="hm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>; }
function Check() { return <svg className="hm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>; }
type EventRow = { name:string; month:number; day:number; year:number; civil:number; days:number };
function Row({ event, past, index }: { event: EventRow; past?: boolean; index: number }) {
  return <li className={`hm-event${past ? ' hm-past' : ''}`} style={{'--hm-i':index} as React.CSSProperties}>
    <span className="hm-dot">{past && <Check />}</span><div className="hm-event-text"><b>{event.name}</b><small>{hijriLabel(event.day,event.month,event.year)}</small></div>
    <div className="hm-days">{past ? <small>قد مضى</small> : <><b>{digits(event.days)}</b><small>{event.days === 0 ? 'اليوم' : 'يوم'}</small></>}</div>
  </li>;
}
export default function HijriMonthScreen({ onBack }: { onBack: () => void }) {
  const [now,setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = window.setInterval(update, 1000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('focus', update);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', update); window.removeEventListener('focus', update); };
  }, []);
  const [scrolled,setScrolled] = useState(false), [expanded,setExpanded] = useState(false), [count,setCount] = useState(0);
  const civil = localCivilDay(now);
  const today = useMemo(() => fromCivilDay(civil), [civil]);
  const events = useMemo(() => {
    if (!today) return {up: [] as EventRow[], past: [] as EventRow[], incomplete: false};
    const up: EventRow[] = [], past: EventRow[] = []; let incomplete = false;
    for (const event of OCCASIONS) for (const year of [today.year, today.year + 1]) {
      const eventCivil = toCivilDay({...event,year});
      if (eventCivil === null) { incomplete = true; continue; }
      const row = {...event,year,civil:eventCivil,days:eventCivil-civil};
      if (year === today.year && row.days < 0) past.push(row);
      else if (row.days >= 0) up.push(row);
    }
    up.sort((a,b)=>a.civil-b.civil); past.sort((a,b)=>a.civil-b.civil);
    return {up,past,incomplete};
  }, [civil,today]);
  const next = events.up[0];
  useEffect(() => {
    if (!next || next.days <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches) { setCount(next?.days || 0); return; }
    let frame = 0; const t0 = performance.now();
    const tick = (t:number) => { const k = Math.min(1,(t-t0)/1100); setCount(Math.round(next.days*(1-Math.pow(1-k,3)))); if(k<1) frame=requestAnimationFrame(tick); };
    frame=requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [next?.civil]);
  return <div className="hm-root" dir="rtl" data-hijri-month-screen>
    {scrolled && <ProgressiveBlur inline />}
    <header className="hm-bar"><div className="hm-top"><div className="hm-cap cut-crystal-capsule sk-rim">التقويم الهجري</div><button type="button" className="hm-back cut-crystal-capsule sk-rim" aria-label="رجوع" onClick={onBack}><Arrow /></button></div></header>
    <div className="hm-scroll" onScroll={event => setScrolled(event.currentTarget.scrollTop > 0)}>
      <section className="hm-hero"><div className="hm-hero-bg" /><img src={HIJRI_HERO} width="1122" height="1402" alt="" decoding="sync" /><div className="hm-hero-in"><h1>{today ? HIJRI_MONTH_NAMES[today.month-1] : 'التقويم الهجري'}</h1>{today && <div className="hm-chips"><span className="hm-chip"><b>{digits(today.year)}</b> للهجرة</span><span className="hm-chip">اليوم <b>{digits(today.day)}</b> من الشهر</span></div>}</div></section>
      <main className="hm-page">
        <section className="hm-card hm-dua hm-rise" style={{'--hm-n':1} as React.CSSProperties}><div className="hm-label">دعاء دخول الشهر</div><p className="hm-narration">كَانَ أَصْحَابُ رَسُولِ اللهِ صَلَّى اللهُ عَلَيْهِ وَسَلَّمَ يَتَعَلَّمُونَ هَذَا الدُّعَاءَ كَمَا يَتَعَلَّمُونَ القُرْآنَ إِذَا دَخَلَ الشَّهْرُ أَوِ السَّنَةُ:</p><p className="hm-prayer">«اللَّهُمَّ أَدْخِلْهُ عَلَيْنَا بِالأَمْنِ، وَالإِيمَانِ، وَالسَّلَامَةِ، وَالإِسْلَامِ، وَجِوَارٍ مِنَ الشَّيْطَانِ، وَرِضْوَانٍ مِنَ الرَّحْمَنِ»</p><p className="hm-source">صححه الحافظ ابن حجر في «الإصابة» ٦ / ٤٠٧ - ٤٠٨</p></section>
        <div className="hm-main">{!today ? <section className="hm-card hm-unavailable">التاريخ خارج نطاق بيانات تقويم أم القرى المتاحة محليًا.</section> : <>
          {next && <section className="hm-card hm-next hm-rise" style={{'--hm-n':2} as React.CSSProperties}>
            <svg className="hm-moon" viewBox="0 0 80 80" aria-hidden="true"><defs><mask id="hm-moon-mask"><circle cx="40" cy="40" r="30" fill="white"/><circle className="hm-moon-mask" cx="40" cy="40" r="30" fill="black" style={{"--hm-moon-offset":`${-Math.max(.04, Math.min(1, 1-next.days/354))*62}px`} as React.CSSProperties}/></mask></defs><circle cx="40" cy="40" r="30" fill="var(--sk-bg3)" stroke="var(--sk-label4)" strokeWidth="2"/><circle cx="40" cy="40" r="30" fill="var(--sk-accent)" mask="url(#hm-moon-mask)"/></svg>
            <div className="hm-next-text"><small>قريبًا بإذن الله</small><h2>{next.name}</h2><p><span>{hijriLabel(next.day,next.month,next.year)}</span><span>{gregorianLabel(next.civil)}</span></p></div><div className="hm-next-count"><b>{next.days ? digits(count) : 'اليوم'}</b>{next.days ? unit(next.days) : ''}</div>
          </section>}
          {events.up.length > 1 && <section className="hm-rise" style={{'--hm-n':3} as React.CSSProperties}><h2 className="hm-group-title">المناسبات القادمة</h2><ul className="hm-card">{events.up.slice(1).map((event,i)=><Row key={`${event.year}-${event.month}-${event.day}`} event={event} index={i} />)}</ul></section>}
          {events.past.length > 0 && <section className="hm-rise" style={{'--hm-n':4} as React.CSSProperties}><div className="hm-card"><button className="hm-past-header" type="button" aria-expanded={expanded} aria-controls="hm-past-list" onClick={()=>setExpanded(!expanded)}><span>مناسبات مضت في هذا العام</span><span className="hm-badge">{digits(events.past.length)}</span><svg className="hm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg></button><div className="hm-past-body" id="hm-past-list" aria-hidden={!expanded} inert={!expanded}><div><ul>{events.past.map((event,i)=><Row key={`${event.year}-${event.month}-${event.day}`} event={event} index={i} past />)}</ul></div></div></div></section>}
          {events.incomplete && <p className="hm-unavailable">بعض المناسبات خارج نطاق بيانات التقويم المتاحة محليًا.</p>}
        </>}</div>
        <footer className="hm-note hm-rise" style={{'--hm-n':5} as React.CSSProperties}><svg className="hm-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.01"/></svg><p>تنويه: المواعيد وفق تقويم أم القرى الحسابي، وقد تختلف حسب الرؤية الشرعية وإعلان الجهات المختصة. لا يتلقى التقويم تحديثات الرؤية دون تحديث التطبيق.</p></footer>
      </main>
    </div>
  </div>;
}
