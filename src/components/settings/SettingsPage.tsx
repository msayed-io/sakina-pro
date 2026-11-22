/**
 * SettingsPage — الصفحة الأولى (الإعدادات).
 *
 * بنية وترتيب وحركة المرجع بالحرف. كل قيمة مقروءة من النظام الحقيقي،
 * وكل ضغطة تُنفّذ الفعل الحقيقي في App.tsx:
 *   • الملف/الحساب ⇒ بطاقة المستخدم الحقيقي + opens صفحة الحساب.
 *   • الموقع الحالي + «تغيير» ⇒ يفتح ورقة تعديل الموقع المشتركة.
 *   • مفتاح التحديد التلقائي ⇒ onToggleAutoLocation الحقيقي.
 *   • طريقة الحساب / المذهب ⇒ الأنظمة الحقيقية، والتبديل يدوي/تلقائي حقيقي.
 *     اختيار القيمة عند اليدوي = الآلية الموجودة اليوم (قائمة منسدلة).
 *   • منبهات الملك/البقرة ⇒ التفعيل ينشئ تذكيرًا حقيقيًا، والإطفاء يلغيه.
 *     كبسولة الوقت تفتح المنتقي المخصص وتعيد الجدولة عند «تم».
 *   • الويدجت ⇒ PrayerWidgetService.isSupported() الحقيقي.
 *   • التذييل ⇒ سَكِينَة + الآية + رقم الإصدار من package.json.
 *
 * المحذوف لأن لا نظام حقيقي له: «تغيير الصورة»، «حذف الحساب».
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Compass,
  MapPin,
  Sliders,
  Smartphone,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { CalculationMethod, AsrSchool } from "@/utils/locationDetection";
import { calcMethodLabels, asrSchoolLabels } from "@/constants/prayerContent";
import { displayNameOf } from "./AccountPage";
import { formatTime12Arabic } from "./TimePickerSheet";

/** رقم الإصدار الحقيقي: package.json (نفس مصدر نسخة البناء في CI). */
export const APP_VERSION = __APP_VERSION__;

export type ReminderKey = "mulk" | "baqarah";

export type SettingsPageProps = {
  cityName: string;
  displayAddress?: string;
  isAutoLocation: boolean;
  onToggleAutoLocation: (value: boolean) => void;
  calcMethod: CalculationMethod;
  asrSchool: AsrSchool;
  isAutoCalcMethod: boolean;
  isAutoAsrSchool: boolean;
  onToggleAutoCalcMethod: (value: boolean) => void;
  onToggleAutoAsrSchool: (value: boolean) => void;
  onChangeCalcMethod: (method: CalculationMethod) => void;
  onChangeAsrSchool: (school: AsrSchool) => void;
  onOpenLocationSheet: () => void;
  onBack: () => void;
  currentUser: User | null;
  onOpenAccount: () => void;

  isMulkReminderEnabled: boolean;
  onToggleMulkReminder: (value: boolean) => void;
  mulkReminderTime: string;
  isBaqarahReminderEnabled: boolean;
  onToggleBaqarahReminder: (value: boolean) => void;
  baqarahReminderTime: string;
  /** يفتح منتقي الوقت للسورة بالوقت المحفوظ فعليًا. */
  onOpenReminderPicker: (key: ReminderKey) => void;
};

/** زرّ تبديل صغير لإظهار قائمة الاختيار اليدوي (الآلية الموجودة اليوم). */
function ExpandChevron({
  expanded,
  onClick,
}: {
  expanded: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--sk-bg2)] border border-[var(--sk-sep)] text-[var(--sk-label2)] active:scale-90 transition-transform cursor-pointer"
      aria-expanded={expanded}
      aria-label="عرض الخيارات"
    >
      <ChevronDown
        size={14}
        className={`transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      />
    </button>
  );
}

export default function SettingsPage({
  cityName,
  displayAddress,
  isAutoLocation,
  onToggleAutoLocation,
  calcMethod,
  asrSchool,
  isAutoCalcMethod,
  isAutoAsrSchool,
  onToggleAutoCalcMethod,
  onToggleAutoAsrSchool,
  onChangeCalcMethod,
  onChangeAsrSchool,
  onOpenLocationSheet,
  onBack,
  currentUser,
  onOpenAccount,
  isMulkReminderEnabled,
  onToggleMulkReminder,
  mulkReminderTime,
  isBaqarahReminderEnabled,
  onToggleBaqarahReminder,
  baqarahReminderTime,
  onOpenReminderPicker,
}: SettingsPageProps) {
  const [calcOpen, setCalcOpen] = useState(false);
  const [asrOpen, setAsrOpen] = useState(false);
  const [widgetState, setWidgetState] = useState<
    "checking" | "idle" | "unsupported"
  >("checking");

  // الويدجت: اكتشاف حقيقي لقدرة المشغّل (نفس خدمة التطبيق).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const { PrayerWidgetService } = await import("@/services/PrayerWidgetService");
        const supported = await PrayerWidgetService.isSupported();
        if (alive) setWidgetState(supported ? "idle" : "unsupported");
      } catch {
        if (alive) setWidgetState("unsupported");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const openWidgetPin = useCallback(async () => {
    try {
      const { PrayerWidgetService } = await import("@/services/PrayerWidgetService");
      await PrayerWidgetService.requestPin();
    } catch {
      /* المنصة لا تدعم الإضافة المباشرة — الملاحظة أسفل القسم تشرح البديل. */
    }
  }, []);

  const profileName = displayNameOf(currentUser);
  const email = currentUser?.email ?? "";
  const avatarUrl = currentUser?.user_metadata?.avatar_url as string | undefined;
  const locationSecondary = useMemo(
    () => (displayAddress && displayAddress !== cityName ? displayAddress : cityName),
    [displayAddress, cityName],
  );

  const calcList = useMemo(() => Object.entries(calcMethodLabels), []);
  const asrList = useMemo(() => Object.entries(asrSchoolLabels), []);

  // مرجع حيّ لكل قائمة للتمرير عند الإغلاق؟ لا حاجة — المرجع بلا ذلك.

  return (
    <div className="st-page st-page-first">
      <div className="st-scroll">
        {/* ── بطاقة الملف ─────────────────────────────────────────── */}
        <section className="st-g" style={{ "--i": 0 } as React.CSSProperties}>
          <div className="st-grp st-hero">
            <svg className="st-rings" viewBox="0 0 300 300" aria-hidden="true">
              <circle cx="150" cy="150" r="148" />
              <circle cx="150" cy="150" r="112" />
              <circle cx="150" cy="150" r="76" />
            </svg>
            <div
              className="st-row st-me"
              role="button"
              tabIndex={0}
              aria-label="فتح صفحة الحساب"
              onClick={onOpenAccount}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpenAccount();
                }
              }}
            >
              <div className="st-av" aria-hidden="true">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
                ) : (
                  profileName.charAt(0)
                )}
              </div>
              <div className="st-tx">
                <div className="st-t">{profileName}</div>
                <div className="st-s">{email || "—"}</div>
              </div>
              <div className="st-tr">
                <ChevronLeft size={16} strokeWidth={1.8} className="st-chev" />
              </div>
            </div>
          </div>
        </section>

        {/* ── الموقع ──────────────────────────────────────────────── */}
        <section className="st-g" style={{ "--i": 1 } as React.CSSProperties}>
          <h3 className="st-h3">الموقع</h3>
          <div className="st-grp">
            <div className="st-row">
              <div className="st-ic">
                <MapPin size={16} strokeWidth={1.7} />
              </div>
              <div className="st-tx">
                <div className="st-t">الموقع الحالي</div>
                <div className="st-s">{locationSecondary}</div>
              </div>
              <div className="st-tr">
                <button
                  type="button"
                  className="st-role-action"
                  onClick={onOpenLocationSheet}
                >
                  تغيير
                </button>
              </div>
            </div>

            <div className="st-row">
              <div className="st-ic">
                <Compass size={16} strokeWidth={1.7} />
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
                  aria-checked={isAutoLocation}
                  aria-label="تحديد الموقع تلقائيًا"
                  onClick={() => onToggleAutoLocation(!isAutoLocation)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── حساب المواقيت ───────────────────────────────────────── */}
        <section className="st-g" style={{ "--i": 2 } as React.CSSProperties}>
          <h3 className="st-h3">حساب المواقيت</h3>
          <div className="st-grp">
            <div className="st-row">
              <div className="st-ic">
                <Sliders size={16} strokeWidth={1.7} />
              </div>
              <div className="st-tx">
                <div className="st-t">طريقة الحساب</div>
                <div className="st-s">{calcMethodLabels[calcMethod]}</div>
              </div>
              <div className="st-tr">
                <span className="st-lbl">{isAutoCalcMethod ? "تلقائي" : "يدوي"}</span>
                <button
                  type="button"
                  className="st-sw"
                  role="switch"
                  aria-checked={isAutoCalcMethod}
                  aria-label="طريقة الحساب تلقائية"
                  onClick={() => onToggleAutoCalcMethod(!isAutoCalcMethod)}
                />
                {!isAutoCalcMethod && (
                  <ExpandChevron
                    expanded={calcOpen}
                    onClick={() => setCalcOpen((v) => !v)}
                  />
                )}
              </div>
            </div>

            {/* القائمة اليدوية — الآلية الموجودة اليوم، بلا تصميم جديد */}
            {!isAutoCalcMethod && calcOpen && (
              <div className="st-row" style={{ padding: 0 }}>
                <div className="w-full p-2 space-y-1">
                  {calcList.map(([key, label]) => {
                    const selected = calcMethod === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          onChangeCalcMethod(key as CalculationMethod);
                          setCalcOpen(false);
                        }}
                        className={`w-full text-right flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] font-bold transition-all cursor-pointer ${
                          selected
                            ? "bg-[var(--sk-accent)] text-[var(--sk-on-espresso)]"
                            : "text-[var(--sk-label)] hover:bg-[var(--sk-accent)]/5"
                        }`}
                      >
                        <span>{label}</span>
                        {selected && <span aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="st-row">
              <div className="st-ic">
                <BookOpen size={16} strokeWidth={1.7} />
              </div>
              <div className="st-tx">
                <div className="st-t">المذهب الفقهي للعصر</div>
                <div className="st-s">
                  {asrSchool === "STANDARD" ? "الجمهور" : "الحنفي"}
                </div>
              </div>
              <div className="st-tr">
                <span className="st-lbl">{isAutoAsrSchool ? "تلقائي" : "يدوي"}</span>
                <button
                  type="button"
                  className="st-sw"
                  role="switch"
                  aria-checked={isAutoAsrSchool}
                  aria-label="المذهب الفقهي تلقائي"
                  onClick={() => onToggleAutoAsrSchool(!isAutoAsrSchool)}
                />
                {!isAutoAsrSchool && (
                  <ExpandChevron
                    expanded={asrOpen}
                    onClick={() => setAsrOpen((v) => !v)}
                  />
                )}
              </div>
            </div>

            {!isAutoAsrSchool && asrOpen && (
              <div className="st-row" style={{ padding: 0 }}>
                <div className="w-full p-2 space-y-1">
                  {asrList.map(([key, label]) => {
                    const selected = asrSchool === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => {
                          onChangeAsrSchool(key as AsrSchool);
                          setAsrOpen(false);
                        }}
                        className={`w-full text-right flex items-center justify-between px-3 py-2 rounded-xl text-[12.5px] font-bold transition-all cursor-pointer ${
                          selected
                            ? "bg-[var(--sk-accent)] text-[var(--sk-on-espresso)]"
                            : "text-[var(--sk-label)] hover:bg-[var(--sk-accent)]/5"
                        }`}
                      >
                        <span>{label}</span>
                        {selected && <span aria-hidden="true">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── منبهات القرآن ───────────────────────────────────────── */}
        <section className="st-g" style={{ "--i": 3 } as React.CSSProperties}>
          <h3 className="st-h3">منبهات القرآن</h3>
          <div className="st-grp">
            <div className={`st-row st-row-alarm ${isMulkReminderEnabled ? "st-on" : ""}`}>
              <div className="st-ic">
                <Bell size={16} strokeWidth={1.7} />
              </div>
              <div className="st-tx">
                <div className="st-t">سورة الملك</div>
                <div className="st-s">تنبيه يومي لقراءة السورة المنجية</div>
              </div>
              <div className="st-tr">
                <button
                  type="button"
                  className="st-role-action st-ghost st-time"
                  aria-label="تعديل وقت منبه سورة الملك"
                  onClick={() => onOpenReminderPicker("mulk")}
                >
                  {formatTime12Arabic(mulkReminderTime)}
                </button>
                <button
                  type="button"
                  className="st-sw"
                  role="switch"
                  aria-checked={isMulkReminderEnabled}
                  aria-label="منبه سورة الملك"
                  onClick={() => onToggleMulkReminder(!isMulkReminderEnabled)}
                />
              </div>
            </div>

            <div className={`st-row st-row-alarm ${isBaqarahReminderEnabled ? "st-on" : ""}`}>
              <div className="st-ic">
                <Bell size={16} strokeWidth={1.7} />
              </div>
              <div className="st-tx">
                <div className="st-t">سورة البقرة</div>
                <div className="st-s">تنبيه يومي لقراءة سورة البركة</div>
              </div>
              <div className="st-tr">
                <button
                  type="button"
                  className="st-role-action st-ghost st-time"
                  aria-label="تعديل وقت منبه سورة البقرة"
                  onClick={() => onOpenReminderPicker("baqarah")}
                >
                  {formatTime12Arabic(baqarahReminderTime)}
                </button>
                <button
                  type="button"
                  className="st-sw"
                  role="switch"
                  aria-checked={isBaqarahReminderEnabled}
                  aria-label="منبه سورة البقرة"
                  onClick={() => onToggleBaqarahReminder(!isBaqarahReminderEnabled)}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── الشاشة الرئيسية (الويدجت) ───────────────────────────── */}
        <section className="st-g" style={{ "--i": 4 } as React.CSSProperties}>
          <h3 className="st-h3">الشاشة الرئيسية</h3>
          <div className="st-grp">
            <div className="st-row">
              <div className="st-ic">
                <Smartphone size={16} strokeWidth={1.7} />
              </div>
              <div className="st-tx">
                <div className="st-t">ويدجت سكينة</div>
                <div className="st-s">أضف المواقيت إلى شاشتك الرئيسية</div>
              </div>
              <div className="st-tr">
                <button
                  type="button"
                  className="st-role-action st-ghost"
                  onClick={() => void openWidgetPin()}
                  disabled={widgetState !== "idle"}
                >
                  كيفية الإضافة
                </button>
              </div>
            </div>
          </div>
          {/* شرطية: تظهر فقط حين لا يدعم المشغّل الإضافة المباشرة فعلاً. */}
          {widgetState === "unsupported" && (
            <p className="st-note">
              مشغّل الشاشة الحالي لا يدعم الإضافة المباشرة، أضفه من قائمة
              الويدجت في شاشتك الرئيسية.
            </p>
          )}
        </section>

        {/* ── التذييل ─────────────────────────────────────────────── */}
        <section className="st-g" style={{ "--i": 5 } as React.CSSProperties}>
          <div className="st-foot">
            <b>سَكِينَة</b>
            <p>﴿هُوَ الَّذِي أَنزَلَ السَّكِينَةَ فِي قُلُوبِ الْمُؤْمِنِينَ﴾</p>
            <small>سورة الفتح: 4</small>
            <small className="st-ver">الإصدار {APP_VERSION}</small>
          </div>
        </section>
      </div>

      <header className="st-topbar">
        <h1 className="cut-crystal-capsule sk-rim st-role-title">الإعدادات</h1>
        <button
          type="button"
          className="st-role-circle cut-crystal-capsule sk-rim"
          aria-label="رجوع"
          onClick={onBack}
        >
          <ChevronRight size={20} strokeWidth={1.9} />
        </button>
      </header>
    </div>
  );
}
