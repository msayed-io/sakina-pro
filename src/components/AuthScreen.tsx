import { useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { User } from "@supabase/supabase-js";
import { ArrowRight } from "lucide-react";
import {
  signInWithGoogle,
} from "@/services/auth-service";
import { trackAndroidUsageSignal } from "@/services/android-usage-signals";
import "./AuthScreen.css";

type LegalView = "terms" | "privacy";

interface AuthScreenProps {
  onBack?: () => void;
  onAuthenticated?: (user: User) => void;
  nativeCallbackError?: string | null;
  onClearNativeCallbackError?: () => void;
}

function authErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "تعذر تسجيل الدخول. حاول مرة أخرى.";
  if (normalized.includes("rate limit")) return "تم تجاوز عدد المحاولات المسموح بها مؤقتًا. حاول بعد قليل.";
  if (normalized.includes("supabase")) return "إعداد المصادقة غير مكتمل. راجع إعدادات الاتصال ثم حاول مرة أخرى.";
  return "تعذر إتمام العملية الآن. حاول مرة أخرى.";
}

/* ------------------------------------------------------------------ */
/* Hero chat demo — the attached design's conversation, played verbatim: */
/* same three Q/A pairs, same timings/easings, looped. The loop and its  */
/* timers are fully cancelled when the page unmounts.                    */
/* ------------------------------------------------------------------ */

const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ["ما معنى الطمأنينة؟", "قال تعالى: ﴿أَلَا بِذِكْرِ ٱللَّهِ تَطْمَئِنُّ ٱلْقُلُوبُ﴾ (الرعد: 28)"],
  ["ماذا أقول قبل النوم؟", "اقرأ آية الكرسي؛ ففي صحيح البخاري أن الله يجعل عليك حافظًا حتى تصبح."],
  ["ما فضل الصلاة على النبي ﷺ؟", "في صحيح مسلم: من صلى عليّ صلاة صلى الله عليه بها عشرًا."],
];

const SPARK_SVG =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18 15v4M16 17h4"/></svg>';

function useChatDemo(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const chat = ref.current;
    if (!chat) return;

    let cancelled = false;
    const timers = new Set<number>();
    const sleep = (ms: number) =>
      new Promise<void>((resolve) => {
        const id = window.setTimeout(() => {
          timers.delete(id);
          resolve();
        }, ms);
        timers.add(id);
      });

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const SPR = "cubic-bezier(.2,1.25,.35,1)";
    const EASE = "cubic-bezier(.25,.8,.25,1)";

    const play = async ([q, a]: readonly [string, string]) => {
      chat.innerHTML =
        '<div class="sa-row sa-row-u"><div class="sa-b sa-user"></div></div>' +
        '<div class="sa-row sa-row-a"><div class="sa-wrap"><div class="sa-b sa-ai">' +
        '<span class="sa-dots"><i></i><i></i><i></i></span><span class="sa-t"></span></div>' +
        `<div class="sa-av">${SPARK_SVG}</div></div></div>`;

      const rowU = chat.children[0] as HTMLElement;
      const rowA = chat.children[1] as HTMLElement;
      const ub = rowU.firstElementChild as HTMLElement;
      const wrap = rowA.firstElementChild as HTMLElement;
      const ab = wrap.firstElementChild as HTMLElement;
      const t = ab.querySelector(".sa-t") as HTMLElement;
      const dots = ab.querySelector(".sa-dots") as HTMLElement;
      const av = wrap.querySelector(".sa-av") as HTMLElement;

      ub.textContent = q;
      const ws = a.split(" ").map((x, i, l) => {
        const s = document.createElement("span");
        s.className = "sa-w";
        s.textContent = x;
        t.append(s);
        if (i < l.length - 1) t.append(" ");
        return s;
      });

      const cs = getComputedStyle(chat);
      const px = parseFloat(cs.getPropertyValue("--px")) || 0;
      const py = parseFloat(cs.getPropertyValue("--py")) || 0;
      const r = t.getBoundingClientRect();
      const W = Math.ceil(r.width) + px * 2;
      const H = Math.ceil(r.height) + py * 2;
      const dw = ab.offsetWidth;
      const dh = ab.offsetHeight;

      if (still) {
        ab.style.width = `${W}px`;
        ab.style.height = `${H}px`;
        dots.remove();
        return;
      }
      t.style.visibility = "hidden";

      const pop = (el: HTMLElement, delay: number) =>
        el.animate(
          [
            { opacity: 0, transform: "translateY(18px) scale(.84)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 640, delay, easing: SPR, fill: "both" }
        );
      pop(ub, 0);
      pop(ab, 800);
      av.animate(
        [
          { opacity: 0, transform: "scale(.3) rotate(-60deg)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 640, delay: 900, easing: SPR, fill: "both" }
      );

      await sleep(1700);
      if (cancelled) return;
      av.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.15)" }, { transform: "scale(1)" }],
        { duration: 900, iterations: 2, easing: "ease-in-out" }
      );
      await sleep(1800);
      if (cancelled) return;
      dots.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      ab.animate(
        [
          { width: `${dw}px`, height: `${dh}px` },
          { width: `${W}px`, height: `${H}px` },
        ],
        { duration: 560, easing: SPR, fill: "both" }
      );
      t.style.visibility = "visible";
      ws.forEach((w, i) =>
        w.animate(
          [
            { opacity: 0, filter: "blur(5px)", transform: "translateY(5px)" },
            { opacity: 1, filter: "blur(0)", transform: "none" },
          ],
          { duration: 440, delay: 240 + i * 55, easing: EASE, fill: "both" }
        )
      );

      await sleep(240 + ws.length * 55 + 440 + 3400);
      if (cancelled) return;
      await Promise.allSettled(
        [rowU, rowA].map((x) =>
          x.animate(
            [
              { opacity: 1, transform: "none" },
              { opacity: 0, transform: "translateY(-10px) scale(.97)" },
            ],
            { duration: 420, easing: "ease-in", fill: "forwards" }
          ).finished
        )
      );
    };

    void (async () => {
      try {
        await document.fonts.ready;
      } catch {
        /* fonts API unavailable — proceed anyway */
      }
      await sleep(350);
      for (let i = 0; !cancelled; i++) {
        await play(PAIRS[i % PAIRS.length]);
        if (still || cancelled) break;
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      timers.clear();
      chat.replaceChildren();
    };
  }, [ref]);
}

export default function AuthScreen({
  onBack,
  onAuthenticated,
  nativeCallbackError,
  onClearNativeCallbackError,
}: AuthScreenProps) {
  const [legalView, setLegalView] = useState<LegalView | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const chatRef = useRef<HTMLDivElement | null>(null);
  useChatDemo(chatRef);

  useEffect(() => {
    if (!nativeCallbackError) return;
    setError(nativeCallbackError);
    setGoogleLoading(false);
  }, [nativeCallbackError]);

  useEffect(() => {
    if (!googleLoading || !Capacitor.isNativePlatform()) return;
    const listenerPromise = CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) setGoogleLoading(false);
    });
    return () => {
      void listenerPromise.then((listener) => listener.remove());
    };
  }, [googleLoading]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError("");
    onClearNativeCallbackError?.();
    try {
      await signInWithGoogle();
    } catch (authError) {
      void trackAndroidUsageSignal("login_failed", authError instanceof Error ? authError.name : "google_auth_error");
      setError(authErrorMessage(authError));
      setGoogleLoading(false);
    }
  };

  if (legalView) {
    return <LegalDocument view={legalView} onBack={() => setLegalView(null)} />;
  }

  return (
    <div className="sakinah-auth">
      <main className="sa-screen" dir="rtl" aria-label="تسجيل الدخول إلى سكينة">
        <header className="sa-top">
          <div className="sa-cap sa-brand sk-rim">
            <b>سَكِينَة</b>
            <i>AI</i>
          </div>
          <button
            type="button"
            onClick={onBack}
            disabled={!onBack}
            aria-label="رجوع"
            className="sa-back sk-rim"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </header>

        <section className="sa-mid">
          {/* Hero: two-bubble conversation (looped, decorative) */}
          <div className="sa-chat" ref={chatRef} role="img" aria-label="مثال لمحادثة بين مستخدم وسكينة AI" />

          <div className="sa-stack">
            <h1 className="sa-h">اسأل عن دينك بطمأنينة</h1>

            {error && (
              <p
                role="alert"
                className="mt-4 w-full max-w-[300px] rounded-2xl border border-[var(--sk-danger-soft)]/40 bg-[var(--sk-danger-soft)]/10 px-4 py-2 text-center text-[11px] font-bold leading-5 text-[var(--sk-danger-soft)]"
              >
                {error}
              </p>
            )}

            {/* زر Google — الطريقة الوحيدة */}
            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              aria-busy={googleLoading}
              className="sa-btn sk-rim"
            >
              <GoogleIcon />
              <span className="sa-lbl" aria-live="polite">
                {googleLoading ? "جارٍ الاتصال بـ Google…" : "المتابعة باستخدام Google"}
              </span>
              <span className="sa-spin" aria-hidden="true" />
            </button>
          </div>
        </section>

        <footer className="sa-legal">
          بتسجيل الدخول، أنت توافق على{" "}
          <button type="button" onClick={() => setLegalView("terms")}>الشروط</button>
          {" "}و{" "}
          <button type="button" onClick={() => setLegalView("privacy")}>سياسة الخصوصية</button>
        </footer>
      </main>
    </div>
  );
}

function LegalDocument({ view, onBack }: { view: LegalView; onBack: () => void }) {
  const isTerms = view === "terms";

  return (
    <main dir="rtl" className="min-h-[100dvh] overflow-y-auto bg-[var(--sk-bg)] text-[var(--sk-label)]">
      <div className="mx-auto min-h-[100dvh] w-full max-w-[440px] px-5 pb-10 pt-5 sm:px-7">
        <header className="flex items-center justify-between">
          <div className="cut-crystal-capsule sk-rim flex h-10 items-center justify-center px-5 shadow-md">
            <span className="pt-0.5 font-display text-[17px] font-black text-[var(--sk-label)]">سَكِينَة</span>
          </div>
          <button type="button" onClick={onBack} aria-label="رجوع" className="cut-crystal-capsule sk-rim grid h-10 w-10 place-items-center text-[var(--sk-label)] shadow-md transition-transform active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b88a4f]/45 dark:focus-visible:ring-[var(--sk-accent)]/45">
            <ArrowRight size={20} strokeWidth={1.8} className="mr-0.5" />
          </button>
        </header>

        <section className="mt-9 text-right">
          <p className="text-[12px] font-bold text-[var(--sk-accent-deep)]">سكينة · وضوح وطمأنينة</p>
          <h1 className="mt-2 font-display text-[30px] font-black leading-tight text-[var(--sk-label)]">{isTerms ? "شروط الاستخدام" : "سياسة الخصوصية"}</h1>
          <p className="mt-3 text-[13px] leading-7 text-[#6f6257]">آخر تحديث: ١٦ أغسطس ٢٠٢٦</p>
        </section>

        <article className="mt-7 space-y-6 text-[14px] leading-8 text-[#4f443a]">
          {isTerms ? <TermsContent /> : <PrivacyContent />}
        </article>
      </div>
    </main>
  );
}

function TermsContent() {
  return (
    <>
      <LegalSection title="مرحبًا بك في سكينة" text="سكينة تطبيق إسلامي صُمم ليكون رفيقًا هادئًا في القرآن والأذكار ومواقيت الصلاة. باستخدام التطبيق، تقرأ هذه الشروط وتوافق على الالتزام بها." />
      <LegalSection title="الاستخدام المسؤول" text="تستخدم سكينة باحترام ولغرض شخصي مشروع. لا يجوز العبث بالخدمة، أو محاولة الوصول إلى حسابات الآخرين، أو تعطيل التطبيق، أو استخدامه لإرسال محتوى مؤذٍ أو مسيء أو مخالف للأنظمة." />
      <LegalSection title="المحتوى الإسلامي" text="المحتوى المعروض وُضع للتذكير والمساعدة اليومية، ولا يغني عن سؤال أهل العلم الموثوقين في المسائل الشرعية الخاصة. مواقيت الصلاة حسابات مساعدة وقد تحتاج إلى مراجعة إعدادات بلدك أو الجهة المحلية المعتمدة." />
      <LegalSection title="الحساب وتسجيل الدخول" text="عند تسجيل الدخول عبر Google، تطبق كذلك شروط Google المتعلقة بحسابك." />
      <LegalSection title="احترام الناس وحسن المعاملة" text="نؤمن أن التقنية التي تخدم الطمأنينة يجب أن تُستخدم بأدب. نرفض الإساءة والتنمر والتحريض وانتهاك خصوصية الآخرين، ونحتفظ بحق حماية الخدمة من أي استخدام يضر بالمستخدمين." />
      <LegalSection title="التحديثات والتوافر" text="قد نطوّر المحتوى أو الواجهة أو نحدّث هذه الشروط لتحسين سكينة. سنعرض النسخة الأحدث داخل التطبيق، وقد تتوقف بعض الوظائف مؤقتًا بسبب الصيانة أو اعتمادها على خدمات خارجية." />
      <LegalSection title="التواصل" text="إذا لاحظت مشكلة في الحساب أو السلوك أو المحتوى، استخدم قناة التواصل الرسمية المرتبطة بالمشروع عند توفرها، واذكر التفاصيل الضرورية فقط دون إرسال كلمات السر أو رموز الدخول." />
    </>
  );
}

function PrivacyContent() {
  return (
    <>
      <LegalSection title="خصوصيتك أولًا" text="صُممت سكينة على مبدأ تقليل البيانات. لا نبيع بياناتك، ولا نستخدم معلومات الحساب لبناء ملفات إعلانية أو لتتبعك عبر تطبيقات أخرى." />
      <LegalSection title="ما الذي نحتاجه؟" text="عند إنشاء حساب عبر Google، يحتفظ نظام المصادقة بالبيانات اللازمة للحساب. نستخدمها لإتمام تسجيل الدخول وعرض حسابك داخل التطبيق." />
      <LegalSection title="الموقع وإعدادات الصلاة" text="قد يطلب التطبيق الموقع لتحديد المدينة ومواقيت الصلاة عند تفعيل تحديد الموقع. تُستخدم إعدادات المدينة والمواقيت لتشغيل الوظيفة المطلوبة، ولا نبيع سجل موقعك أو نستخدمه للإعلانات." />
      <LegalSection title="التخزين والأمان" text="تُحفظ جلسة الدخول عبر أدوات Supabase، ويستخدم Android التخزين الآمن المتاح في التطبيق." />
      <LegalSection title="ما لا نفعله" text="لا نبيع معلوماتك، ولا نؤجرها، ولا نشاركها لأغراض تسويقية. لا تطلب سكينة منك كلمات السر أو رموز Google عبر الرسائل. لا تضع أي بيانات حساسة داخل المحادثات أو الحقول غير المخصصة لها." />
      <LegalSection title="اختياراتك" text="يمكنك تسجيل الخروج من داخل التطبيق، كما يمكنك إيقاف إذن الموقع من إعدادات الهاتف." />
      <LegalSection title="تغييرات السياسة" text="إذا تغيّرت طريقة معالجة البيانات، سنحدّث هذه الصفحة داخل التطبيق ونوضح تاريخ التحديث. استمرارك في استخدام سكينة بعد التحديث يعني اطلاعك على النص الجديد." />
    </>
  );
}

function LegalSection({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <h2 className="font-display text-[20px] font-black text-[var(--sk-label)]">{title}</h2>
      <p className="mt-2">{text}</p>
    </section>
  );
}

function GoogleIcon() {
  return (
    <svg className="sa-g" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}
