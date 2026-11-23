/**
 * AccountPage — صفحة الحساب (الطبقة الثانية).
 *
 * منقولة بالحرف من المرجع: صورة/حرف كبير، «تغيير الصورة»، بيانات شخصية
 * (الاسم كحقل قابل للتحرير + البريد للقراءة فقط)، الأمان، وتغيير كلمة المرور،
 * وتسجيل الخروج.
 *
 * «حذف الحساب» **غير منقول** — لا يوجد في التطبيق مسار حذف حساب حقيقي
 * (auth-service بلا deleteUser)، وقاعدة الأمر: لا نخترع نظامًا لعنصر غير موجود.
 *
 * كبسولة «حفظ» تظهر فقط عند اختلاف الاسم (dirty)، تمامًا كما في المرجع.
 */
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, KeyRound, LogOut, Mail, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";

export type AccountPageProps = {
  /** هل الطبقة الثانية ظاهرة الآن؟ */
  open: boolean;
  /** يخبر الأب بحالة التعديل غير المحفوظ (لتنظيفها عند مغادرة الشاشة). */
  onDirtyChange?: (dirty: boolean) => void;
  /** يُسأل قبل المغادرة إذا كان هناك تعديل غير محفوظ. */
  onRequestLeave?: () => boolean;
  currentUser: User | null;
  /** يحفظ الاسم في الملف الحقيقي ثم في الخادم. يعيد رسالة خطأ أو null. */
  onSaveName: (name: string) => Promise<string | null>;
  /** مسار تغيير كلمة المرور الحقيقي (إرسال رابط إعادة التعيين). */
  onChangePassword: () => Promise<string | null>;
  onSignOut: () => Promise<void>;
  onBack: () => void;
};

/** الاسم الحقيقي المعروض في التطبيق كله (نفس ترتيب بقية الشاشات). */
export function displayNameOf(user: User | null): string {
  return String(
    user?.user_metadata?.full_name ??
      user?.user_metadata?.name ??
      "مستخدم سَكِينَة",
  );
}

export default function AccountPage({
  open,
  onDirtyChange,
  onRequestLeave,
  currentUser,
  onSaveName,
  onChangePassword,
  onSignOut,
  onBack,
}: AccountPageProps) {
  const [name, setName] = useState("");
  const [savedName, setSavedName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // قراءة الاسم الحقيقي عند الدخول.
  useEffect(() => {
    const real = displayNameOf(currentUser);
    setName(real);
    setSavedName(real);
    setError(null);
    setNotice(null);
  }, [currentUser]);

  const avatarUrl = currentUser?.user_metadata?.avatar_url as string | undefined;
  const initial = (savedName || "س").charAt(0);
  const dirty = name.trim() !== savedName && name.trim().length > 0;

  // إبلاغ الأب بحالة التعديل (لا يُشتقّ عنده ثانية).
  useEffect(() => {
    onDirtyChange?.(dirty && open);
  }, [dirty, open, onDirtyChange]);

  // إعادة الضبط عند مغادرة الصفحة: لا يبقى اسم معدّل عالقًا في الحقل.
  useEffect(() => {
    if (open) return;
    setName(savedName);
    setError(null);
  }, [open, savedName]);

  const goBack = () => {
    if (onRequestLeave && !onRequestLeave()) return;
    onBack();
  };

  const handleSave = async () => {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    const message = await onSaveName(name.trim());
    setSaving(false);
    if (message) {
      // فشل الحفظ: رسالة عربية بسيطة، وتبقى كبسولة «حفظ».
      setError(message);
      return;
    }
    setSavedName(name.trim());
  };

  return (
    <div className={`st-page st-page-second ${open ? "st-open" : ""}`} aria-hidden={!open}>
      <div className="st-scroll">
        <section className="st-g st-acc" style={{ "--i": 0 } as React.CSSProperties}>
          <div className="st-av st-big" aria-hidden="true">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" referrerPolicy="no-referrer" />
            ) : (
              initial
            )}
          </div>
          {/* لا يوجد في التطبيق نظام صورة شخصية ⇒ العنصر غير منقول. */}
        </section>

        <section className="st-g" style={{ "--i": 1 } as React.CSSProperties}>
          <h3 className="st-h3">البيانات الشخصية</h3>
          <div className="st-grp cut-crystal-panel">
            <label className="st-row">
              <div className="st-ic">
                <UserRound size={16} />
              </div>
              <div className="st-tx">
                <div className="st-s">الاسم</div>
                <input
                  className="st-fld"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="off"
                  maxLength={40}
                  aria-label="الاسم"
                />
              </div>
            </label>

            <div className="st-row">
              <div className="st-ic">
                <Mail size={16} />
              </div>
              <div className="st-tx">
                <div className="st-s">البريد الإلكتروني</div>
                {/* البريد هو النص اللاتيني الوحيد المسموح — كما هو من الحساب */}
                <div className="st-t st-mail">{currentUser?.email ?? "—"}</div>
              </div>
            </div>
          </div>
          {error && (
            <p className="st-note" role="alert" style={{ color: "var(--st-danger)" }}>
              {error}
            </p>
          )}
          {notice && <p className="st-note">{notice}</p>}
        </section>

        <section className="st-g" style={{ "--i": 2 } as React.CSSProperties}>
          <h3 className="st-h3">الأمان</h3>
          <div className="st-grp cut-crystal-panel">
            <div
              className="st-row"
              role="button"
              tabIndex={0}
              onClick={async () => {
                const message = await onChangePassword();
                setNotice(message ?? "أرسلنا رابط تغيير كلمة المرور إلى بريدك.");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  (event.currentTarget as HTMLElement).click();
                }
              }}
            >
              <div className="st-ic">
                <KeyRound size={16} />
              </div>
              <div className="st-tx">
                <div className="st-t">كلمة المرور</div>
                <div className="st-s">تغيير كلمة مرور حسابك</div>
              </div>
              <div className="st-tr">
                <ChevronLeft size={16} className="st-chev" />
              </div>
            </div>
          </div>
        </section>

        <section className="st-g" style={{ "--i": 3 } as React.CSSProperties}>
          <button
            type="button"
            className="cut-crystal-capsule sk-rim st-role-wide st-role-logout mt-[28px]"
            onClick={() => void onSignOut()}
          >
            <LogOut size={16} aria-hidden="true" />
            تسجيل الخروج
          </button>
          {/* «حذف الحساب» غير منقول: لا مسار حقيقي في التطبيق. */}
        </section>
      </div>

      <header className="st-topbar">
        <h1 className="cut-crystal-capsule sk-rim st-role-title">الحساب</h1>
        <div className="st-end">
          <button
            type="button"
            className="cut-crystal-capsule sk-rim st-role-save" style={{ display: dirty ? "inline-flex" : "none" }}
            onClick={() => void handleSave()}
            disabled={saving}
          >
            {saving ? "جارٍ الحفظ…" : "حفظ"}
          </button>
          <button
            type="button"
            className="st-role-circle cut-crystal-capsule sk-rim"
            aria-label="رجوع"
            onClick={goBack}
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </header>
    </div>
  );
}
