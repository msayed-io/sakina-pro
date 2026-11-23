/**
 * LocationSheet — ورقة «تعديل الموقع» المشتركة (نسخة واحدة للمشروع كله).
 *
 * تُفتح بدالة واحدة openLocationSheet() من الرئيسية ومن الإعدادات، وتُركّب
 * مرة واحدة في App.tsx.
 *
 * ⚠️ الاختيار اليدوي **لا يُعاد بناؤه هنا**: صفّ «الموقع المحدد» يفتح
 * `MapLocationPicker` — الصفحة الحقيقية الموجودة في التطبيق منذ قبل، بخريطتها
 * وبحثها وتحويلها العكسي. هذه الورقة واجهة قرار فقط (مفتاح + اختيار + تطبيق).
 *
 * السلوك:
 *   • المفتاح يُقرأ من النظام الحقيقي عند الفتح ولا يُفترض.
 *   • تشغيل المفتاح يخفت صفّ الموقع ويحوّل نصه إلى «يُحدَّد من موقعك الحالي».
 *   • «تطبيق التعديل» معطّلة حتى تختلف الحالة، ولا تُطبّق إلا بنقرة صريحة.
 *   • الإغلاق بالدائرة أو الستارة أو السحب أو Back لا يحفظ.
 */
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, MapPin, Navigation, X } from "lucide-react";
import MapLocationPicker from "@/components/MapLocationPicker";
import { useSheetDrag } from "./hooks/useSheetDrag";

/** نتيجة اختيار من الصفحة الحقيقية. */
export type PickedLocation = { name: string; lat: number; lon: number };

type Props = {
  open: boolean;
  isAutoLocation: boolean;
  /** اسم الموقع المعتمد الفعلي كما يعرضه التطبيق. */
  locationLabel: string;
  currentLat: number;
  currentLon: number;
  /** يُستدعى عند «تطبيق التعديل» فقط. */
  onApply: (result: { auto: boolean; place?: PickedLocation }) => void;
  onClose: () => void;
};

export default function LocationSheet({
  open,
  isAutoLocation,
  locationLabel,
  currentLat,
  currentLon,
  onApply,
  onClose,
}: Props) {
  /* ── الحالة المؤقتة (لا تلمس النظام قبل «تطبيق التعديل») ─────────── */
  const [draftAuto, setDraftAuto] = useState(isAutoLocation);
  const [draftPlace, setDraftPlace] = useState<PickedLocation | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // إعادة الضبط عند كل فتح — من الحالة الحقيقية لا من ذكرى سابقة.
  useEffect(() => {
    if (!open) return;
    setDraftAuto(isAutoLocation);
    setDraftPlace(null);
    setPickerOpen(false);
  }, [open, isAutoLocation]);

  const sheetRef = useRef<HTMLElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const grabRef = useRef<HTMLDivElement | null>(null);
  const headRef = useRef<HTMLDivElement | null>(null);

  useSheetDrag({
    enabled: open && !pickerOpen,
    handles: [grabRef, headRef],
    sheet: sheetRef,
    scrim: scrimRef,
    onDismiss: onClose,
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      // في صفحة الخريطة: Escape يرجع للورقة (سلّم منطقي) لا يُغلق كل شيء.
      if (pickerOpen) setPickerOpen(false);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, pickerOpen]);

  /** الموقع المعروض: اختيار جديد ← وإلا الاسم الحقيقي الحالي. */
  const chosenLabel = draftPlace?.name ?? locationLabel;
  const dirty = draftAuto !== isAutoLocation || draftPlace !== null;

  return (
    <>
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
            {/* المفتاح: الوصف يتبدّل — عند التفعيل يظهر الموقع الحالي */}
            <div className="st-row">
              <div className="st-ic">
                <Navigation size={16} strokeWidth={2} className="rotate-45" />
              </div>
              <div className="st-tx">
                <div className="st-t">تحديد الموقع تلقائيًا</div>
                <div className="st-s">
                  {draftAuto ? chosenLabel : "لتحديث المواقيت والقبلة أينما كنت"}
                </div>
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

            {/* الصف: يفتح الصفحة الحقيقية للتحديد اليدوي */}
            <div
              className={`st-row st-lrow ${draftAuto ? "st-dis" : ""}`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!draftAuto) setPickerOpen(true);
              }}
              onKeyDown={(event) => {
                if (!draftAuto && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  setPickerOpen(true);
                }
              }}
            >
              <div className="st-ic">
                <MapPin size={16} strokeWidth={2} />
              </div>
              <div className="st-tx">
                <div className="st-t">الموقع المحدد</div>
                <div className="st-s">{chosenLabel}</div>
              </div>
              <div className="st-tr">
                <ChevronLeft size={16} strokeWidth={2} className="st-chev" />
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={!dirty}
            onClick={() =>
              onApply({ auto: draftAuto, place: draftPlace ?? undefined })
            }
            className="cut-crystal-capsule-gold sk-rim st-role-wide st-apply"
          >
            تطبيق التعديل
          </button>
        </section>
      </div>

      {/* ── الصفحة الحقيقية: تُركَّب فوق الورقة عند الحاجة فقط ── */}
      {pickerOpen && (
        <MapLocationPicker
          initialLat={draftPlace?.lat ?? currentLat}
          initialLon={draftPlace?.lon ?? currentLon}
          onSelect={(name, lat, lon) => {
            setDraftPlace({ name, lat, lon });
            setDraftAuto(false);
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
