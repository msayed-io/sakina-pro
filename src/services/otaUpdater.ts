/**
 * تحديثات الويب الصامتة (OTA) — معزولة تمامًا.
 *
 * الفكرة: تطبيق الأندرويد يحتوي طبقة ويب. عند كل تشغيل نتحقق من `version.json`
 * المرفوع مع آخر إصدار GitHub. إن وُجدت نسخة أحدث (SemVer) نُنزّلها في الخلفية
 * ونطلب تطبيقها عند الخروج من التطبيق — بلا أي واجهة، وبلا إعادة تحميل أمام المستخدم.
 *
 * قواعد صلبة:
 *  - لا يعمل إلا داخل تطبيق أصلي (Capacitor.isNativePlatform()).
 *  - لا يرمي أخطاء أبدًا ولا يعطّل الإقلاع: كل شيء داخل try/catch صامت.
 *  - notifyAppReady() يُستدعى أول شيء في كل تشغيل، وإلا يتراجع البلوجن عن النسخة.
 */

import { Capacitor } from "@capacitor/core";

/** بيان الإصدار المنشور مع آخر Release. */
const MANIFEST_URL =
  "https://github.com/msayed-io/sakina-pro/releases/latest/download/version.json";

/** أقل فاصل زمني بين فحصين متتاليين عند العودة للتطبيق (6 ساعات). */
const RECHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** مهلة طلب البيان. */
const FETCH_TIMEOUT_MS = 15_000;

/** عنصر واحد في مانيفست التحديث التفاضلي (يطابق ManifestEntry في البلوجن). */
interface OtaManifestEntry {
  file_name: string;
  file_hash: string;
  download_url: string;
}

interface OtaManifest {
  version: string;
  /** مسار احتياطي: حزمة dist.zip الكاملة. */
  url: string;
  /** SHA-256 للحزمة الكاملة. البلوجن يقبل `checksum`، ونقبل الاسمين. */
  checksum?: string;
  sha256?: string;
  minNativeVersion?: string;
  /**
   * بصمات كل ملفات الحزمة. وجودها يُفعّل المسار التفاضلي (الأساسي)،
   * وغيابها أو فشلها يُسقطنا بصمت على المسار الكامل.
   */
  manifest?: OtaManifestEntry[];
}

/** قفل ضد الفحوص المتزامنة. */
let inFlight: Promise<void> | null = null;
let lastCheckAt = 0;
let started = false;

/* ------------------------------------------------------------------ */
/* مقارنة إصدارات SemVer (لا نستخدم !== حتى لا نتراجع لإصدار أقدم)     */
/* ------------------------------------------------------------------ */

/**
 * يفصل أي عدد من الأجزاء الرقمية: "2.3.45" → [2,3,45]، و"2.3.45.7" → [2,3,45,7].
 * ضروري لأن حزمة الويب تُرقَّم vX.Y.Z.<run_number> لتكون أحدث من نفس إصدار الـAPK.
 */
function parseVersion(value: unknown): number[] | null {
  if (typeof value !== "string") return null;
  const head = /^\s*v?([0-9][0-9.]*)/.exec(value);
  if (!head) return null;
  const parts = head[1]
    .replace(/[.]+$/, "")
    .split(".")
    .map((piece) => Number(piece));
  return parts.length > 0 && parts.every((n) => Number.isFinite(n)) ? parts : null;
}

/** 1 إذا كانت a أحدث من b، و-1 إذا كانت أقدم، و0 إذا تساوت. */
export function compareVersions(a: unknown, b: unknown): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const a = left[i] ?? 0;
    const b = right[i] ?? 0;
    if (a !== b) return a > b ? 1 : -1;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* جلب البيان                                                          */
/* ------------------------------------------------------------------ */

/** يتحقق أن مدخلًا واحدًا من المانيفست صالح للاستخدام. */
function isManifestEntry(value: unknown): value is OtaManifestEntry {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.file_name === "string" &&
    entry.file_name.length > 0 &&
    typeof entry.file_hash === "string" &&
    /^[0-9a-f]{64}$/i.test(entry.file_hash) &&
    typeof entry.download_url === "string" &&
    entry.download_url.startsWith("https://")
  );
}

function isManifest(value: unknown): value is OtaManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.version !== "string" ||
    candidate.version.length === 0 ||
    typeof candidate.url !== "string" ||
    !candidate.url.startsWith("https://") ||
    (candidate.minNativeVersion !== undefined &&
      typeof candidate.minNativeVersion !== "string")
  ) {
    return false;
  }

  // البصمة إلزامية للحزمة الكاملة، مهما كان اسمها.
  const checksum = candidate.checksum ?? candidate.sha256;
  if (typeof checksum !== "string" || !/^[0-9a-f]{64}$/i.test(checksum)) return false;

  // المانيفست اختياري، لكن إن وُجد فيجب أن يكون صالحًا بالكامل — لا نصف حزمة.
  if (candidate.manifest !== undefined) {
    if (!Array.isArray(candidate.manifest)) return false;
    if (candidate.manifest.length > 0 && !candidate.manifest.every(isManifestEntry)) {
      return false;
    }
  }

  return true;
}

/** بصمة الحزمة الكاملة، أيًّا كان اسم الحقل الذي وصل. */
function fallbackChecksum(manifest: OtaManifest): string {
  return String(manifest.checksum ?? manifest.sha256 ?? "");
}

/** مانيفست تفاضلي صالح للعمل — أو null إذا تعذّر استخدامه. */
function usableDelta(manifest: OtaManifest): OtaManifestEntry[] | null {
  const entries = manifest.manifest;
  if (!Array.isArray(entries) || entries.length === 0) return null;
  if (!entries.some((entry) => entry.file_name === "index.html")) return null;
  return entries;
}

async function fetchManifest(): Promise<OtaManifest | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${MANIFEST_URL}?t=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const payload: unknown = await response.json();
    return isManifest(payload) ? payload : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* دورة الفحص                                                          */
/* ------------------------------------------------------------------ */

async function runCheck(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");

    // 1) الحماية من الانهيار: يجب استدعاءها في كل تشغيل قبل أي شيء آخر.
    try {
      await CapacitorUpdater.notifyAppReady();
    } catch {
      /* لا شيء — نكمل، ربما النسخة الأصلية تعمل */
    }

    // 2) ما هو الإصدار الحالي على الجهاز؟
    let nativeVersion = "";
    let currentBundleVersion = "";
    let currentBundleId = "";
    try {
      const current = await CapacitorUpdater.current();
      nativeVersion = String(current.native ?? "");
      currentBundleVersion = String(current.bundle?.version ?? "");
      currentBundleId = String(current.bundle?.id ?? "");
    } catch {
      return; // بلا معلومات الإصدار لا نخاطر بشيء
    }

    // 3) البيان المنشور.
    const manifest = await fetchManifest();
    if (!manifest) return;

    // 4) لا تنزيل إلا إذا كان الإصدار المنشور أحدث فعلًا.
    const baseline = currentBundleVersion || nativeVersion;
    if (compareVersions(manifest.version, baseline) <= 0) return;

    // 5) حماية التوافق: لا نحمّل ويبًا يحتاج APK أحدث مما على الجهاز.
    if (
      manifest.minNativeVersion &&
      nativeVersion &&
      compareVersions(nativeVersion, manifest.minNativeVersion) < 0
    ) {
      return;
    }

    // 6) المسار الأساسي: تحديث تفاضلي — تُنزَّل الملفات المتغيرة فقط.
    //    الملفات غير المتغيرة تُعاد استخدامها من الـAPK أو الكاش المحلي،
    //    لذلك حجم التنزيل بضعة كيلوبايتات بدلًا من الحزمة الكاملة.
    const delta = usableDelta(manifest);
    let downloadedId = "";

    if (delta) {
      try {
        const diff = await CapacitorUpdater.getMissingBundleFiles({
          version: manifest.version,
          manifest: delta,
        });
        // كل الملفات موجودة محليًا (في الـAPK أو الكاش) والمحتوى مطابق:
        // لا شيء لتنزيله ولا شيء لتغييره — نخرج بلا أي طلب شبكة إضافي.
        if (diff.missingCount === 0) return;

        const bundle = await CapacitorUpdater.download({
          url: manifest.url,
          version: manifest.version,
          checksum: fallbackChecksum(manifest),
          manifest: delta,
        });
        downloadedId = String(bundle.id ?? "");
      } catch {
        downloadedId = ""; // فشل تفاضلي → ننتقل للمسار الكامل أدناه
      }
    }

    // 7) المسار الاحتياطي: الحزمة الكاملة. لا يُستدعى إلا إذا غاب المانيفست
    //    أو فشل المسار التفاضلي أو لم يُنتج حزمة قابلة للتطبيق.
    if (!downloadedId) {
      try {
        const bundle = await CapacitorUpdater.download({
          url: manifest.url,
          version: manifest.version,
          checksum: fallbackChecksum(manifest),
        });
        downloadedId = String(bundle.id ?? "");
      } catch {
        return; // فشل المسارين → نبقى على الحالي بلا أي أثر
      }
    }
    if (!downloadedId) return;

    // 8) جدولته للتطبيق عند مغادرة التطبيق أو التشغيل القادم — لا إعادة تحميل الآن.
    try {
      await CapacitorUpdater.next({ id: downloadedId });
    } catch {
      return;
    }

    // 9) تنظيف الحزم القديمة (أفضل جهد، بلا أثر على الواجهة).
    try {
      const list = await CapacitorUpdater.list();
      for (const bundle of list.bundles ?? []) {
        const id = String(bundle.id ?? "");
        if (!id || id === downloadedId || id === currentBundleId) continue;
        await CapacitorUpdater.delete({ id });
      }
    } catch {
      /* تجاهل */
    }
  } catch {
    /* أي فشل غير متوقع: صامت تمامًا */
  }
}

/** فحص واحد مع منع التزامن. */
function checkOnce(): Promise<void> {
  if (inFlight) return inFlight;
  lastCheckAt = Date.now();
  inFlight = runCheck().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/**
 * نقطة الدخول. تُستدعى مرة واحدة عند الإقلاع.
 * لا تعيد قيمة ذات معنى، ولا ترمي، ولا تعرض واجهة.
 */
export function startOtaUpdater(): void {
  if (started) return;
  started = true;
  if (!Capacitor.isNativePlatform()) return;

  void checkOnce();

  // إعادة فحص هادئة عند العودة للتطبيق بعد غياب طويل.
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastCheckAt < RECHECK_INTERVAL_MS) return;
      void checkOnce();
    });
  } catch {
    /* تجاهل */
  }
}
