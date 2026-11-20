# Widget Data Flow — سَكِينَة

> مصدر الحقيقة، نقاط الربط، وسلوك الحالات الحدّية.
> **القاعدة الذهبية:** الويدجت **لا يحسب** أي مواقيت. يقرأ أرقامًا جاهزة أنتجها التطبيق.

---

## 1. مصدر الحقيقة

### السلسلة الكاملة (مقروءة سطرًا بسطر)

```
src/App.tsx:759   getPrayerTimeline(location, method, now, asrSchool)
                       ↓  (adhan-js — المرجع الوحيد)
                  timeline.augmentedSchedule  (6 صلوات: فجر، شروق، ظهر، عصر، مغرب، عشاء)
                  timeline.current / timeline.next
                       ↓
src/App.tsx:599    prayerSchedule (اليوم)  +  src/App.tsx:613  tomorrowSchedule (الغد)
                       ↓  src/App.tsx:695-702  دمج + إزالة التكرار + استثناء "sunrise"
src/App.tsx:709    PrayerNotificationsService.syncPrayerSchedule({ prayers, ... })
                       ↓
src/services/PrayerNotificationsService.ts:110
                  PrayerAlarmService.scheduleAllPrayers(nativePrayers)
                       ↓
src/services/PrayerAlarmService.ts:91
                  callPlugin('scheduleAllPrayers', { prayers })
                       ↓  (Capacitor bridge)
android/.../plugin/PrayerAlarmPlugin.kt:71
                  scheduler.scheduleAllPrayers(prayers)
                  PrayerAlarmStore.replace(context, prayers)      ← ★ الكتابة النهائية
                       ↓
android/.../util/PrayerAlarmStore.kt:15
                  SharedPreferences("sakeenah_prayer_alarm_store")
                  key "scheduled_prayers" → JSON array
```

### الشكل الفعلي المخزَّن (`PrayerAlarmStore.Entry`)
```json
[
  { "key": "fajr",    "name": "الفجر",  "timeMs": 1763618400000, "schedulePrePrayer": true, "schedulePrayerTime": true },
  { "key": "dhuhr",   "name": "الظهر",  "timeMs": 1763643600000, ... },
  { "key": "asr",     "name": "العصر",  "timeMs": 1763656200000, ... },
  { "key": "maghrib", "name": "المغرب","timeMs": 1763667000000, ... },
  { "key": "isha",    "name": "العشاء", "timeMs": 1763670600000, ... }
]
```

**حقائق مثبتة من الكود:**
1. `sunrise` **مستثنى صراحة** — `App.tsx:696`: `.filter((prayer) => prayer.key !== "sunrise" && prayer.date)`
2. الصلوات **اليوم + الغد** معًا — `App.tsx:695`: `[...prayerSchedule, ...tomorrowSchedule]`
3. `timeMs` هو **الطابع الزمني المطلق** (epoch ms) وليس وقت اليوم → **آمن تمامًا لتغيير المنطقة الزمنية**
4. `PrayerAlarmStore` تحفظ **فقط** ما بعد `Date.now()` — `PrayerNotificationsService.ts:88`
5. الاستبعاد يحدث قبل الحفظ → الويدجت يرى فقط الصلوات المفروضة الخمس

---

## 2. ما يحتاجه الويدجت ولا يوجد في `PrayerAlarmStore`

| البيانات | لماذا نحتاجها | البديل |
|---|---|---|
| **الشروق** | مطلوب في شريط 4x2 | مستثنى من الـ Store → **نضيفه في نفس نقطة الربط** |
| **اسم المدينة** | مطلوب في 4x2 | غير مخزَّن أصليًا → نمرره |
| **التاريخ الهجري** | مطلوب في 4x1 و4x2 | يُحسب في JS (`formatHijriDate`) → نمرره نصًا جاهزًا |

### القرار: توسيع عقد `scheduleAllPrayers` بحقول اختيارية
هذا هو **أقل تعديل جراحي ممكن**:
- لا ملف جديد للربط
- لا مسار كتابة ثانٍ (لا احتمال تعارض)
- `PrayerNotificationsService` → `PrayerAlarmService` → `PrayerAlarmPlugin` → `PrayerAlarmStore` (سلسلة واحدة موجودة أصلًا)

**التغيير:** 3 معاملات اختيارية (`sunriseTimeMs`, `cityName`, `hijriDate`) تُضاف كـ extras في JSON وتُقرأ في `PrayerAlarmStore` كـ metadata. حقول جديدة فقط — **لا حقل قائم يُلمس**.

---

## 3. نقاط الربط (Hooks) — أين نستدعي `updateAll()`

| # | الحدث | الموقع الدقيق | نوع التعديل |
|---|---|---|---|
| 1 | **تغيير المواقيت/الموقع/التاريخ** | `PrayerAlarmPlugin.scheduleAllPrayers()` بعد `PrayerAlarmStore.replace()` | سطر واحد: `PrayerWidgetUpdater.requestUpdate(context)` |
| 2 | **انتهاء وقت صلاة** | `AlarmReceiver.ACTION_PRAYER_ALARM` (موجود ومجدول بالملي ثانية) | سطر واحد في نفس الـ receiver |
| 3 | **إعادة تشغيل الهاتف** | `BootReceiver` بعد `scheduler.scheduleAllPrayers()` | سطر واحد |
| 4 | **تغيير حجم الويدجت** | `PrayerWidgetReceiver.onAppWidgetOptionsChanged()` | override قياسي في Glance |
| 5 | **منتصف الليل** | ❌ **غير مطلوب** — التاريخ الهجري يُمرَّر نصًا ويُحدَّث عند أي فتح للتطبيق | — |
| 6 | **تغيّر المنطقة الزمنية** | لا تأثير — `timeMs` مطلق (epoch) | — |
| 7 | **تغيّر الثيم** | `Configuration.uiMode` — يتعامل تلقائيًا في Glance | — |

**النتيجة: صفر `AlarmManager` جديد. صفر `WorkManager`. صفر مؤقّت خلفي.**

السبب: التطبيق **بالفعل** يضع `setExactAndAllowWhileIdle` على كل صلاة (`AlarmScheduler.kt:295`). الويدجت يركب على هذه الإشارات المجدولة مسبقًا = تكلفة بطارية صفرية إضافية.

---

## 4. العدّ التنازلي — صفر استهلاك

```
Chronometer (RemoteViews, CountDown=true)
  base = SystemClock.elapsedRealtime() + (nextPrayerTimeMs - System.currentTimeMillis())
```

- `Chronometer` **مكوّن نظام** يديره `SurfaceFlinger`/`ViewRootImpl` بلا أي wakeup.
- **لا** `Handler.postDelayed`، **لا** `CoroutineScope(while true)`، **لا** `setInterval`.
- عند الوصول للصفر: يبقى عند `00:00` حتى وصول التحديث المجدول من `AlarmReceiver` (وهو مجدول على نفس الثانية).

**المرجع الرسمي:** `android.widget.Chronometer.setCountDown(boolean)` — متاح API 24+ (تطابق `minSdk=24`).

---

## 5. الحالات الحدّية (كل حالة مع سلوك محدد)

| الحالة | الشرط | سلوك الويدجت |
|---|---|---|
| **أ) لا يوجد موقع بعد** | `PrayerAlarmStore` فارغ | نص: «افتح سَكِينَة لتحديد موقعك» + أيقونة تقويم. لا أصفار وهمية. |
| **ب) بعد العشاء وقبل منتصف الليل** | `now > isha` و`fajr` الغد موجود | «الفجر» + عدّاد نحو `fajr` الغد (موجود في الـ Store لأن التطبيق يرسل الغد أيضًا) |
| **ج) بعد منتصف الليل وقبل الفجر** | `now < fajr(اليوم)` | «الفجر» + التاريخ الهجري الجديد (يُحدَّث عند فتح التطبيق) |
| **د) بين صلاة والتي تليها** | عادي | الصلاة القادمة + عدّادها |
| **هـ) الويدجت بعد 24 ساعة من آخر فتح** | الـ Store يحتوي أمس فقط | تبقى آخر قيم معروفة (لا انهيار). التطبيق يُحدِّث عند فتحه. **موثَّق كقيد معروف**. |
| **و) `timeMs` سالب أو 0** | بيانات تالفة | `PrayerAlarmStore` تفلتر أصلًا (`timeMs > 0L`) → حالة (أ) |

---

## 6. الثيم

```kotlin
val isDark = (context.resources.configuration.uiMode and
              Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
```
- نفس مصدر الحقيقة الذي يقرأه WebView (`prefers-color-scheme` = `uiMode` على أندرويد).
- لا تخزين، لا toggle — يطابق ميثاق الوضع الداكن (`DARK_MODE_CHARTER.md`).

---

## 7. الأذونات

**لا أذونات جديدة.** الويدجت يقرأ من `SharedPreferences` داخل نفس عملية التطبيق، ويفتح `MainActivity` عند اللمس.

| القدرة | مطلوب؟ |
|---|---|
| `INTERNET` | ❌ (موجود أصلًا للتطبيق فقط) |
| `ACCESS_FINE_LOCATION` | ❌ (موجود أصلًا للتطبيق فقط) |
| `FOREGROUND_SERVICE` | ❌ |
| `SCHEDULE_EXACT_ALARM` | ❌ (مستخدَم أصلًا — لا نطلب زيادة) |
| `BIND_APPWIDGET` | ❌ (اختياري، للتحديث المباشر فقط — غير ضروري) |
