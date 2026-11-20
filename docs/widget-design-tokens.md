# Widget Design Tokens — سَكِينَة

> استخراج حرفي من الكود الحي. كل قيمة مذكورة مع `ملف:سطر`.
> المرجع البصري: **بطاقة الصلاة الحالية** في الشاشة الرئيسية (`src/App.tsx:1223`), مادة `cut-crystal-satin`.

---

## 1. المادة البصرية الأساسية — `cut-crystal-satin`

المصدر: `src/index.css:232-255`

### الوضع الفاتح (`:root`)
| الخاصية | القيمة الحرفية | ملف:سطر |
|---|---|---|
| الخلفية (تدرّج) | `linear-gradient(180deg, rgba(253,252,251,0.93) 0%, rgba(248,245,240,0.86) 100%)` | `index.css:234-238` |
| حدّ | `1px solid rgba(43, 26, 16, 0.08)` | `index.css:241` |
| ظلّ | `0 10px 28px -10px rgba(43,26,16,0.10), inset 0 1px 0 0 rgba(255,255,255,0.95)` | `index.css:242-243` |
| نصف قطر الزوايا | `28px` | `index.css:244` |

### الوضع الداكن (`html[data-theme="dark"]`)
| الخاصية | القيمة الحرفية | ملف:سطر |
|---|---|---|
| الخلفية | `rgba(28, 28, 30, 0.90)` | `index.css:1145` |
| blur | `blur(30px) saturate(180%)` | `index.css:1146-1147` |
| حدّ | `transparent` | `index.css:1148` |
| ظلّ | `var(--sk-amb-card)` = `0 14px 34px rgba(0,0,0,0.55)` | `index.css:1064` |
| نصف قطر | `28px` (نفسه) | `index.css:244` |

**ملاحظة تنفيذية:** `RemoteViews` لا يدعم `backdrop-filter`. البديل: **سطح صلب شبه معتم** بنفس التدرّج + ظلًّا مكافئًا. الحجم يمنع استخدام صورة PNG كخلفية (§ قيود الذاكرة).

---

## 2. نظام الألوان الدلالي (`--sk-*`)

المصدر: `src/index.css:893-1150`

| الدور البصري | الوضع الفاتح | ملف:سطر | الوضع الداكن | ملف:سطر |
|---|---|---|---|---|
| **خلفية الصفحة** | `#ece7de` | `index.css:898` | `#000000` | `index.css:991` |
| **سطح البطاقة (bg2)** | `#f7f2ea` | `index.css:899` | `#1C1C1E` | `index.css:992` |
| **سطح مرفوع (bg3)** | `#fdfcfb` | `index.css:900` | `#2C2C2E` | `index.css:993` |
| **حدّ فاصل (sep)** | `#e6dccf` | `index.css:902` | `rgba(84,84,88,0.6)` | `index.css:996` |
| **حدّ صلب** | `#ddd2c4` | `index.css:903` | `#38383A` | `index.css:997` |
| **النص الأساسي** | `#2b1a10` | `index.css:911` | `#FFFFFF` | `index.css:1004` |
| **النص الثانوي** | `#7f6a55` | `index.css:912` | `rgba(235,235,245,0.60)` | `index.css:1005` |
| **النص الثالث** | `#a39282` | `index.css:913` | `rgba(235,235,245,0.30)` | `index.css:1006` |
| **لون التمييز (accent)** | `#b88a4f` | `index.css:917` | `#EEDFC2` (Parchment Ivory) | `index.css:1012` |
| **accent-bright** | `#deab65` | `index.css:918` | `#EEDFC2` | `index.css:1013` |
| **نص فوق accent** | `#2b1a10` | `index.css:920` | `#EEDFC2` | `index.css:1015` |
| **حشوة صغيرة (fill4)** | `rgba(43,26,16,0.05)` | `index.css:910` | `rgba(116,116,128,0.18)` | `index.css:1002` |
| **زجاج** | `rgba(253,252,251,0.78)` | `index.css:931` | `rgba(44,44,46,0.64)` | `index.css:1031` |
| **مسطّح (solid)** | `#fdfcfb` | `index.css:932` | `#2C2C2E` | `index.css:1032` |
| **مسار الحلقة** | `#e8dfd4` | `index.css:957` | `rgba(235,235,245,0.12)` | `index.css:1049` |
| **قوس التقدّم** | `var(--sk-label)` → `#2b1a10` | `index.css:984` | `#EEDFC2` | `index.css:1084` |

### الألوان الدلالية (تُحفظ عائلاتها الأصلية)
| الدور | فاتح | داكن |
|---|---|---|
| danger | `#c94a4a` | `#FF4245` |
| warning | `#b45309` | `#FF9230` |
| success | `#4d6342` | `#30D158` |

**استخدامها في الويدجت:** عدّ تنازلي < 10 دقائق → `danger` (لمسة دلالية مشروعة، من نفس عائلة التطبيق).

---

## 3. الخطوط العربية

### المصدر الحي
| العائلة | الأصل (ويب) | الوزن | الاستخدام في التطبيق |
|---|---|---|---|
| `Thmanyah Sans` | `public/fonts/thmanyahsans-Regular.woff2` | 400 | body — `index.css:16` |
| `Thmanyah Sans` | `public/fonts/thmanyahsans-Bold.woff2` | 700 | عناوين صغيرة — `index.css:24` |
| `Thmanyah Serif Display` | `public/fonts/thmanyahserifdisplay-Bold.woff2` | 700 | `font-display` — `index.css:48` |
| `Thmanyah Serif Display` | `public/fonts/thmanyahserifdisplay-Black.woff2` | 900 | اسم الصلاة (28px) — `App.tsx:1230` |

### التحويل إلى موارد أندرويد
الخطوط الأصلية **WOFF2 + CFF** — لا يقرأها Android من `res/font`.
تم تحويلها بـ fontTools (إزالة ضغط WOFF2 فقط، بلا أي إعادة رسم):

```
android/app/src/main/res/font/
├── thmanyah_sans_regular.otf            (235 KB) ← thmanyahsans-Regular.woff2
├── thmanyah_sans_bold.otf               (237 KB) ← thmanyahsans-Bold.woff2
├── thmanyah_serif_display_bold.otf      (241 KB) ← thmanyahserifdisplay-Bold.woff2
└── thmanyah_serif_display_black.otf     (242 KB) ← thmanyahserifdisplay-Black.woff2
```

**تحقق التغطية العربية (مُثبَت بـ fontTools getBestCmap):**
| الملف | glyphs | Arabic block | Presentation forms | Arabic-Indic digits | Latin |
|---|---|---|---|---|---|
| thmanyah_sans_regular.otf | 411 | 72 | 111 | 10 | 58 |
| thmanyah_sans_bold.otf | 411 | 72 | 111 | 10 | 58 |
| thmanyah_serif_display_bold.otf | 416 | 72 | 111 | 10 | 58 |
| thmanyah_serif_display_black.otf | 416 | 72 | 111 | 10 | 58 |

**القرار المعماري:** استخدام `res/font` + `AndroidFont` مباشرة عبر `TextView` في `AndroidRemoteViews` — **لا Bitmap**.
- صفر ذاكرة صورة (لا `Bitmap` إطلاقًا → لا احتمال `TransactionTooLargeException`).
- تشكيل عربي كامل من محرك النظام (Harfbuzz) بالأشكال المتصلة الأصلية.
- يتبع الوضع تلقائيًا عبر `TextColor`.

---

## 4. أبعاد وتناسق البطاقة (مستخرجة)

| العنصر | القيمة | المصدر |
|---|---|---|
| نصف قطر البطاقة | `28px` → في الويدجت `26dp` (مراعاة `system_app_widget_background_radius`) | `index.css:244` |
| حشوة البطاقة | `p-5` = `20px` | `App.tsx:1223` |
| حجم اسم الصلاة | `28px` font-black | `App.tsx:1230` |
| لون العدّاد | `text-[11px] tabular-nums` | `App.tsx:1274` |
| لون الفاصل | `#e6dccf/60` → `dark:[--sk-sep]/60` | `App.tsx:1264` |
| التاريخ | `text-[11px] font-bold` | `App.tsx:1265` |
| حلقة التقدّم | 80×80px، strokeWidth 6 | `App.tsx:1235` |
| المسافة بين السطور | `mt-1.5 / mt-4` | `App.tsx:1233,1264` |

---

## 5. خريطة أحجام الويدجت

| المقاس | الخلايا | الأبعاد | المحتوى |
|---|---|---|---|
| **مدمج** | 4x1 | ~250×72 dp | اسم الصلاة القادمة + وقتها + Chronometer + التاريخ الهجري |
| **تفصيلي** | 4x2 | ~250×150 dp | ما سبق + شريط المواقيت الست + المدينة |

`SizeMode.Responsive` بـ set من ثلاث أحجام لضمان الاستجابة على كل المشغّلات:
```kotlin
setOf(
    DpSize(250.dp, 60.dp),   // 4x1
    DpSize(250.dp, 120.dp),  // 4x2
    DpSize(180.dp, 60.dp),   // احتياطي لمشغّل يقلّص
)
```

---

## 6. الثيم

المصدر: `index.html` inline script + `src/index.css:5`
- المبدأ: **`prefers-color-scheme` فقط. لا toggle. لا تخزين تفضيل.**
- في أندرويد الأصلي: `Configuration.uiMode & UI_MODE_NIGHT_MASK`.
- `MainActivity` يمنع التعتيم الخوارزمي (`setAlgorithmicDarkeningAllowed(false)`) — الويدجت يقرأ الثيم بنفسه.

---

## 7. المراجع الرسمية (تم التحقق منها بالبحث الفعلي — 20 نوفمبر 2026)

| المرجع | القيمة المؤكدة |
|---|---|
| [Glance releases](https://developer.android.com/jetpack/androidx/releases/glance) | **Stable = 1.2.0 (26 أغسطس 2026)** |
| Glance 1.3.0-alpha01 | ⚠️ يتطلب AGP ≥ 9.2.0 (compileSdk 37) → **مستبعد** (المشروع AGP 8.13.0) |
| [Create an app widget with Glance](https://developer.android.com/develop/ui/compose/glance/create-app-widget) | `widgetCategory` (home_screen \| keyguard) + إدارة ذاكرة الصور |
| [GlanceAppWidget API](https://developer.android.com/reference/kotlin/androidx/glance/appwidget/GlanceAppWidget) | `providePreview(context, widgetCategory)` — API إلزامي لمعاينة شاشة القفل |
| [AppWidgetProviderInfo](https://developer.android.com/reference/android/appwidget/AppWidgetProviderInfo) | `WIDGET_CATEGORY_KEYGUARD=2`, `WIDGET_CATEGORY_NOT_KEYGUARD=8` (API 36) |

### إصدارات البيئة الفعلية (مقروءة من ملفات المشروع)
| البند | القيمة | الملف:سطر |
|---|---|---|
| AGP | `8.13.0` | `android/build.gradle:11` |
| Kotlin | `2.1.0` | `android/build.gradle:13` |
| Gradle | `8.14.3` | `gradle-wrapper.properties:3` |
| compileSdk | `36` | `variables.gradle:4` |
| targetSdk | `36` | `variables.gradle:5` |
| minSdk | `24` | `variables.gradle:3` |
| Compose BOM | `2024.06.00` | `app/build.gradle:73` |
| JVM target | `21` (workflow JDK) | `.github/workflows/...:60` |

### توافق Glance 1.2.0
POM المُتحقَّق منه: يعتمد `compose runtime 1.7.8` / `ui-graphics 1.6.0` (لا `ui`).
المشروع يستخدم `compose BOM 2024.06.00` (compose-ui 1.6.8).
**نتيجة:** أفضل توافق = `implementation platform("androidx.compose:compose-bom:2025.05.00")` لأنها ترفع `ui` إلى 1.8.x و`runtime` إلى 1.8+ (متوافقة تصاعديًا). نستخدم `constraints` صريحة بدلًا من رفع BOM كاملًا لتفادي أي أثر على الـ Dynamic Island.
