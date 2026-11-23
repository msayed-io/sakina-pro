/**
 * دلالات صفحة الأذكار الجديدة — منطق خالص بلا JSX وبلا أنماط.
 *
 * كل ما هنا مشتق من منظومات التطبيق الحقيقية:
 *  - التوبات الأربعة → `azkarData` (أعداد حقيقية)
 *  - حصن المسلم      → `hisnAlMuslimFull.json` (132 بابًا · 267 ذكرًا)
 *  - يوميات المسلم   → `dailyTracker` (12 مهمة بفواصل زمنية)
 *  - الأيقونات       → دالة `getHisnCategoryStyle` القائمة في AzkarTabScreen
 *
 * لا تُصدَّر أي بيانات تجريبية من ملف التصميم.
 */

/* ------------------------------------------------------------------ */
/* تصنيف الحصن — فرع لكل شرط في getHisnCategoryStyle                    */
/* ------------------------------------------------------------------ */

export type HisnKind =
  | "m" // صباح / مساء / نوم / استيقاظ
  | "s" // صلاة / أذان / مسجد
  | "h" // منزل / بيت
  | "t" // خلاء / وضوء
  | "d" // ثوب / لبس / استخارة / زواج
  | "p" // الفرع الافتراضي في التطبيق (BookOpen)
  | "food"
  | "travel"
  | "distress"
  | "illness"
  | "protection"
  | "weather";

/**
 * تصنيف الشيبس — بترتيب شروط `getHisnCategoryStyle` نفسه (الأول يفوز).
 * يُستخدم للتجميع في الشيبس وللفلترة فقط.
 */
export function hisnKind(category: string): HisnKind {
  if (category.includes("صباح")) return "m";
  if (category.includes("مساء")) return "m";
  if (category.includes("نوم")) return "m";
  if (category.includes("استيقاظ")) return "m";
  if (category.includes("صلاة")) return "s";
  if (category.includes("أذان")) return "s";
  if (category.includes("مسجد")) return "s";
  if (category.includes("منزل") || category.includes("بيت")) return "h";
  if (category.includes("خلاء") || category.includes("وضوء")) return "t";
  if (category.includes("طعام") || category.includes("شرب")) return "food";
  if (category.includes("ثوب") || category.includes("لبس")) return "d";
  if (category.includes("سفر") || category.includes("ركوب")) return "travel";
  if (category.includes("هم") || category.includes("حزن") || category.includes("كرب"))
    return "distress";
  if (category.includes("استخارة") || category.includes("زواج")) return "d";
  if (category.includes("مريض") || category.includes("مرض")) return "illness";
  if (category.includes("شيطان") || category.includes("دجال") || category.includes("حفظ"))
    return "protection";
  if (category.includes("مطر") || category.includes("رعد") || category.includes("ريح"))
    return "weather";
  return "p";
}

/**
 * أيقونة الصف — مأخوذة **حرفيًا** من `getHisnCategoryStyle` في التطبيق،
 * بنفس ترتيب شروطها. لا تُشتق من تصنيف الشيبس حتى لا تتكرر الأيقونات:
 * الصباح والشمس، والمساء والقمر، والنوم والهلال، والاستيقاظ والشروق.
 */
export function hisnIcon(category: string): string {
  if (category.includes("صباح")) return "Sun";
  if (category.includes("مساء")) return "Moon";
  if (category.includes("نوم")) return "MoonStar";
  if (category.includes("استيقاظ")) return "Sunrise";
  if (category.includes("صلاة") || category.includes("أذان") || category.includes("مسجد"))
    return "MapPin";
  if (category.includes("منزل") || category.includes("بيت")) return "Home";
  if (category.includes("خلاء") || category.includes("وضوء")) return "Activity";
  if (category.includes("طعام") || category.includes("شرب")) return "Utensils";
  if (category.includes("ثوب") || category.includes("لبس")) return "User";
  if (category.includes("سفر") || category.includes("ركوب")) return "Car";
  if (category.includes("هم") || category.includes("حزن") || category.includes("كرب"))
    return "AlertCircle";
  if (category.includes("استخارة") || category.includes("زواج")) return "Heart";
  if (category.includes("مريض") || category.includes("مرض")) return "BriefcaseMedical";
  if (category.includes("شيطان") || category.includes("دجال") || category.includes("حفظ"))
    return "Shield";
  if (category.includes("مطر") || category.includes("رعد") || category.includes("ريح"))
    return "CloudRain";
  return "BookOpen";
}

/**
 * لون الصف — الطرف الفاتح من تدرّج `getHisnCategoryStyle` الحقيقي.
 * المتغيّرات `--sk-…` حيث يستخدمها التطبيق توكنات؛ والباقي قيم hex صريحة
 * موجودة في كود التطبيق نفسه (لا اختراع).
 */
export function hisnColor(category: string): string {
  if (category.includes("صباح") || category.includes("استيقاظ"))
    return "var(--sk-accent-bright)";
  if (category.includes("مساء")) return "#8ca1b3";
  if (category.includes("نوم")) return "#8e859c";
  if (category.includes("صلاة") || category.includes("أذان") || category.includes("مسجد"))
    return "var(--sk-success-soft)";
  if (category.includes("منزل") || category.includes("بيت")) return "#c49b7e";
  if (category.includes("خلاء") || category.includes("وضوء")) return "#969fa8";
  if (category.includes("طعام") || category.includes("شرب")) return "#c98e61";
  if (category.includes("ثوب") || category.includes("لبس")) return "#a68292";
  if (category.includes("سفر") || category.includes("ركوب")) return "#7799ad";
  if (category.includes("هم") || category.includes("حزن") || category.includes("كرب"))
    return "#b87a7a";
  if (category.includes("استخارة") || category.includes("زواج")) return "#a68292";
  if (category.includes("مريض") || category.includes("مرض")) return "#b87a7a";
  if (category.includes("شيطان") || category.includes("دجال") || category.includes("حفظ"))
    return "#8e859c";
  if (category.includes("مطر") || category.includes("رعد") || category.includes("ريح"))
    return "#7799ad";
  return "#a3a88a";
}

/* ------------------------------------------------------------------ */
/* خصائص التصنيف: التسمية + الأيقونة + اللون                            */
/* ------------------------------------------------------------------ */

export type HisnKindStyle = {
  label: string;
  /** لون الشيبس المحدد — من ألوان الفئات الحقيقية. */
  color: string;
};

export const HISN_KIND_STYLE: Record<HisnKind, HisnKindStyle> = {
  m: { label: "الصباح والنوم", color: "var(--sk-accent-bright)" },
  t: { label: "الطهارة", color: "#969fa8" },
  h: { label: "المنزل", color: "#c49b7e" },
  s: { label: "المسجد", color: "var(--sk-success-soft)" },
  d: { label: "اللباس", color: "#a68292" },
  p: { label: "الصلاة", color: "#a3a88a" },
  food: { label: "الطعام", color: "#c98e61" },
  travel: { label: "السفر", color: "#7799ad" },
  distress: { label: "الهم والحزن", color: "#b87a7a" },
  illness: { label: "المرض", color: "#b87a7a" },
  protection: { label: "الحفظ", color: "#8e859c" },
  weather: { label: "المطر والريح", color: "#7799ad" },
};

/** ترتيب ظهور الشيبس = ترتيب أول ظهور لكل تصنيف في بيانات الحصن. */
export function hisnKindOrder(categories: string[]): HisnKind[] {
  const seen: HisnKind[] = [];
  for (const category of categories) {
    const kind = hisnKind(category);
    if (!seen.includes(kind)) seen.push(kind);
  }
  return seen;
}

/* ------------------------------------------------------------------ */
/* النصوص والأرقام — مطابقة لصيغة ملف التصميم حرفيًا                    */
/* ------------------------------------------------------------------ */

/** أرقام عربية-هندية كما في `toLocaleString('ar-EG')` بالملف. */
export function ar(value: number): string {
  return value.toLocaleString("ar-EG");
}

/** صيغة عدّ الأذكار: 1 → «ذكر واحد»، 2 → «ذكران»، ≤10 → «N أذكار»، وإلا «N ذكرًا». */
export function countLabel(count: number): string {
  if (count === 1) return "ذكر واحد";
  if (count === 2) return "ذكران";
  if (count <= 10) return `${ar(count)} أذكار`;
  return `${ar(count)} ذكرًا`;
}

/**
 * تطبيع البحث — منسوخ من `norm` في الملف حرفيًا:
 * إزالة التشكيل والتطويل، توحيد الألف والهاء والياء.
 */
export function normalizeSearch(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي");
}

/* ------------------------------------------------------------------ */
/* فواصل اليوميات                                                      */
/* ------------------------------------------------------------------ */

export type DailyBand = { label: string; start: number; end: number };

/**
 * تقسيم المهام الـ12 — مطابق لمصفوفة `G` في الملف حرفيًا:
 * الصباح 0–3 (4 مهام)، النهار 4–6 (3)، الليل 7–12 (5).
 */
export const DAILY_BANDS: DailyBand[] = [
  { label: "الصباح", start: 0, end: 4 },
  { label: "النهار", start: 4, end: 7 },
  { label: "الليل", start: 7, end: 12 },
];

/** الشريحة الافتراضية حسب الساعة، كما في `tab = h<12?0 : h<17?1 : 2`. */
export function initialBand(hour: number): number {
  return hour < 12 ? 0 : hour < 17 ? 1 : 2;
}

/**
 * علامة إنجاز بطاقة من التوبات الأربعة — مطابقة لمصفوفة `CAT` في الملف:
 * صحاب/مساء ← المهمتان 2 و6 (فهرس صفري)، النوم ← 10، بعد الصلاة ← بلا علامة.
 * القيمة -1 تعني: البطاقة لا تحمل علامة إنجاز.
 */
export const CATEGORY_TASK_MARK: Record<string, number> = {
  morning: 2,
  evening: 6,
  sleep: 10,
  post_prayer: -1,
};

/** عدد الأبواب المعروضة قبل «عرض باقي الأبواب». */
export const HISN_PAGE_SIZE = 7;
