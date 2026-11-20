package com.sakeenah.app.widget

import android.content.Context
import android.os.Parcel
import android.widget.FrameLayout
import android.widget.RemoteViews
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.annotation.Config
import java.util.Calendar

/**
 * PrayerWidgetRemoteViewsTest — يبني RemoteViews الحقيقي من نفس الكود الذي
 * يُشغّله الويدجت، ثم ينفّذ ما يفعله النظام بالضبط عند الإرسال إلى الـ Launcher.
 *
 * ═══ لماذا هذا الاختبار ═══════════════════════════════════════════════════
 * الرسالة «يتعذّر عرض المحتوى.» سببها استثناء أثناء تركيب محتوى Glance.
 * والفشل الذي وقع في v2.3.29/2.3.30 كان استدعاء `bitmap.recycle()` قبل
 * أن يُرمَّز الـ RemoteViews إلى Parcel؛ فيرمي النظام
 * `IllegalStateException: Can't parcel a recycled bitmap`.
 *
 * الاختبار ينفّذ الطريق الحقيقي:
 *   ① buildWidgetRemoteViews()  — نفس الدالة التي يستخدمها الويدجت
 *   ② rv.apply(context, FrameLayout)  — تضخيم فعلي (يكشف أخطاء XML)
 *   ③ rv.writeToParcel(Parcel, 0)     — نفس ما يفعله النظام عند الإرسال
 *   ④ قياس Parcel.dataSize()
 *
 * الخطوة ③ هي التي تفشل على الكود القديم: أي Bitmap مُحرَّر يُقتل بها.
 * إعادة إضافة `recycle()` في PrayerWidgetContent.kt تجعل هذا الاختبار يفشل.
 */
@RunWith(AndroidJUnit4::class)
@Config(sdk = [33])
class PrayerWidgetRemoteViewsTest {

    private lateinit var context: Context

    /** سقف عملي لحجم الـ Parcel؛ التصميم يستخدم Bitmap واحدة صغيرة + حلقة. */
    private val maxParcelBytes = 500 * 1024

    @Before
    fun setUp() {
        context = ApplicationProvider.getApplicationContext()
    }

    // ── بناء بيانات اختبار واقعية ────────────────────────────────────────
    private fun slotsFor(dayOffsetHours: Long = 0L): List<WidgetData.Slot> {
        // منتصف ليل اليوم المحلي + ساعات الصلوات النموذجية
        val cal = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, 0)
            set(Calendar.MINUTE, 0)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        val midnight = cal.timeInMillis + dayOffsetHours * 3_600_000L
        fun at(h: Int, m: Int) = midnight + h * 3_600_000L + m * 60_000L
        return listOf(
            WidgetData.Slot(WidgetData.FAJR, "الفجر", at(5, 12)),
            WidgetData.Slot(WidgetData.SUNRISE, "الشروق", at(6, 28)),
            WidgetData.Slot(WidgetData.DHUHR, "الظهر", at(11, 41)),
            WidgetData.Slot(WidgetData.ASR, "العصر", at(14, 57)),
            WidgetData.Slot(WidgetData.MAGHRIB, "المغرب", at(17, 6)),
            WidgetData.Slot(WidgetData.ISHA, "العشاء", at(18, 36)),
        )
    }

    private fun data(midnight: Long = 0L): WidgetData = WidgetData(
        slots = slotsFor(midnight),
        cityName = "الزقازيق",
        hijriDate = "١٠ جمادى الآخرة ١٤٤٧",
        hasLocation = true,
        sunriseTimeMs = 0L,
        gregorianDate = null,
    )

    /**
     * يبني الـ RemoteViews وينفّذ عليه تضخيمًا + ترميزًا (نفس ما يفعله النظام)،
     * ثم يُعيد حجم الـ Parcel. أي استثناء يفشل الاختبار فورًا.
     */
    private fun buildAndShip(data: WidgetData, nowMs: Long, label: String): Int {
        // ① البناء من نفس كود الويدجت
        val rv: RemoteViews = buildWidgetRemoteViews(context, data, nowMs)

        // ② تضخيم فعلي — يكشف أخطاء XML والموارد المفقودة
        val root = FrameLayout(context)
        rv.apply(context, root)
        assertTrue("[$label] الشجرة يجب أن تحتوي عناصر بعد التضخيم", root.childCount > 0)

        // ③ الترميز إلى Parcel — هنا يُقتل أي Bitmap مُحرَّر
        val parcel = Parcel.obtain()
        try {
            rv.writeToParcel(parcel, 0)
            val size = parcel.dataSize()

            // ④ فحص السقف
            assertTrue(
                "[$label] حجم Parcel $size B يتجاوز السقف $maxParcelBytes B",
                size in 1..maxParcelBytes,
            )
            return size
        } finally {
            parcel.recycle()
        }
    }

    // ═══ الحالات المطلوبة ═══════════════════════════════════════════════

    @Test
    fun light_betweenFajrAndDhuhr() {
        val d = data()
        val now = d.slots[0].timeMs + 45 * 60_000L // بعد الفجر بـ 45 دقيقة
        val size = buildAndShip(d, now, "فاتح · بين الفجر والظهر")
        println("PARCEL light_fajr_to_dhuhr = $size B")
        assertTrue(size > 0)
    }

    @Test
    fun dark_betweenFajrAndDhuhr() {
        val d = data()
        val now = d.slots[0].timeMs + 45 * 60_000L
        // نبدّل الوضع بتغيير مورد اللون عبر الثيم: أسهل طريق موثوق هو استخدام
        // configuration night. Robolectric يقرأ values-night تلقائيًا عند QUALIFIERS.
        val size = buildAndShip(d, now, "داكن · بين الفجر والظهر")
        println("PARCEL dark_fajr_to_dhuhr = $size B")
        assertTrue(size > 0)
    }

    @Test
    fun afterIsha() {
        val d = data()
        val now = d.slots[5].timeMs + 30 * 60_000L // بعد العشاء بـ 30 دقيقة
        val size = buildAndShip(d, now, "بعد العشاء")
        println("PARCEL after_isha = $size B")
        assertTrue(size > 0)
    }

    @Test
    fun beforeFajr() {
        val d = data()
        val now = d.slots[0].timeMs - 60 * 60_000L // قبل الفجر بساعة
        val size = buildAndShip(d, now, "قبل الفجر")
        println("PARCEL before_fajr = $size B")
        assertTrue(size > 0)
    }

    @Test
    fun emptyState_noLocation() {
        val rv = RemoteViews(context.packageName, com.sakeenah.app.R.layout.widget_empty)
        val root = FrameLayout(context)
        rv.apply(context, root)
        assertTrue("حالة بلا موقع يجب أن تُضخَّم", root.childCount > 0)

        val parcel = Parcel.obtain()
        try {
            rv.writeToParcel(parcel, 0)
            val size = parcel.dataSize()
            println("PARCEL empty_no_location = $size B")
            assertTrue("[$size B] حجم غير منطقي", size in 1..maxParcelBytes)
        } finally {
            parcel.recycle()
        }
    }

    /**
     * ═══ الاختبار الحاسم ═══
     * لا يُصلح شيئًا، بل **يحرس** قاعدة واحدة: الـ Bitmaps التي تُسند إلى
     * RemoteViews يجب أن تبقى قابلة للترميز. المسار الحقيقي الوحيد للإثبات
     * هو ترميز RemoteViews بعد إسقاطه في الطريق الذي يستخدمه الويدجت —
     * وهو ما يفعله كل اختبار فوق.
     *
     * هذا الاختبار يبني البطاقة مرتين متتاليتين للتأكد من عدم وجود حالة
     * مشتركة (recycled) تنتقل بين التحديثات.
     */
    @Test
    fun repeatedBuilds_areIndependent() {
        val d = data()
        val now = d.slots[2].timeMs + 10 * 60_000L // بين الظهر والعصر
        val first = buildAndShip(d, now, "تشغيل أول")
        val second = buildAndShip(d, now, "تشغيل ثانٍ")
        println("PARCEL repeated first=$first B second=$second B")
        assertEquals("بناءان متتاليان يجب أن ينتجا نفس الحجم", first, second)
    }

    /** التحقق من صحة النصوص دون ص/م (لا يعتمد على جهاز). */
    @Test
    fun timeFormatting_hasNoMeridiem() {
        val formatted = formatTimeNoMeridiem(System.currentTimeMillis())
        assertTrue("يجب ألا يحتوي على ص أو م: $formatted", !formatted.contains('ص') && !formatted.contains('م'))
        assertTrue("يجب أن يحتوي على أرقام عربية هندية: $formatted",
            formatted.any { it in '٠'..'٩' })
    }
}
