/**
 * Sakinah — screen inventory for the scroll-ownership audit.
 *
 * This app has NO URL router: tabs and sub-screens are a React state machine
 * rooted in src/App.tsx (TabType: main | azkar | quran | hadith | sakeenah-ai | settings)
 * with sub-routers in QuranTabScreen (currentScreen), HadithBooksScreen (viewMode)
 * and SakinaLibraryScreen (view) — plus full-screen fixed overlays
 * (AzkarCounter / AsmaAlHusna / PrayerSettings / SakinaLibrary / Player).
 *
 * The list below is transcribed from that source, never from memory. Every
 * entry declares its scroll owner per the spec's §3 table:
 *   - "document": the document is the single scroller (no internal container).
 *   - "panel":    a fixed overlay panel owns scrolling (document untouched).
 * Any screen not reachable inside the app in this environment is listed at the
 * bottom with a reason — it is NOT counted as PASS.
 */
export const screens = [
  { name: 'main',            owner: 'document', label: 'الرئيسية' },
  { name: 'quran',           owner: 'document', label: 'القرآن (قائمة القراء)' },
  { name: 'surahs',          owner: 'document', label: 'القرآن (سور القارئ)' },
  { name: 'hadith',          owner: 'document', label: 'الكتب / الحديث' },
  { name: 'azkar',           owner: 'document', label: 'الأذكار' },
  { name: 'sakeenah-ai',     owner: 'document', label: 'سكينة AI (شاشة الدخول عند عدم الدخول)' },
  { name: 'settings',        owner: 'document', label: 'الإعدادات' },
  { name: 'prayer-settings', owner: 'panel',    label: 'إعدادات الصلاة (لوحة ثابتة)' },
  { name: 'azkar-counter',   owner: 'panel',    label: 'عداد الأذكار (لوحة ثابتة)' },
  { name: 'asma-al-husna',   owner: 'panel',    label: 'أسماء الله الحسنى (لوحة ثابتة)' },
  { name: 'sakina-library',  owner: 'panel',    label: 'مكتبة سكينة (لوحة ثابتة)' },
  { name: 'player',          owner: 'fixed',    label: 'مشغل القرآن (ثابتة، غير قابلة للتمرير)' },
];

/** Intentionally not audited, with root-cause reasons (never silently skipped): */
export const notAudited = [
  { name: 'quran-reader', reason: 'يتطلب نسخ مصحف محمّل على الجهاز — غير قابل للوصول في headless.' },
  { name: 'map-picker', reason: 'يعرض خريطة OSM/CARTO — طلبات الشبكة تُحظر/تُجهض في البيئة.' },
  { name: 'battery-modal', reason: 'يظهر فقط على Android مع تحسين البطارية مفعّل — لا يظهر في headless.' },
  { name: 'shared-conversation', reason: 'يتطلب رابط مشاركة صالح (token) من الخادم.' },
];
