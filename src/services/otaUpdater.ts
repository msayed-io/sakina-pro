/**
 * تحديثات الويب الصامتة (OTA) — معزولة تمامًا.
 *
 * الفكرة: تطبيق الأندرويد يحتوي طبقة ويب. عند كل تشغيل نتحقق من `version.json`
 * المنشور مع آخر إصدار. إن وُجدت نسخة أحدث (SemVer) نُنزّلها في الخلفية
 * ونطلب تطبيقها عند الخروج من التطبيق — بلا أي واجهة، وبلا إعادة تحميل أمام المستخدم.
 *
 * قواعد صلبة:
 *  - لا يعمل إلا داخل تطبيق أصلي (Capacitor.isNativePlatform()).
 *  - لا يرمي أخطاء أبدًا ولا يعطّل الإقلاع: كل شيء داخل try/catch صامت.
 *  - notifyAppReady() يُستدعى أول شيء في كل تشغيل، وإلا يتراجع البلوجن عن النسخة.
 *  - كل طلب شبكة يمرّ عبر CapacitorHttp (طبقة أصلية) لا عبر `fetch`:
 *    `fetch` داخل WebView يخضع لـCORS، وهو سبب تعطّل التحديث في v2.3.47.
 *  - التشخيص عبر `[SakinaOTA]` في logcat فقط، ولا يظهر للمستخدم أبدًا.
 */

import { Capacitor, CapacitorHttp } from "@capacitor/core";

/**
 * بيان الإصدار — من فرع التخزين `ota-bundle` مباشرة، لا من صفحة الـRelease.
 *
 * السبب الجذري لعطب v2.3.47 (مثبت بالقياس):
 *   https://github.com/.../releases/latest/download/version.json
 * ترد بسلسلة 302 مزدوجة:
 *   github.com → github.com/releases/download/<tag>/… → release-assets.githubusercontent.com
 * ولا يحمل أي منها ترويسة `Access-Control-Allow-Origin`. WebView يعتبر الأصل
 * `https://localhost` أصلًا مختلفًا، فيرمي `TypeError: Failed to fetch` قبل أن
 * يصل الجسم إلى JS — ويلتقطه catch الصامت، فلا يحدث تحديث أبدًا.
 *
 * القياس الفعلي من أصل مختلف:
 *   releases/latest/download/version.json → TypeError: Failed to fetch
 *   raw.githubusercontent.com/.../ota-bundle/... → 200 + CORS صالح
 *
 * لذلك: المصدر الأساسي = ota-bundle (raw)، والاحتياطي = رابط الـRelease
 * عبر CapacitorHttp (طبقة OkHttp الأصلية، تتجاوز CORS تمامًا).
 */
const BUNDLE_BRANCH_URL =
  "https://raw.githubusercontent.com/msayed-io/sakina-pro/ota-bundle";

/** نسخة البيان على فرع التخزين — المصدر الأساسي. */
const MANIFEST_URL = `${BUNDLE_BRANCH_URL}/version.json`;

/** الاحتياطي: نفس البيان المرفق مع الـRelease، يُجلب عبر طبقة أصلية. */
const MANIFEST_URL_FALLBACK =
  "https://github.com/msayed-io/sakina-pro/releases/latest/download/version.json";

/** وسم السجلات التشخيصية — يظهر في logcat فقط. */
const LOG = "[SakinaOTA]";

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

/**
 * معرّف الحزمة المجدولة للتطبيق (بعد نجاح `next`).
 *
 * لماذا نحتفظ به في الذاكرة: البلوجن ينفّذ `installNext()` من
 * `appMovedToBackground()` فقط (CapacitorUpdaterPlugin.java:5909). لو حدث التنزيل
 * *بعد* أن صار التطبيق في الخلفية (شائع: التنزيل يستغرق ثواني بينما المستخدم
 * خرج للتو)، فلا يصل حدث الخلفية مرة أخرى، و`next` ينتظر دورة حياة تالية.
 * لو قُتل التطبيق بالسحب قبل أي دورة تالية، لا شيء يقرأ `nextVersion` عند
 * الإقلاع البارد — يبقى الحالي كما هو.
 * لذلك: عند رؤية أي عودة للخلفية ونحن نملك حزمة مجدولة، نطلب `reload()`
 * صراحةً — وهو مسار يدعم الخلفية (`_reload()` → `reloadInBackground()`،
 * سطر 3274) ويثبّت الحزمة في `CAP_SERVER_PATH` عبر `setCurrentBundle()`
 * (CapgoUpdater.java:1698-1703) فتصمد أمام القتل وإعادة الفتح.
 */
let pendingBundleId = "";

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

/**
 * جلب البيان عبر طبقة الشبكة الأصلية (OkHttp على أندرويد).
 *
 * لماذا لا `fetch`؟ لأن WebView يقيّد `fetch` بسياسة CORS: صفحتنا تعمل على
 * `https://localhost`، وGitHub لا يرسل `Access-Control-Allow-Origin`، فيفشل
 * الطلب بـ`TypeError` قبل أن يقرأ. `CapacitorHttp` ينفّذ الطلب في Java خارج
 * محرّك الويب، ثم يُعيد الجسم عبر الجسر — فلا سياسة أصل مُطبَّقة إطلاقًا.
 *
 * ملاحظة: `data` يعود كائنًا مُحلَّلًا إذا كان رأس الاستجابة JSON، وقد يعود
 * نصًّا خامًا — نتعامل مع الحالتين.
 */
async function fetchManifestNative(url: string): Promise<OtaManifest | null> {
  // كاسر كاش: raw.githubusercontent.com يُخزَّن مؤقتًا ~5 دقائق عند الحافة،
  // فبلا هذا تظل النسخة القديمة تُقرأ بعد النشر مباشرة.
  const bustedUrl = `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}`;
  const response = await CapacitorHttp.get({
    url: bustedUrl,
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    connectTimeout: FETCH_TIMEOUT_MS,
    readTimeout: FETCH_TIMEOUT_MS,
  });
  if (response.status !== 200) {
    console.warn(`${LOG} HTTP ${response.status} ← ${url}`);
    return null;
  }
  let payload: unknown = response.data;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      console.warn(`${LOG} ردٌّ ليس JSON ← ${url}`);
      return null;
    }
  }
  if (!isManifest(payload)) {
    console.warn(`${LOG} بنية المانيفست غير صالحة ← ${url}`);
    return null;
  }
  return payload;
}

/**
 * مصدران بالترتيب: فرع `ota-bundle` (raw + CORS صالح) ثم الـRelease.
 * كلاهما يمرّ عبر الطبقة الأصلية، فلا يمكن لـCORS إسقاطهما.
 */
async function fetchManifest(): Promise<OtaManifest | null> {
  const sources = [MANIFEST_URL, MANIFEST_URL_FALLBACK];
  for (const url of sources) {
    try {
      const manifest = await fetchManifestNative(url);
      if (manifest) {
        console.info(`${LOG} البيان جاهز (${manifest.version}) ← ${url}`);
        return manifest;
      }
    } catch (error) {
      console.warn(`${LOG} فشل جلب البيان ← ${url}: ${String(error)}`);
    }
  }
  console.error(`${LOG} تعذّر جلب البيان من كل المصادر`);
  return null;
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

    console.info(
      `${LOG} فحص بدأ | native=${nativeVersion} bundle=${currentBundleVersion || "(builtin)"}`,
    );

    // 3) البيان المنشور.
    const manifest = await fetchManifest();
    if (!manifest) return;

    // 4) لا تنزيل إلا إذا كان الإصدار المنشور أحدث فعلًا.
    const baseline = currentBundleVersion || nativeVersion;
    if (compareVersions(manifest.version, baseline) <= 0) {
      console.info(`${LOG} لا جديد: المنشور ${manifest.version} ≤ المثبّت ${baseline}`);
      return;
    }

    // 5) حماية التوافق: لا نحمّل ويبًا يحتاج APK أحدث مما على الجهاز.
    if (
      manifest.minNativeVersion &&
      nativeVersion &&
      compareVersions(nativeVersion, manifest.minNativeVersion) < 0
    ) {
      console.info(
        `${LOG} تخطٍّ: البيان يحتاج native ${manifest.minNativeVersion} والجهاز ${nativeVersion}`,
      );
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
        if (diff.missingCount === 0) {
          console.info(`${LOG} لا ملفات مفقودة — الحزمة ${manifest.version} مطابقة محليًا`);
          return;
        }
        console.info(`${LOG} ملفات مفقودة: ${diff.missingCount} ← تنزيل تفاضلي`);

        const bundle = await CapacitorUpdater.download({
          url: manifest.url,
          version: manifest.version,
          checksum: fallbackChecksum(manifest),
          manifest: delta,
        });
        downloadedId = String(bundle.id ?? "");
        console.info(`${LOG} نُزّلت الحزمة التفاضلية ${manifest.version} id=${downloadedId}`);
      } catch (error) {
        console.warn(`${LOG} فشل التفاضلي، ننتقل للكامل: ${String(error)}`);
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
        console.info(`${LOG} نُزّلت الحزمة الكاملة ${manifest.version} id=${downloadedId}`);
      } catch (error) {
        console.error(`${LOG} فشل المسار الكامل: ${String(error)}`);
        return; // فشل المسارين → نبقى على الحالي بلا أي أثر
      }
    }
    if (!downloadedId) return;

    // 8) جدولته للتطبيق عند مغادرة التطبيق أو التشغيل القادم — لا إعادة تحميل الآن.
    try {
      await CapacitorUpdater.next({ id: downloadedId });
      pendingBundleId = downloadedId;
      console.info(`${LOG} جُدولت الحزمة للتطبيق عند الخروج للخلفية (id=${downloadedId})`);
    } catch (error) {
      console.error(`${LOG} فشل جدولة next: ${String(error)}`);
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

  // تطبيق الحزمة المجدولة عند مغادرة التطبيق — صراحةً، لا اعتمادًا على توقيت
  // حدث الخلفية الأصلي (انظر شرح `pendingBundleId` أعلاه).
  try {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "hidden") return;
      void applyPendingOnBackground();
    });
  } catch {
    /* تجاهل */
  }
}

/**
 * يطلب `reload()` بعد أن صارت الصفحة مخفيّة، فتطبّق الحزمة المجدولة في
 * الخلفية. `reload()` نفسه يطبّق `next` المعلّق (سطر 3317-3326) ثم يعيد
 * تحميل الـWebView وهو خلفي، فلا يراه المستخدم.
 */
async function applyPendingOnBackground(): Promise<void> {
  if (!pendingBundleId) return;
  try {
    const { CapacitorUpdater } = await import("@capgo/capacitor-updater");
    console.info(`${LOG} التطبيق في الخلفية — تطبيق الحزمة ${pendingBundleId}`);
    await CapacitorUpdater.reload();
    pendingBundleId = "";
    console.info(`${LOG} طُبّقت الحزمة المجدولة`);
  } catch (error) {
    console.warn(`${LOG} تعذّر التطبيق في الخلفية: ${String(error)}`);
  }
}
