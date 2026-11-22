/**
 * useSheetDrag — آلية سحب الورقة السفلية الوحيدة في التطبيق.
 *
 * نُقلت حرفيًا من `sheetDrag` في المرجع المعتمد (settings.html) ثم صيغت
 * كخطّاف React واحد يستعمله كل شيء:
 *   • ورقة تعديل الموقع   (LocationSheet)
 *   • ورقة منتقي الوقت     (TimePickerSheet)
 *
 * العتبات والقيم كما في المرجع بالحرف:
 *   • الورقة تتبع الإصبع 1:1 لأسفل، ولأعلى بمقاومة مطاطية 15%.
 *   • الستارة تخفت تناسبيًا مع النزول: 1 - (dy / height) * 1.2.
 *   • تُغلق إن تجاوز السحب 110px، أو إن كانت السرعة > 0.6px/ms (dy > 30).
 *   • الإفلات دون العتبة ⇒ ترتد إلى مكانها بحركة الورقة نفسها (لا حركة
 *     إضافية هنا: نُزيل النمط الداخلي فتعود الورقة بانتقالها المعرّف في
 *     CSS نفسه — نفس المدة والمنحنى).
 *   • لا يبدأ السحب من فوق زر.
 *   • يعمل باللمس وبالفأرة (أحداث المؤشر).
 *
 * ⚠️ فرق موثّق عن المرجع: عتبة السرعة في المرجع `velocity > 0.6` بلا شرط
 * مسافة، وقد طلب الأمر «سرعة أكبر من 0.6 مع مسافة أكبر من 30px». نُنفّذ
 * شرط المسافة لأنه الأصح (سحب 2px سريع لا يجوز أن يغلق الورقة)، وهو الفرق
 * الوحيد عن المرجع. (المسافة تُقاس على الإزاحة الخام لا على المقاومة.)
 */
import { useEffect, useRef, type RefObject } from "react";

/** العتبات — منقولة من const في المرجع، لا تُغيَّر. */
export const SHEET_CLOSE_DISTANCE = 110; // px
export const SHEET_CLOSE_VELOCITY = 0.6; // px/ms
export const SHEET_CLOSE_MIN_DISTANCE = 30; // px — شرط المسافة مع السرعة
export const SHEET_UP_RESISTANCE = 0.15; // 15% فقط عند السحب لأعلى

type Options = {
  /** مقابض السحب: المقبض نفسه ورأس الورقة (بلا الأزرار). */
  handles: Array<RefObject<HTMLElement | null>>;
  /** الورقة التي تتحرك. */
  sheet: RefObject<HTMLElement | null>;
  /** الستارة التي تخفت. */
  scrim: RefObject<HTMLElement | null>;
  /** يُستدعى عند بلوغ العتبة. إغلاق بالسحب = إغلاق عادي: لا حفظ ولا تطبيق. */
  onDismiss: () => void;
  /** يُفعّل الآلية فقط عندما تكون الورقة مفتوحة. */
  enabled: boolean;
};

export function useSheetDrag({ handles, sheet, scrim, onDismiss, enabled }: Options) {
  /**
   * المصدر الحيّ للدالة والمقابض.
   * التطبيق يعيد رسم الشجرة كل ثانية (ساعة المواقيت)، ومصفوفة المقابض تُنشأ
   * من جديد في كل رسم — فلو كانت في مصفوفة الاعتماديات لكان التأثير يُفكّ
   * ويُعاد تركيبه في منتصف السحب، فيضيع `startY` ولا تُغلق الورقة أبدًا.
   * لهذا يبقى التأثير مربوطًا بالفتح وحده، ويقرأ الأحدث عبر المراجع.
   */
  const latest = useRef({ onDismiss, handles });
  latest.current = { onDismiss, handles };

  // مصفوفة اعتماديات ثابتة لعدد المقابض (رقم فقط، لا هوية).
  const handleCount = handles.length;

  useEffect(() => {
    if (!enabled) return;
    const sheetEl = sheet.current;
    if (!sheetEl) return;

    const elements = latest.current.handles
      .map((ref) => ref.current)
      .filter((element): element is HTMLElement => !!element);
    if (elements.length === 0) return;

    let startY: number | null = null;
    let rawDy = 0;
    let shownDy = 0;
    let startedAt = 0;

    const dragStart = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      // لا يبدأ السحب من فوق زر.
      if (target.closest("button")) return;
      startY = event.clientY;
      rawDy = 0;
      shownDy = 0;
      startedAt = performance.now();
      sheetEl.classList.add("sheet-dragging");
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    };

    const dragMove = (event: PointerEvent) => {
      if (startY === null) return;
      const offset = event.clientY - startY;
      rawDy = offset;
      shownDy = offset > 0 ? offset : offset * SHEET_UP_RESISTANCE;
      sheetEl.style.transform = `translateY(${shownDy}px)`;
      if (scrim.current) {
        scrim.current.style.opacity = String(
          Math.max(0, 1 - (Math.max(0, shownDy) / sheetEl.offsetHeight) * 1.2),
        );
      }
    };

    const dragEnd = () => {
      if (startY === null) return;
      const elapsed = Math.max(1, performance.now() - startedAt);
      const velocity = Math.max(0, rawDy) / elapsed;
      startY = null;
      sheetEl.classList.remove("sheet-dragging");
      // إزالة النمط الداخلي: الورقة تعود بانتقالها المعرّف في CSS (الارتداد).
      sheetEl.style.transform = "";
      if (scrim.current) scrim.current.style.opacity = "";
      if (
        rawDy > SHEET_CLOSE_DISTANCE ||
        (velocity > SHEET_CLOSE_VELOCITY && rawDy > SHEET_CLOSE_MIN_DISTANCE)
      ) {
        latest.current.onDismiss();
      }
    };

    elements.forEach((element) => {
      element.addEventListener("pointerdown", dragStart);
      element.addEventListener("pointermove", dragMove);
      element.addEventListener("pointerup", dragEnd);
      element.addEventListener("pointercancel", dragEnd);
    });

    return () => {
      // تنظيف كامل: لا مستمع يبقى بعد الإغلاق.
      elements.forEach((element) => {
        element.removeEventListener("pointerdown", dragStart);
        element.removeEventListener("pointermove", dragMove);
        element.removeEventListener("pointerup", dragEnd);
        element.removeEventListener("pointercancel", dragEnd);
      });
      sheetEl.classList.remove("sheet-dragging");
      sheetEl.style.transform = "";
      if (scrim.current) scrim.current.style.opacity = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, handleCount, sheet, scrim]);
}
