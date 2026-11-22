/**
 * SettingsExperience — الجذر الوحيد لشاشة الإعدادات الجديدة.
 *
 * يجمع: الصفحة الأولى (الإعدادات) + الثانية (الحساب) + الورقتين
 * (تعديل الموقع + منتقي الوقت). لا يكرّر منطقًا من App.tsx — كل قيمة تأتي
 * من الحالة الحقيقية، وكل فعل ينفّذه المالك عبر الـprops.
 *
 * تنقّل الطبقتين كما في المرجع: الحساب ينزلق من اليسار، والإعدادات تتراجع
 * وتخفت. الشرائح من الأعلى. كلها بنفس التوقيت والمنحنى.
 *
 * Back (واحد فقط، مملوك لـApp.tsx): سياق الطلب يمرّ عبر `requestClose()` الذي
 * يقلب الحالة إلى false، فلا نضيف مستمع popstate ثانيًا هنا.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import type { CalculationMethod, AsrSchool } from "@/utils/locationDetection";
import SettingsPage, { type ReminderKey } from "./SettingsPage";
import AccountPage from "./AccountPage";
import TimePickerSheet from "./TimePickerSheet";
import "./settings.css";

type Props = {
  /* بيانات حقيقية */
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

  /* الموقع — الورقة المشتركة تُركَّب مرة واحدة في App.tsx */
  onOpenLocationSheet: () => void;

  /* الحساب */
  currentUser: User | null;
  onSignOut: () => Promise<void>;

  /* المنبهات */
  isMulkReminderEnabled: boolean;
  onToggleMulkReminder: (value: boolean) => void;
  mulkReminderTime: string;
  onChangeMulkReminderTime: (time: string) => void;
  isBaqarahReminderEnabled: boolean;
  onToggleBaqarahReminder: (value: boolean) => void;
  baqarahReminderTime: string;
  onChangeBaqarahReminderTime: (time: string) => void;

  /* خروج */
  onExit: () => void;
};

const SURAH_NAMES: Record<ReminderKey, string> = {
  mulk: "سورة الملك",
  baqarah: "سورة البقرة",
};

export default function SettingsExperience(props: Props) {
  const [page, setPage] = useState<"main" | "account">("main");
  const [pickerKey, setPickerKey] = useState<ReminderKey | null>(null);
  const [accountDirty, setAccountDirty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const say = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  useEffect(
    () => () => {
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  /* ── الحساب: حفظ الاسم في الملف الحقيقي ─────────────────────────── */
  const handleSaveName = useCallback(
    async (name: string): Promise<string | null> => {
      try {
        const { updateDisplayName } = await import("@/services/auth-service");
        await updateDisplayName(name);
        say("تم حفظ الاسم.");
        return null;
      } catch {
        return "تعذّر حفظ الاسم، تحقّق من الاتصال وحاول مرة أخرى.";
      }
    },
    [say],
  );

  /* ── الحساب: تغيير كلمة المرور عبر المسار الحقيقي ───────────────── */
  const handleChangePassword = useCallback(async (): Promise<string | null> => {
    const email = props.currentUser?.email;
    if (!email) return "لا يوجد بريد مرتبط بهذا الحساب.";
    try {
      const { sendPasswordReset } = await import("@/services/auth-service");
      await sendPasswordReset(email);
      return null;
    } catch {
      return "تعذّر إرسال رابط تغيير كلمة المرور، حاول مرة أخرى.";
    }
  }, [props.currentUser]);

  /* ── تسجيل الخروج: مسار حقيقي بتأكيد ────────────────────────────── */
  const handleSignOut = useCallback(async () => {
    const confirmed = window.confirm("هل تريد تسجيل الخروج من حسابك؟");
    if (!confirmed) return;
    await props.onSignOut();
  }, [props]);

  /* ── منتقي الوقت: «تم» يعيد جدولة التذكير الحقيقي ──────────────── */
  const confirmTime = useCallback(
    (time24: string) => {
      if (!pickerKey) return;
      if (pickerKey === "mulk") {
        props.onChangeMulkReminderTime(time24);
        if (!props.isMulkReminderEnabled) props.onToggleMulkReminder(true);
      } else {
        props.onChangeBaqarahReminderTime(time24);
        if (!props.isBaqarahReminderEnabled) props.onToggleBaqarahReminder(true);
      }
      setPickerKey(null);
    },
    [pickerKey, props],
  );

  const currentPickerTime =
    pickerKey === "mulk"
      ? props.mulkReminderTime
      : pickerKey === "baqarah"
      ? props.baqarahReminderTime
      : "21:00";

  return (
    <div className={`st-root${page === "account" ? " is-account" : ""}`}>
      <SettingsPage
        cityName={props.cityName}
        displayAddress={props.displayAddress}
        isAutoLocation={props.isAutoLocation}
        onToggleAutoLocation={props.onToggleAutoLocation}
        calcMethod={props.calcMethod}
        asrSchool={props.asrSchool}
        isAutoCalcMethod={props.isAutoCalcMethod}
        isAutoAsrSchool={props.isAutoAsrSchool}
        onToggleAutoCalcMethod={props.onToggleAutoCalcMethod}
        onToggleAutoAsrSchool={props.onToggleAutoAsrSchool}
        onChangeCalcMethod={props.onChangeCalcMethod}
        onChangeAsrSchool={props.onChangeAsrSchool}
        onOpenLocationSheet={props.onOpenLocationSheet}
        onBack={props.onExit}
        currentUser={props.currentUser}
        onOpenAccount={() => setPage("account")}
        isMulkReminderEnabled={props.isMulkReminderEnabled}
        onToggleMulkReminder={props.onToggleMulkReminder}
        mulkReminderTime={props.mulkReminderTime}
        isBaqarahReminderEnabled={props.isBaqarahReminderEnabled}
        onToggleBaqarahReminder={props.onToggleBaqarahReminder}
        baqarahReminderTime={props.baqarahReminderTime}
        onOpenReminderPicker={setPickerKey}
      />

      <AccountPage
        open={page === "account"}
        currentUser={props.currentUser}
        onSaveName={handleSaveName}
        onChangePassword={handleChangePassword}
        onSignOut={handleSignOut}
        onBack={() => setPage("main")}
        onDirtyChange={setAccountDirty}
        onRequestLeave={() => {
          if (accountDirty && !window.confirm("لديك تغييرات غير محفوظة، هل تريد الخروج؟")) {
            return false;
          }
          return true;
        }}
      />

      <TimePickerSheet
        open={pickerKey !== null}
        surahName={pickerKey ? SURAH_NAMES[pickerKey] : ""}
        initialTime={currentPickerTime}
        onConfirm={confirmTime}
        onCancel={() => setPickerKey(null)}
      />

      {toast && (
        <div className="st-toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
