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

interface OtaManifest {
  version: string;
  url: string;
  /** SHA-256 لحزمة dist.zip بصيغة hex — البلوجن يرفض التنزيل بدونه. */
  checksum: string;
  minNativeVersion?: string;
}

/** قفل ضد الفحوص المتزامنة. */
let inFlight: Promise<void> | null = null;
let lastCheckAt = 0;
let started = false;

/* ------------------------------------------------------------------ */
/* مقارنة إصدارات SemVer (لا نستخدم !== حتى لا نتراجع لإصدار أقدم)     */
/* ------------------------------------------------------------------ */

function parseVersion(value: unknown): [number, number, number] | null {
  if (typeof value !== "string") return null;
  const match = /^\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(value);
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

/** 1 إذا كانت a أحدث من b، و-1 إذا كانت أقدم، و0 إذا تساوت. */
export function compareVersions(a: unknown, b: unknown): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}

/* ------------------------------------------------------------------ */
/* جلب البيان                                                          */
/* ------------------------------------------------------------------ */

function isManifest(value: unknown): value is OtaManifest {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.version === "string" &&
    candidate.version.length > 0 &&
    typeof candidate.url === "string" &&
    candidate.url.startsWith("https://") &&
    typeof candidate.checksum === "string" &&
    /^[0-9a-f]{64}$/i.test(candidate.checksum) &&
    (candidate.minNativeVersion === undefined ||
      typeof candidate.minNativeVersion === "string")
  );
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

    // 6) التنزيل في الخلفية (لا يغيّر شيئًا على الشاشة).
    let downloadedId = "";
    try {
      const bundle = await CapacitorUpdater.download({
        url: manifest.url,
        version: manifest.version,
        checksum: manifest.checksum,
      });
      downloadedId = String(bundle.id ?? "");
    } catch {
      return; // فشل تنزيل/تحقق → نبقى على الحالي
    }
    if (!downloadedId) return;

    // 7) جدولته للتطبيق عند مغادرة التطبيق أو التشغيل القادم — لا إعادة تحميل الآن.
    try {
      await CapacitorUpdater.next({ id: downloadedId });
    } catch {
      return;
    }

    // 8) تنظيف الحزم القديمة (أفضل جهد، بلا أثر على الواجهة).
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
