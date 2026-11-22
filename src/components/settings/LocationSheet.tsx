/**
 * LocationSheet — ورقة «تعديل الموقع» المشتركة (نسخة واحدة للمشروع كله).
 *
 * تُفتح بدالة واحدة openLocationSheet() من أي شاشة، وتُركّب مرة واحدة في
 * App.tsx. تحلّ محلّ البطاقة القديمة (ManualLocationDialog) في كل موضع ظهور.
 *
 * البنية والسلوك من المرجع بالحرف:
 *   • صف علوي: كبسولة العنوان «تعديل الموقع» + دائرة الإغلاق.
 *   • بطاقة بصفّين: «تحديد الموقع تلقائيًا» بمفتاحه، و«الموقع المحدد».
 *   • كبسولة «تطبيق التعديل» بعرض الورقة، معطّلة حتى تختلف الحالة.
 *   • المفتاح يُقرأ من النظام الحقيقي عند الفتح ولا يُفترض.
 *   • تشغيل المفتاح يخفت صف الموقع ويحوّل نصه إلى «يُحدَّد من موقعك الحالي».
 *   • الإغلاق بالدائرة أو الستارة أو السحب أو Back لا يحفظ.
 *   • «تطبيق التعديل» وحدها تثبّت وتحدّث الشاشة المضيفة.
 *
 * اختيار المدينة/الخريطة: يُترك للنظام الحقيقي الموجود (ManualLocationDialog
 * بمساريه) — لا واجهة بحث جديدة.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, MapPin, Navigation, X } from "lucide-react";
import { useSheetDrag } from "./hooks/useSheetDrag";

type Props = {
  open: boolean;
  isAutoLocation: boolean;
  /** اسم الموقع المعتمد الفعلي كما يعرضه التطبيق. */
  locationLabel: string;
  /** يُستدعى عند «تطبيق التعديل» فقط. */
  onApply: (auto: boolean) => void;
  onClose: () => void;
  /** يفتح مسار اختيار الموقع الحقيقي (الخريطة/المدينة). */
  onPickLocation: () => void;
};

export default function LocationSheet({
  open,
  isAutoLocation,
  locationLabel,
  onApply,
  onClose,
  onPickLocation,
}: Props) {
  // حالة مؤقتة: لا تلمس النظام قبل «تطبيق التعديل».
  const [draftAuto, setDraftAuto] = useState(isAutoLocation);

  useEffect(() => {
    if (open) setDraftAuto(isAutoLocation);
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
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const dirty = draftAuto !== isAutoLocation;

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
        <div className="st-lh" ref={headRef}>
          <h2 className="cut-crystal-capsule sk-rim h-[36px] px-[18px] text-[14px] font-bold flex items-center text-[var(--sk-label)]">
            تعديل الموقع
          </h2>
          <button
            type="button"
            className="cut-crystal-capsule sk-rim w-9 h-9 rounded-full flex items-center justify-center text-[var(--sk-label)]"
            aria-label="إغلاق"
            onClick={onClose}
          >
            <X size={16} strokeWidth={1.9} />
          </button>
        </div>

        <div className="st-grp">
          <div className="st-row">
            <div className="st-ic">
              <Navigation size={16} strokeWidth={1.7} className="rotate-45" />
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
              if (!draftAuto) onPickLocation();
            }}
            onKeyDown={(event) => {
              if (!draftAuto && (event.key === "Enter" || event.key === " ")) {
                event.preventDefault();
                onPickLocation();
              }
            }}
          >
            <div className="st-ic">
              <MapPin size={16} strokeWidth={1.7} />
            </div>
            <div className="st-tx">
              <div className="st-t">الموقع المحدد</div>
              <div className="st-s">
                {draftAuto ? "يُحدَّد من موقعك الحالي" : locationLabel}
              </div>
            </div>
            <div className="st-tr">
              <ChevronLeft size={16} strokeWidth={1.8} className="st-chev" />
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!dirty}
          onClick={() => onApply(draftAuto)}
          className="cut-crystal-capsule-gold sk-rim w-full h-11 mt-4 text-[13.5px] font-bold disabled:opacity-40 disabled:pointer-events-none"
        >
          تطبيق التعديل
        </button>
      </section>
    </div>
  );
}
