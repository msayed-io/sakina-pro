import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { AsmaName } from "@/data/asmaAlHusnaData";
import "./namesSheet.css";

/* ═══════════════════════════════════════════════════════════════════════════
   NamesSheet — نافذة «تفاصيل الاسم» منقولة حرفيًا من names-of-allah.html
   ---------------------------------------------------------------------------
   • التصميم والحركة والتوقيتات كما في المرجع (لا رقم واحد تغيّر).
   • البيانات من asmaAlHusnaData الحقيقية، والمفضلة من مخزن الشاشة نفسه.
   • الخطوط: الخطوط المحلية الرسمية للتطبيق (Thmanyah Serif Display لنص الاسم،
     Thmanyah Serif Text 500 للدليل، Thmanyah Sans للواجهة) — لا خط خارجي.
   • العزل: جذر واحد + بادئة ns- + بوابة على body (لا تسرّب أي قاعدة).
   • التدرجان = تدرج التطبيق الأصلي (.progressive-blur كما هو).
   • الحواف اللامعة = محرك التطبيق (.sk-rim) على الكبسولات الخمس فقط.
   ═══════════════════════════════════════════════════════════════════════════ */

export const NAMES_SHEET_BACKDROP_ID = "ns-asma-backdrop";

const DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** تحويل يدوي للأرقام الهندية — نفس دالة المرجع (بلا toLocaleString). */
const ar = (value: string | number): string =>
  String(value).replace(/\d/g, (d) => DIGITS[Number(d)]);

/** فصل نص الدليل عن مرجعه: «﴿…﴾ [طه: 5]» ⇒ {text, reference}. */
function splitEvidence(proof: string): { text: string; reference: string } {
  const raw = (proof ?? "").trim();
  if (!raw) return { text: "", reference: "" };
  const match = raw.match(/^(.*?)\s*[[(]([^\])]*)[\])]\s*$/s);
  if (match && match[2].trim()) {
    return { text: match[1].trim(), reference: ar(match[2].trim()) };
  }
  return { text: raw, reference: "" };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export type NamesSheetProps = {
  names: AsmaName[];
  /** فهرس الاسم المفتوح، أو null إن كانت النافذة مغلقة. */
  index: number | null;
  onClose: () => void;
  isFavorite: (id: number) => boolean;
  onToggleFavorite: (id: number) => void;
  /** معرّف حاوية شاشة الأسماء لتفعيل inert عليها أثناء الفتح. */
  backdropId: string;
};

type Phase = "idle" | "out" | "pre";

export default function NamesSheet({
  names,
  index,
  onClose,
  isFavorite,
  onToggleFavorite,
  backdropId,
}: NamesSheetProps) {
  const open = index !== null;

  const [viewIndex, setViewIndex] = useState(index ?? 0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [direction, setDirection] = useState(1);

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const scrimRef = useRef<HTMLDivElement | null>(null);
  const grabRef = useRef<HTMLDivElement | null>(null);
  const topbarRef = useRef<HTMLElement | null>(null);

  const busyRef = useRef(false);
  const pendingRef = useRef(0);
  const openerRef = useRef<Element | null>(null);
  const kbdRef = useRef(false);

  /* مراجع حيّة: تجعل go مستقرة فلا تُعاد مستمعات الوثيقة مع كل رندرة */
  const viewIndexRef = useRef(viewIndex);
  viewIndexRef.current = viewIndex;
  const namesRef = useRef(names);
  namesRef.current = names;

  /* ── الانتقال بين الأسماء: نفس أرقام المرجع (150ms + إطاران + 140ms) ── */
  const go = useCallback((delta: number) => {
    const target = viewIndexRef.current + delta;
    if (target < 0 || target >= namesRef.current.length) return;
    if (busyRef.current) {
      pendingRef.current = delta;
      return;
    }
    busyRef.current = true;
    setDirection(delta);
    setPhase("out");

    void (async () => {
      await wait(150);
      viewIndexRef.current = target;
      setViewIndex(target);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
      setPhase("pre");
      await nextFrame();
      await nextFrame();
      setPhase("idle");
      await wait(140);
      busyRef.current = false;
      const pending = pendingRef.current;
      if (pending) {
        pendingRef.current = 0;
        goRef.current(pending);
      }
    })();
  }, []);

  const goRef = useRef(go);
  goRef.current = go;

  /* ── تهيئة المحتوى عند كل فتح ── */
  useEffect(() => {
    if (index === null) return;
    viewIndexRef.current = index;
    setViewIndex(index);
    setPhase("idle");
    busyRef.current = false;
    pendingRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [index]);

  /* ── الفتح/الإغلاق: inert + الفوكس + العودة للعنصر المُشغِّل ── */
  useEffect(() => {
    const backdrop = document.getElementById(backdropId);
    if (open) {
      openerRef.current = document.activeElement;
      if (backdrop) backdrop.setAttribute("inert", "");
      const sheet = sheetRef.current;
      if (sheet) {
        sheet.removeAttribute("inert");
        sheet.focus({ preventScroll: true });
      }
    } else {
      if (backdrop) backdrop.removeAttribute("inert");
      if (sheetRef.current) sheetRef.current.setAttribute("inert", "");
      const opener = openerRef.current as HTMLElement | null;
      if (kbdRef.current && opener && typeof opener.focus === "function") {
        opener.focus({ preventScroll: true });
      }
    }
  }, [open, backdropId]);

  /* ── مستمعات الوثيقة: تُسجَّل أثناء الفتح فقط وتُزال عند الإغلاق ── */
  useEffect(() => {
    if (!open) return;

    const trackKeyboard = () => {
      kbdRef.current = true;
    };
    const trackPointer = () => {
      kbdRef.current = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      // RTL: السهم الأيسر ⇒ التالي، والأيمن ⇒ السابق (كما في المرجع)
      if (event.key === "ArrowLeft") goRef.current(1);
      if (event.key === "ArrowRight") goRef.current(-1);
    };

    window.addEventListener("keydown", trackKeyboard, true);
    window.addEventListener("pointerdown", trackPointer, true);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", trackKeyboard, true);
      window.removeEventListener("pointerdown", trackPointer, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  /* ── زر Back في أندرويد: مستمع واحد أثناء الفتح فقط ── */
  useEffect(() => {
    if (!open || !Capacitor.isNativePlatform()) return;
    let handle: { remove: () => void } | null = null;
    let disposed = false;

    void CapacitorApp.addListener("backButton", () => {
      onClose();
    }).then((listener) => {
      if (disposed) listener.remove();
      else handle = listener;
    });

    return () => {
      disposed = true;
      handle?.remove();
    };
  }, [open, onClose]);

  /* ── السحب لإغلاق (المقبض + الشريط العلوي) ── */
  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const scrim = scrimRef.current;
    const handles = [grabRef.current, topbarRef.current].filter(
      (element): element is HTMLElement => !!element,
    );
    if (!sheet || !scrim || handles.length === 0) return;

    let startY: number | null = null;
    let dy = 0;
    let startedAt = 0;

    const dragStart = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("button")) return;
      startY = event.clientY;
      dy = 0;
      startedAt = performance.now();
      sheet.classList.add("ns-drag");
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    };
    const dragMove = (event: PointerEvent) => {
      if (startY === null) return;
      const offset = event.clientY - startY;
      dy = offset > 0 ? offset : offset * 0.15;
      sheet.style.transform = `translateY(${dy}px)`;
      scrim.style.opacity = String(
        Math.max(0, 1 - (dy / sheet.offsetHeight) * 1.2),
      );
    };
    const dragEnd = () => {
      if (startY === null) return;
      const velocity = dy / Math.max(1, performance.now() - startedAt);
      startY = null;
      sheet.classList.remove("ns-drag");
      sheet.style.transform = "";
      scrim.style.opacity = "";
      if (dy > 110 || velocity > 0.6) onClose();
    };

    handles.forEach((element) => {
      element.addEventListener("pointerdown", dragStart);
      element.addEventListener("pointermove", dragMove);
      element.addEventListener("pointerup", dragEnd);
      element.addEventListener("pointercancel", dragEnd);
    });

    return () => {
      handles.forEach((element) => {
        element.removeEventListener("pointerdown", dragStart);
        element.removeEventListener("pointermove", dragMove);
        element.removeEventListener("pointerup", dragEnd);
        element.removeEventListener("pointercancel", dragEnd);
      });
    };
  }, [open, onClose]);

  /* ── التمرير الأفقي للتنقل ── */
  useEffect(() => {
    if (!open) return;
    const scroll = scrollRef.current;
    if (!scroll) return;
    let startX: number | null = null;
    let startY = 0;

    const down = (event: PointerEvent) => {
      startX = event.clientX;
      startY = event.clientY;
    };
    const cancel = () => {
      startX = null;
    };
    const up = (event: PointerEvent) => {
      if (startX === null) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      startX = null;
      if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.6) {
        goRef.current(dx < 0 ? 1 : -1);
      }
    };

    scroll.addEventListener("pointerdown", down);
    scroll.addEventListener("pointercancel", cancel);
    scroll.addEventListener("pointerup", up);
    return () => {
      scroll.removeEventListener("pointerdown", down);
      scroll.removeEventListener("pointercancel", cancel);
      scroll.removeEventListener("pointerup", up);
    };
  }, [open]);

  const name = names[viewIndex];
  const total = names.length;
  const evidence = useMemo(
    () => splitEvidence(name?.proof ?? ""),
    [name?.proof],
  );

  if (!open || !name) return null;

  const hasMeaning = !!name.meaningDetail?.trim();
  const hasEvidence = !!evidence.text;
  const hasWorship = !!name.reflection?.trim();
  const favOn = isFavorite(name.id);
  const RIM = "sk-rim";

  const node = (
    <div className="ns-root" data-open="1" dir="rtl">
      <div className="ns-scrim" ref={scrimRef} onClick={onClose} />

      <section
        className="ns-sheet"
        ref={sheetRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="تفاصيل الاسم"
      >
        <div className="ns-grab" ref={grabRef} aria-hidden="true">
          <i />
        </div>

        <div className="ns-scroll" ref={scrollRef}>
          <div
            className={`ns-content${phase === "out" ? " ns-out" : ""}${
              phase === "pre" ? " ns-pre" : ""
            }`}
            style={{ "--s": direction } as React.CSSProperties}
          >
            <section
              className="ns-namecard"
              style={{ "--k": 0 } as React.CSSProperties}
            >
              <h2>{name.name}</h2>
            </section>

            {hasMeaning && (
              <>
                <h3 className="ns-sh" style={{ "--k": 1 } as React.CSSProperties}>
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5M12 7.8v.1" />
                  </svg>
                  المعنى والبيان التفصيلي
                </h3>
                <div className="ns-card" style={{ "--k": 2 } as React.CSSProperties}>
                  <p>{name.meaningDetail}</p>
                </div>
              </>
            )}

            {hasEvidence && (
              <>
                <h3 className="ns-sh" style={{ "--k": 3 } as React.CSSProperties}>
                  <svg viewBox="0 0 24 24">
                    <path d="M10 7H7a2 2 0 0 0-2 2v3h4v5H5M19 7h-3a2 2 0 0 0-2 2v3h4v5h-4" />
                  </svg>
                  الدليل والأثر من القرآن والسنة
                </h3>
                <div
                  className="ns-card ns-ev"
                  style={{ "--k": 4 } as React.CSSProperties}
                >
                  <p>{evidence.text}</p>
                  {evidence.reference && <small>{evidence.reference}</small>}
                </div>
              </>
            )}

            {hasWorship && (
              <>
                <h3 className="ns-sh" style={{ "--k": 5 } as React.CSSProperties}>
                  <svg viewBox="0 0 24 24">
                    <path d="M12 6.5C10.5 5.3 8.5 4.8 5 5v13c3.5-.2 5.5.3 7 1.5 1.5-1.2 3.5-1.7 7-1.5V5c-3.5-.2-5.5.3-7 1.5zM12 6.5v13" />
                  </svg>
                  كيف نتعبد ونعمل بهذا الاسم؟
                </h3>
                <div className="ns-card" style={{ "--k": 6 } as React.CSSProperties}>
                  <p>{name.reflection}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* تدرج التطبيق الأصلي — نفس الأصناف والقواعد، مثبّتة داخل النافذة */}
        <div className="progressive-blur" aria-hidden="true">
          <i />
          <i />
        </div>

        <header className="ns-topbar" ref={topbarRef}>
          <button
            type="button"
            className={`ns-glass ns-circle ${RIM}`}
            aria-label="إغلاق"
            onClick={onClose}
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <div className="ns-end">
            <span className={`ns-glass ns-cap ${RIM}`} aria-live="polite">
              <span>
                {ar(viewIndex + 1)} من {ar(total)}
              </span>
            </span>
            <button
              type="button"
              className={`ns-glass ns-circle ns-fav ${RIM}`}
              aria-label={favOn ? "إزالة من المفضلة" : "إضافة للمفضلة"}
              aria-pressed={favOn}
              data-on={favOn ? "1" : "0"}
              onClick={() => onToggleFavorite(name.id)}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" />
              </svg>
            </button>
          </div>
        </header>

        <div
          className="progressive-blur progressive-blur-bottom"
          aria-hidden="true"
        >
          <i />
          <i />
        </div>

        <nav className="ns-botbar">
          <button
            type="button"
            className={`ns-glass ns-cap ns-nav ${RIM}`}
            disabled={viewIndex === 0}
            onClick={() => go(-1)}
          >
            <svg viewBox="0 0 24 24">
              <path d="M9 6l6 6-6 6" />
            </svg>
            الاسم السابق
          </button>
          <button
            type="button"
            className={`ns-glass ns-cap ns-nav ${RIM}`}
            disabled={viewIndex === total - 1}
            onClick={() => go(1)}
          >
            الاسم التالي
            <svg viewBox="0 0 24 24">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
        </nav>
      </section>
    </div>
  );

  return createPortal(node, document.body);
}
