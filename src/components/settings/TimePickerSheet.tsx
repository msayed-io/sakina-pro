/**
 * TimePickerSheet — منتقي الوقت المخصص (لا واجهة أصلية من الجهاز).
 *
 * منقول بالحرف من المرجع: ثلاث عجلات (ساعة 1–12، دقائق 00–59، ص/م)،
 * صف 36px، عجلة 180px تعرض خمسة صفوف، شريط تحديد في الوسط، تدرج باهت
 * أعلى وأسفل، والتقاط إلزامي على الصف الأقرب. السحب باللمس وبعجلة الفأرة
 * وبالفأرة، والضغط على أي رقم ينتقل إليه. اهتزاز خفيف عند تغيّر الرقم عبر
 * navigator.vibrate (نفس ما يستخدمه التطبيق بالفعل في شاشته وأذكاره).
 *
 * التخزين 24 ساعة (`HH:mm`) كما يفعل نظام التذكير الحقيقي، والعرض 12 ساعة
 * مع ص/م. الحالات الحدية مغطاة: 12:00ص = 00:00 · 12:00م = 12:00 ·
 * 12:30ص = 00:30 · 11:59م = 23:59.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useSheetDrag } from "./hooks/useSheetDrag";

export const HOURS = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
export const MINUTES = Array.from({ length: 60 }, (_, i) => i); // 0..59
export const PERIODS = ["ص", "م"] as const;

/** عرض 24h ← مكوّنات العجلة. */
export function splitTime24(value: string): {
  hour12: number;
  minute: number;
  period: 0 | 1;
} {
  const [h, m] = value.split(":").map((n) => parseInt(n, 10));
  const hour = Number.isFinite(h) ? h : 21;
  const minute = Number.isFinite(m) ? m : 0;
  const period: 0 | 1 = hour >= 12 ? 1 : 0;
  const hour12 = hour % 12 || 12;
  return { hour12, minute, period };
}

/** مكوّنات العجلة ← تخزين 24h بصيغة HH:mm. */
export function joinTime24(hour12: number, minute: number, period: 0 | 1): string {
  const base = hour12 % 12; // 12 ص → 0، 12 م → 12
  const hour24 = period === 1 ? base + 12 : base;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** عرض 12h عربي: «9:00 م». */
export function formatTime12Arabic(value: string): string {
  const { hour12, minute, period } = splitTime24(value);
  return `${hour12}:${String(minute).padStart(2, "0")} ${PERIODS[period]}`;
}

const ITEM_HEIGHT = 36; // من المرجع

type WheelProps = {
  items: Array<{ value: number; label: string }>;
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  className?: string;
  /** الورقة مفتوحة الآن؟ التهيئة تنتظر حتى يكون للعجلة حجم حقيقي. */
  open: boolean;
};

/**
 * عجلة واحدة: scroll-snap إلزامي + التقاط نهائي بعد التوقف + انتقال بالضغط.
 * المواضع تُحسب من scrollTop لا من getBoundingClientRect، فلا تتأثر بالخط
 * ولا تتأخر قبل تحميله.
 */
function Wheel({
  items,
  value,
  onChange,
  ariaLabel,
  className = "",
  open,
}: WheelProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef<number | null>(null);
  const scrollSettleRef = useRef<(() => void) | null>(null);
  const lastIndex = useRef<number>(0);
  const scrollTimeout = useRef<number | null>(null);

  const indexOfValue = useCallback(
    (v: number) => Math.max(0, items.findIndex((item) => item.value === v)),
    [items],
  );

  /**
   * موضع التمرير الحقيقي لصفّ — يُقاس بالمستطيلات لا بـ offsetTop
   * (offsetTop نسبيّ لأقرب أب مُوضَّع، لا لحاوية التمرير).
   */
  const offsetOf = useCallback((index: number) => {
    const el = ref.current;
    const child = el?.children[index] as HTMLElement | undefined;
    if (!el || !child) return 0;
    const elRect = el.getBoundingClientRect();
    const childRect = child.getBoundingClientRect();
    // المسافة داخل المحتوى من أعلى الحاوية = (فرق الأعلى) + التمرير الحالي
    const childTopInContent = childRect.top - elRect.top + el.scrollTop;
    const centered = childTopInContent - (el.clientHeight - childRect.height) / 2;
    return Math.max(0, Math.round(centered));
  }, []);

  // التهيئة تنتظر الفتح وحجمًا حقيقيًا — لا تُقاس عجلة مخفية.
  useEffect(() => {
    const el = ref.current;
    if (!el || !open) return;
    const index = indexOfValue(value);
    lastIndex.current = index;
    const apply = () => {
      el.scrollTop = offsetOf(index);
    };
    apply();
    const frame = requestAnimationFrame(apply);
    const timer = window.setTimeout(apply, 120);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // عند تغيّر القيمة من الخارج (فتح الورقة على وقت محفوظ).
  useEffect(() => {
    if (!open) return;
    const el = ref.current;
    if (!el) return;
    const index = indexOfValue(value);
    const target = offsetOf(index);
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTop = target;
      lastIndex.current = index;
    }
  }, [value, indexOfValue, offsetOf, open]);

  // عجلة الفأرة كغير passive — preventDefault يجب أن ينجح فعلاً.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      el.scrollTop += event.deltaY > 0 ? ITEM_HEIGHT : -ITEM_HEIGHT;
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      settleTimer.current = window.setTimeout(
        () => scrollSettleRef.current?.(),
        90,
      );
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  // عند تغيّر القيمة من الخارج (فتح الورقة على وقت محفوظ).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const index = indexOfValue(value);
    const target = offsetOf(index);
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTop = target;
      lastIndex.current = index;
    }
  }, [value, indexOfValue, offsetOf]);

  const settle = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // فكّ الالتقاط: أقرب طفل لمركز العجلة (لا قسمة على ITEM_HEIGHT، فيها padding).
    const bandCenter = el.getBoundingClientRect().top + el.clientHeight / 2;
    let best = 0;
    let bestDelta = Infinity;
    for (let i = 0; i < el.children.length; i += 1) {
      const child = el.children[i] as HTMLElement;
      const rect = child.getBoundingClientRect();
      const delta = Math.abs(rect.top + rect.height / 2 - bandCenter);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    }
    const clamped = best;
    const target = offsetOf(clamped);
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTo({ top: target, behavior: "smooth" });
    }
    const next = items[clamped].value;
    if (clamped !== lastIndex.current) {
      lastIndex.current = clamped;
      // اهتزاز خفيف عند تغيّر الرقم — نفس ما يستخدمه التطبيق.
      navigator.vibrate?.(8);
    }
    if (next !== value) onChange(next);
  }, [items, onChange, value, offsetOf]);

  scrollSettleRef.current = settle;

  const onScroll = useCallback(() => {
    if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
    scrollTimeout.current = window.setTimeout(settle, 90);
  }, [settle]);

  useEffect(
    () => () => {
      if (settleTimer.current) window.clearTimeout(settleTimer.current);
      if (scrollTimeout.current) window.clearTimeout(scrollTimeout.current);
    },
    [],
  );

  const goTo = (v: number) => {
    const el = ref.current;
    if (!el) return;
    const index = indexOfValue(v);
    el.scrollTo({ top: offsetOf(index), behavior: "smooth" });
    onChange(v);
    navigator.vibrate?.(8);
  };

  return (
    <div
      className={`st-wh ${className}`}
      ref={ref}
      role="listbox"
      aria-label={ariaLabel}
      tabIndex={0}
      onScroll={onScroll}
    >
      {items.map((item) => (
        <div
          key={item.value}
          role="option"
          aria-selected={item.value === value}
          onClick={() => goTo(item.value)}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

type Props = {
  open: boolean;
  /** اسم السورة في عنوان الورقة. */
  surahName: string;
  /** الوقت المحفوظ فعليًا — 24h. */
  initialTime: string;
  onConfirm: (time24: string) => void;
  onCancel: () => void;
};

export default function TimePickerSheet({
  open,
  surahName,
  initialTime,
  onConfirm,
  onCancel,
}: Props) {
  const [hour12, setHour12] = useState(() => splitTime24(initialTime).hour12);
  const [minute, setMinute] = useState(() => splitTime24(initialTime).minute);
  const [period, setPeriod] = useState<0 | 1>(() => splitTime24(initialTime).period);

  const sheetRef = useRef<HTMLElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const grabRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);

  // قراءة القيمة الابتدائية من الوقت الحقيقي عند كل فتح.
  useEffect(() => {
    if (!open) return;
    const next = splitTime24(initialTime);
    setHour12(next.hour12);
    setMinute(next.minute);
    setPeriod(next.period);
  }, [open, initialTime]);

  useSheetDrag({
    enabled: open,
    handles: [grabRef, headRef],
    sheet: sheetRef,
    scrim: scrimRef,
    onDismiss: onCancel,
  });

  // Escape في المتصفح فقط.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  const time24 = joinTime24(hour12, minute, period);
  const preview = `تنبيه يومي عند ${hour12}:${String(minute).padStart(2, "0")} ${PERIODS[period]}`;

  return (
    <div className={`st-ov ${open ? "st-open" : ""}`} aria-hidden={!open}>
      <div className="st-scrim" ref={scrimRef} onClick={onCancel} />
      <section
        className="st-sheet"
        ref={sheetRef}
        role="dialog"
        aria-label="وقت التنبيه"
        aria-modal="true"
      >
        <div className="st-gb" ref={grabRef} aria-hidden="true" />
        <div className="st-th" ref={headRef}>
          <h2>{surahName}</h2>
          <p>{preview}</p>
        </div>
        <div className="st-wheels">
          <div className="st-band" aria-hidden="true" />
          <Wheel
            items={HOURS.map((h) => ({ value: h, label: String(h) }))}
            value={hour12}
            onChange={setHour12}
            ariaLabel="الساعة"
            open={open}
          />
          <span className="st-colon" aria-hidden="true">
            :
          </span>
          <Wheel
            items={MINUTES.map((m) => ({
              value: m,
              label: String(m).padStart(2, "0"),
            }))}
            value={minute}
            onChange={setMinute}
            ariaLabel="الدقائق"
            open={open}
          />
          <Wheel
            items={PERIODS.map((label, index) => ({ value: index, label }))}
            value={period}
            onChange={(v) => setPeriod(v === 1 ? 1 : 0)}
            ariaLabel="الفترة"
            className="st-period"
            open={open}
          />
        </div>
        <div className="st-acts">
          <button type="button" className="cut-crystal-capsule sk-rim h-[42px] text-[13px] font-bold text-[var(--sk-label)]" onClick={onCancel}>
            إلغاء
          </button>
          <button
            type="button"
            className="cut-crystal-capsule-gold sk-rim h-[42px] text-[13px] font-bold"
            onClick={() => onConfirm(time24)}
          >
            تم
          </button>
        </div>
      </section>
    </div>
  );
}
