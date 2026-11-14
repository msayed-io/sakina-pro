# تقرير تتبع تسجيل الدخول في Android

**التاريخ:** 2026-11-14
**النطاق:** استعادة جلسة Google OAuth داخل تطبيق Android، مع مقارنة مسار الويب.

## الحالة المباشرة لمشروع Supabase

تم التحقق عبر اتصال Supabase الرسمي من أن مشروع `sakinah` (`vmidpocwksqdvsyrvcog`) حالته الحالية `ACTIVE_HEALTHY`، ورابط المشروع يطابق النطاق المستخدم في التطبيق. أظهرت سجلات Auth في نافذة التجربة طلبات تحويل إلى Google (`302`) وحدث PKCE ناجحًا (`HTTP 200`) في 2026-11-14 11:07 UTC. السجل لا يميّز نوع العميل الذي أجرى التبادل الناجح، لذلك لا يمكن نسبته قطعًا إلى Android أو الويب. ولم تظهر في السجلات المستخرجة أخطاء PKCE صريحة.

في الفحص الأولي كان DNS من بيئة التنفيذ يعيد NXDOMAIN، لكن لوحة Supabase/API الرسمية تؤكد أن المشروع عاد الآن نشطًا؛ نتيجة DNS السابقة كانت غير كافية للحكم على حالة المشروع ولا ينبغي اعتبارها السبب الحالي.

## نتائج فحص التطبيق

- الويب يستخدم Supabase Auth وGoogle OAuth من نفس المشروع؛ بحسب تجربة المالك يعمل تسجيل الدخول على الويب.
- إعداد Android في المصدر يستخدم `com.sakeenah.app://auth/callback`، ومرشح `AndroidManifest.xml` يطابق scheme/host/path. التطبيق يستخدم `singleTask` وCapacitor App plugin.
- خدمة المصادقة كانت تستقبل callback من مصدرين: حدث `appUrlOpen` و`App.getLaunchUrl()`، ثم تستبدل رمز PKCE بالجلسة من دون منع معالجة الرمز نفسه بالتوازي. إذا وصل الرابط نفسه من المصدرين يمكن بدء عمليتي exchange لرمز أحادي الاستخدام؛ إحداهما قد تنجح والأخرى تفشل وتعيد الحالة إلى شاشة الدخول. هذا مسار سببي محتمل ومدعوم بوجود الاستدعاءين غير المحميين في الكود، لكنه لا يمكن إثبات أنه حدث في جهاز المستخدم من السجلات المتاحة.
- التطبيق كان يتجاهل query parameters الخاصة بأخطاء OAuth في callback الأصلي، ويحوّل فشل exchange إلى `onSession(null)` مع تسجيله في console فقط. لذلك يبقى المستخدم على صفحة الدخول بلا تفسير.
- زر Google كان يبقى في حالة التحميل بعد عودة التطبيق من المتصفح إذا لم تصل جلسة؛ لم يكن هناك reset عند عودة التطبيق إلى foreground.

## التغيير المحدود المنفذ

1. منع تبادل رمز callback نفسه أكثر من مرة: تخزين عمليات PKCE الجارية والرموز المكتملة في مستمع Android، مع تجاهل duplicate delivery.
2. التقاط `error` و`error_description` في رابط العودة وتمرير فشل آمن إلى واجهة الدخول بدل تجاهله.
3. التعامل الآمن مع نتيجة `App.getLaunchUrl()` الفارغة، ومنع أخطاء destructuring غير المعالجة.
4. عند رجوع Android إلى foreground، إلغاء مؤشر التحميل حتى يمكن للمستخدم إعادة المحاولة؛ وعند فشل callback تظهر رسالة عربية تطلب إعادة المحاولة والتحقق من رابط Android في Supabase.
5. إضافة GitHub Actions workflow محدود لبناء APK تجريبي من `main` ورفعه كـartifact. لا ينشئ Release ولا يستخدم مفتاح توقيع إنتاج.

## التحقق

- فحص `git diff --check`: سليم.
- مدقق workflow المحلي: سليم بلا أخطاء، وجميع GitHub Actions مثبتة على commit SHA.
- فحص TypeScript: ملفات المصادقة المعدلة لا تضيف أخطاء؛ يوجد خطأ سابق/منفصل في `src/services/QuranMediaService.ts:91` بسبب توقيع callback.
- تعثرت المحاولة الأولى من CI عند تنزيل Android SDK بسبب طلب الحزمة القديمة `tools`؛ عُدّل الإعداد إلى `platform-tools` فقط.
- المحاولة الثانية بنت web assets ونجحت في مزامنة Capacitor، ثم فشل Gradle برسالة `invalid source release: 21` لأن الـworkflow استخدم Java 17. جرى تحديث الـworkflow إلى Java 21؛ يلزم run جديد للتحقق النهائي.
- لا يوجد emulator أو جهاز Android متصل في هذه الجلسة، لذلك يلزم اختبار callback على الهاتف باستخدام APK الناتج. بناء APK وحده لا يثبت نجاح الدخول النهائي.

## قيود الإصدار

تم التحقق من أن الـworkflow ينفذ `assembleDebug` فقط؛ لذلك هو لا يبني Release. يحتوي `android/app/build.gradle` على توقيع Release مشروط بمتغيرات البيئة `SAKEENAH_RELEASE_KEYSTORE` و`SAKEENAH_RELEASE_STORE_PASSWORD` و`SAKEENAH_RELEASE_KEY_ALIAS` و`SAKEENAH_RELEASE_KEY_PASSWORD`، لكن الـworkflow الحالي لا يمرر هذه القيم ولا ينفذ `assembleRelease`. الناتج المقصود APK تجريبي debug، وليس تحديثًا موقعًا بمفتاح الإنتاج؛ لم يُرفع APK أو إصدار إلى متجر. يلزم إعداد keystore وبياناته في GitHub Actions secrets/Environment قبل بناء Release قابل للتوزيع أو الترقية فوق تطبيق موقّع سابقًا.
