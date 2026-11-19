import { useState } from 'react';
import ProgressiveBlur from '@/components/ProgressiveBlur';
import { arabicDigits as digits, formatDaysRemaining, formatHijriDate, HIJRI_MONTH_NAMES, type HijriOccasion, type upcomingHijriOccasions } from '@/services/hijri-calendar';
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
const gregorianMonths = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const hijriLabel = (day: number, month: number, year: number) => formatHijriDate({day,month,year});
const gregorianLabel = (civil: number) => { const date = new Date(civil * 86400000); return `${digits(date.getUTCDate())} ${gregorianMonths[date.getUTCMonth()]} ${digits(date.getUTCFullYear())}`; };
function Arrow() { return <svg className="hm-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>; }
function Row({ event, index }: { event: HijriOccasion; index: number }) {
  return <li className="hm-event" style={{'--hm-i':index} as React.CSSProperties}>
    <span className="hm-dot"/><div className="hm-event-text"><b>{event.name}</b><small>{hijriLabel(event.day,event.month,event.year)}</small></div>
    <div className="hm-days"><b>{formatDaysRemaining(event.days)}</b></div>
  </li>;
}
export default function HijriMonthScreen({ data, onBack }: { data: ReturnType<typeof upcomingHijriOccasions>; onBack: () => void }) {
  const [scrolled,setScrolled] = useState(false);
  const { today, upcoming } = data;
  const next = upcoming[0];
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
            <div className="hm-next-text"><small>قريبًا بإذن الله</small><h2>{next.name}</h2><p><span>{hijriLabel(next.day,next.month,next.year)}</span><span>{gregorianLabel(next.civil)}</span></p></div><div className="hm-next-count"><b>{formatDaysRemaining(next.days)}</b></div>
          </section>}
          {upcoming.length > 1 && <section className="hm-rise" style={{'--hm-n':3} as React.CSSProperties}><h2 className="hm-group-title">المناسبات القادمة</h2><ul className="hm-card">{upcoming.slice(1).map((event,i)=><Row key={`${event.year}-${event.month}-${event.day}`} event={event} index={i} />)}</ul></section>}
          {!next && <p className="hm-card hm-unavailable">لا توجد مناسبات قادمة في هذا العام الهجري.</p>}
        </>}</div>
        <footer className="hm-note hm-rise" style={{'--hm-n':5} as React.CSSProperties}><svg className="hm-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.8v.01"/></svg><p>تنويه: المواعيد وفق تقويم أم القرى الحسابي، وقد تختلف عن إعلان الرؤية الشرعية للجهات المختصة.</p></footer>
      </main>
    </div>
  </div>;
}
