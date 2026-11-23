/**
 * LocationSheet — ورقة «تعديل الموقع» المشتركة (نسخة واحدة للمشروع كله).
 *
 * تُفتح بدالة واحدة openLocationSheet() من أي شاشة، وتُركّب مرة واحدة في
 * App.tsx. حلّت محلّ البطاقة القديمة (ManualLocationDialog) التي حُذفت.
 *
 * مرحلتان داخل الورقة نفسها، بلغتها البصرية نفسها:
 *   ① الورقة الرئيسية: عنوان + مفتاح التحديد التلقائي + صفّ الموقع + تطبيق.
 *   ② خطوة اختيار الموقع: تُبدَّل محتويات الورقة بحركة هادئة، وتعود
 *      بدائرة رجوع. البحث والاختيار من قاعدة المدن الحقيقية (CITIES) —
 *      نفس مصدر بيانات التطبيق، بلا خريطة ولا طلب شبكة.
 *
 * السلوك المُثبت:
 *   • المفتاح يُقرأ من النظام الحقيقي عند الفتح ولا يُفترض.
 *   • تشغيل المفتاح يخفت صفّ الموقع ويحوّل نصه إلى «يُحدَّد من موقعك الحالي».
 *   • «تطبيق التعديل» معطّلة حتى تختلف الحالة، ولا تُطبّق إلا بنقرة صريحة.
 *   • الإغلاق بالدائرة أو الستارة أو السحب أو Back لا يحفظ.
 *   • أي اختيار مدينة يعيد الحالة إلى «يدوي» ويجعل «تطبيق التعديل» فعّالة.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  Navigation,
  Search,
  X,
} from "lucide-react";
import { CITIES, type CityData } from "@/lib/prayer-cities";
import { useSheetDrag } from "./hooks/useSheetDrag";

type Props = {
  open: boolean;
  isAutoLocation: boolean;
  /** اسم الموقع المعتمد الفعلي كما يعرضه التطبيق. */
  locationLabel: string;
  /** يُستدعى عند «تطبيق التعديل» فقط. */
  onApply: (result: { auto: boolean; city?: CityData }) => void;
  onClose: () => void;
};

type Step = "main" | "pick";

export default function LocationSheet({
  open,
  isAutoLocation,
  locationLabel,
  onApply,
  onClose,
}: Props) {
  /* ── الحالة المؤقتة (لا تلمس النظام قبل «تطبيق التعديل») ─────────── */
  const [step, setStep] = useState<Step>("main");
  const [draftAuto, setDraftAuto] = useState(isAutoLocation);
  const [draftCity, setDraftCity] = useState<CityData | null>(null);
  const [query, setQuery] = useState("");

  // إعادة الضبط عند كل فتح — من الحالة الحقيقية لا من ذكرى سابقة.
  useEffect(() => {
    if (!open) return;
    setDraftAuto(isAutoLocation);
    setDraftCity(null);
    setQuery("");
    setStep("main");
  }, [open, isAutoLocation]);

  const sheetRef = useRef<HTMLElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const grabRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);

  useSheetDrag({
    enabled: open,
    handles: [grabRef, headRef],
    sheet: sheetRef,
    scrim: scrimRef,
    onDismiss: onClose,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // في خطوة الاختيار: Escape يعود للورقة الرئيسية (سلّم المنطقي).
      if (step === "pick") setStep("main");
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, step]);

  /* ── نتائج البحث من قاعدة المدن الحقيقية ─────────────────────────── */
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return CITIES.slice(0, 12);
    return CITIES.filter(
      (city) => city.nameAr.includes(q) || city.countryAr.includes(q),
    ).slice(0, 20);
  }, [query]);

  const chosenLabel = draftCity
    ? `${draftCity.nameAr}، ${draftCity.countryAr}`
    : locationLabel;

  const dirty = draftAuto !== isAutoLocation || draftCity !== null;

  const apply = () => {
    if (!dirty) return;
    onApply({ auto: draftAuto, city: draftCity ?? undefined });
  };

  return (
    <div className={`st-ov ${open ? "st-open" : ""}`} aria-hidden={!open}>
      <div className="st-scrim" ref={scrimRef} onClick={onClose} />
      <section
        className="st-sheet"
        ref={sheetRef}
        role="dialog"
        aria-label="تعديل الموقع"
        aria-modal="true"
      >
        <div className="st-gb" ref={grabRef} aria-hidden="true" />

        {/* ── المرحلة ①: الورقة الرئيسية ─────────────────────────── */}
        <div className={`st-step ${step === "main" ? "st-step-on" : ""}`} aria-hidden={step !== "main"}>
          <div className="st-lh" ref={headRef}>
            <h2 className="cut-crystal-capsule sk-rim st-sheet-title">
              تعديل الموقع
            </h2>
            <button
              type="button"
              className="cut-crystal-capsule sk-rim st-role-circle"
              aria-label="إغلاق"
              onClick={onClose}
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="st-grp cut-crystal-panel">
            <div className="st-row">
              <div className="st-ic">
                <Navigation fill="currentColor" size={16} className="rotate-45" />
              </div>
              <div className="st-tx">
                <div className="st-t">تحديد الموقع تلقائيًا</div>
                <div className="st-s">لتحديث المواقيت والقبلة أينما كنت</div>
              </div>
              <div className="st-tr">
                <button
                  type="button"
                  className="st-sw"
                  role="switch"
                  aria-checked={draftAuto}
                  aria-label="تحديد الموقع تلقائيًا"
                  onClick={() => setDraftAuto((v) => !v)}
                />
              </div>
            </div>

            <div
              className={`st-row st-lrow ${draftAuto ? "st-dis" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!draftAuto) setStep("pick");
              }}
              onKeyDown={(event) => {
                if (!draftAuto && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setStep("pick");
                }
              }}
            >
              <div className="st-ic">
                <MapPin fill="currentColor" size={16} />
              </div>
              <div className="st-tx">
                <div className="st-t">الموقع المحدد</div>
                <div className="st-s">
                  {draftAuto ? "يُحدَّد من موقعك الحالي" : chosenLabel}
                </div>
              </div>
              <div className="st-tr">
                <ChevronLeft size={16} strokeWidth={2.4} className="st-chev" />
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!dirty}
            onClick={apply}
            className="cut-crystal-capsule-gold sk-rim st-role-wide st-apply"
          >
            تطبيق التعديل
          </button>
        </div>

        {/* ── المرحلة ②: اختيار الموقع داخل الورقة ───────────────── */}
        <div className={`st-step ${step === "pick" ? "st-step-on" : ""}`} aria-hidden={step !== "pick"}>
          <div className="st-lh">
            <h2 className="cut-crystal-capsule sk-rim st-sheet-title">
              اختر الموقع
            </h2>
            <button
              type="button"
              className="cut-crystal-capsule sk-rim st-role-circle"
              aria-label="رجوع"
              onClick={() => setStep("main")}
            >
              <ChevronRight size={18} strokeWidth={2.4} />
            </button>
          </div>

          {/* حقل البحث بنمط كبسولة التطبيق الحالية */}
          <label className="cut-crystal-capsule sk-rim st-search">
            <Search fill="currentColor" size={15} className="st-search-ic" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث عن مدينة"
              aria-label="ابحث عن مدينة"
              autoComplete="off"
            />
          </label>

          <div className="st-results cut-crystal-panel">
            {results.length === 0 && (
              <p className="st-note">لا توجد مدينة بهذا الاسم.</p>
            )}
            {results.map((city) => {
              const selected =
                draftCity?.nameAr === city.nameAr &&
                draftCity?.countryAr === city.countryAr;
              return (
                <button
                  key={`${city.nameAr}-${city.countryAr}`}
                  type="button"
                  className={`st-row st-result ${selected ? "st-result-on" : ""}`}
                  onClick={() => {
                    setDraftCity(city);
                    setDraftAuto(false);
                    setStep("main");
                  }}
                >
                  <div className="st-ic">
                    <MapPin fill="currentColor" size={15} />
                  </div>
                  <div className="st-tx">
                    <div className="st-t">{city.nameAr}</div>
                    <div className="st-s">{city.countryAr}</div>
                  </div>
                  {selected && (
                    <div className="st-tr">
                      <span className="st-check" aria-hidden="true">
                        ✓
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
