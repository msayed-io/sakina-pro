# جدول الألوان الحية المعتمدة — ويدجت الصلاة

**المرجع الإلزامي للشكل:** `prayer-widget-design.html`
**مصدر كل لون:** `src/index.css` (ثيم التطبيق الحي) — **لا لون مُخترَع**

---

## جدول الأدوار × الوضعين

| الدور (متغير الـ HTML) | الوضع الفاتح | ملف:سطر | الوضع الداكن | ملف:سطر |
|---|---|---|---|---|
| `--bg` خلفية البطاقة | `#FDFCFB` | `index.css:902` (`--sk-bg3`) | `#1C1C1E` | `index.css:992` (`--sk-bg2`) |
| `--tile` سطح البلاطات | `#F7F2EA` | `index.css:901` (`--sk-bg2`) | `#2C2C2E` | `index.css:993` (`--sk-bg3`) |
| `--text` النص الأساسي | `#2B1A10` | `index.css:912` (`--sk-label`) | `#FFFFFF` | `index.css:1002` (`--sk-label`) |
| `--text2` النص الثانوي | `#7F6A55` | `index.css:913` (`--sk-label2`) | `#98989F` | `index.css:1003` (`--sk-label2` مركّب .60 على `#1C1C1E`) |
| `--accent` التمييز (واجهة) | `#B88A4F` | `index.css:918` (`--sk-accent`) | `#EEDFC2` | `index.css:1008` (`--sk-accent`) |
| `--accent` (نص «التالية») | `#8A6A3D` | `index.css:920` (`--sk-accent-deep`) | `#EEDFC2` | `index.css:1010` (`--sk-accent-deep`) |
| `--on-accent` النص فوق التمييز | `#2B1A10` | `index.css:921` (`--sk-on-accent`) | `#000000` | `index.css:1012` (`--sk-on-accent-soft`) |
| `--track` مسار الحلقة | `#E8DFD4` | `index.css:948` (`--sk-ring-track`) | `#353538` | `index.css:1038` (`rgba(235,235,245,.12)` مركّب على `#1C1C1E`) |

---

## قرارات التباين المعتمدة (WCAG AA)

### ① فَصل دور `--accent` إلى دورين

قيمة واحدة لا تصلح للدورين في الوضع الفاتح:

| الاستخدام | القيمة | على | النسبة | الحكم |
|---|---|---|---|---|
| تعبئة بلاطة + سمك القوس (عنصر واجهة، يحتاج 3:1) | `#B88A4F` | `#FDFCFB` | **3.02:1** | ✔ (WCAG 1.4.11) |
| نص «التالية» 13sp (يحتاج 4.5:1) | `#B88A4F` | `#FDFCFB` | 3.02:1 | ✘ |
| نص «التالية» 13sp | `#8A6A3D` | `#FDFCFB` | **4.87:1** | ✔ AA |

**القرار:** الكود يقرأ `sk_w_accent` للتعبئة والقوس، و`sk_w_accent_text` للنص.
في الوضع الداكن القيمتان متساويتان (`#EEDFC2`) لأن التباين 12.94:1 أصلاً.

### ② `--on-accent` في الوضع الداكن

`--sk-on-accent` الداكن = `#EEDFC2` = **نفس لون التعبئة** → نسبة **1.00:1**، أي نص غير مرئي.
استُخدم `--sk-on-accent-soft` = `#000000` (`index.css:1012`) → **15.97:1** ✔.

### ③ `--tile` بسلم الارتفاع

لا رمز واحد يصلح للوضعين:
- `--sk-bg2` فاتح = `#F7F2EA` (مرئي على البطاقة `#FDFCFB` ✔) لكنه داكن `#1C1C1E` = **نفس البطاقة** ✘
- `--sk-bg3` فاتح = `#FDFCFB` = **نفس البطاقة** ✘ لكنه داكن `#2C2C2E` (مرئي ✔)

**القرار:** في كل وضع نأخذ الرمز الذي يبعد خطوة عن لون البطاقة.

### ④ الزوايا

| البند | القاعدة | API 31+ |
|---|---|---|
| البطاقة | `28dp` | `@android:dimen/system_app_widget_background_radius` |
| البلاطات | `14dp` | `@android:dimen/system_app_widget_inner_radius` |

`system_app_widget_*` **ليست في `android.R$dimen`** (تحقق بـ `javap` على `android-34.jar`)،
فمرجعها في القاعدة العامة يفشل في ربط الموارد ويُسقِط البناء. لذلك:
`values/dimens.xml` = قيم ثابتة، `values-v31/dimens.xml` = مرجع النظام.

### ⑤ الخطوط

| الـ HTML | المتاح | الحل |
|---|---|---|
| 400 | Sans Regular (400) | مطابق |
| 500 (Medium) | — | أقرب متاح: Sans Regular (400) |
| 700 (Bold) | Sans Bold (700) · Serif Display Bold (700) | مطابق |
| 800 (ExtraBold) | — | أقرب متاح: Serif Display Black (900) |

لا خط آخر استُخدم. القيم مأخوذة من `OS/2.usWeightClass` لكل ملف OTF.

---

## تدقيق التباين الكامل

| العنصر | أمام | النسبة | AA (4.5) |
|---|---|---|---|
| فاتح: text → bg | `#2B1A10` | `#FDFCFB` | 16.29 | ✔ |
| فاتح: text2 → bg | `#7F6A55` | `#FDFCFB` | 5.00 | ✔ |
| فاتح: accentText → bg | `#8A6A3D` | `#FDFCFB` | 4.87 | ✔ |
| فاتح: onAccent → accent | `#2B1A10` | `#B88A4F` | 5.39 | ✔ |
| فاتح: text2 → tile | `#7F6A55` | `#F7F2EA` | 4.60 | ✔ |
| فاتح: text → tile | `#2B1A10` | `#F7F2EA` | 14.98 | ✔ |
| داكن: text → bg | `#FFFFFF` | `#1C1C1E` | 17.01 | ✔ |
| داكن: text2 → bg | `#98989F` | `#1C1C1E` | 5.94 | ✔ |
| داكن: accent → bg | `#EEDFC2` | `#1C1C1E` | 12.94 | ✔ |
| داكن: onAccent → accent | `#000000` | `#EEDFC2` | 15.97 | ✔ |
| داكن: text2 → tile | `#98989F` | `#2C2C2E` | 4.86 | ✔ |
| داكن: text → tile | `#FFFFFF` | `#2C2C2E` | 13.94 | ✔ |

**صفر إخفاق.** كل قيم الشفافية (`.55` للمنقضية، `.75` للشروق) مطبّقة عبر
`RemoteViews.setFloat(viewId, "setAlpha", value)` — تحقق بـ `javap` أنها موجودة.

---

## ملفات التنفيذ

| الدور | المورد |
|---|---|
| `--bg` | `@color/sk_w_page` |
| `--tile` | `@color/sk_w_tile` |
| `--text` | `@color/sk_w_text` |
| `--text2` | `@color/sk_w_text2` |
| `--accent` (واجهة) | `@color/sk_w_accent` |
| `--accent` (نص) | `@color/sk_w_accent_text` |
| `--on-accent` | `@color/sk_w_on_accent` |
| `--track` | `@color/sk_w_track` |

القيم في `res/values/colors.xml` (فاتح) و`res/values-night/colors.xml` (داكن).
التبديل تلقائي مع النظام — لا كود إضافي.
