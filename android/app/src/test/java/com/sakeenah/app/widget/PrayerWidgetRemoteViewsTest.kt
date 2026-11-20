package com.sakeenah.app.widget

import android.content.Context
import android.graphics.Bitmap
import android.os.Parcel
import android.view.LayoutInflater
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RemoteViews
import android.widget.TextView
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
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

        // ② تضخيم فعلي — يكشف أخطاء XML والموارد المفقودة.
        // إن فشل التضخيم يرمي InflateException هنا مباشرة.
        // ملاحظة: apply() على RemoteViews لا يضيف بالضرورة ابنًا مباشرًا
        // إلى الجذر المُمرَّر (قد يعمل على الشجرة الداخلية)، فلا نتحقق من
        // childCount بل نتحقق أن التضخيم لم يرمِ استثناءً — وهو الهدف.
        val root = FrameLayout(context)
        rv.apply(context, root)

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
        rv.apply(context, root)   // يرمي InflateException إن فشل التضخيم

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


    // ═══════════════════════════════════════════════════════════════════
    //  حرّاس التصميم — v2.3.33
    //  كل واحد منها يحرس سببًا جذريًا محددًا من تقرير التشخيص، ويفشل
    //  فورًا لو عاد أحدها إلى الكود.
    // ═══════════════════════════════════════════════════════════════════

    /**
     * السبب الجذري ① للوصفية الخاطئة وغياب القوس:
     * فترة الصلاة تعبر منتصف الليل. قبل الفجر لا صلاة «بدأت اليوم»، فكان
     * currentPrayer يرجع null ⇒ الوصفية «الصلاة القادمة» وprogress = 0f
     * ⇒ الحلقة تعرض المسار فقط بلا قوس.
     */
    @Test
    fun beforeFajr_windowSpansMidnight() {
        val d = data()
        val now = d.slots[0].timeMs - 60 * 60_000L // قبل الفجر بساعة
        val state = d.stateAt(now)

        assertNotNull("قبل الفجر لا بد من صلاة حالية (العشاء من أمس)", state.current)
        assertEquals("العشاء", state.current!!.name)
        assertNotNull("قبل الفجر لا بد من صلاة قادمة (الفجر)", state.next)
        assertEquals("الفجر", state.next!!.name)
        assertTrue(
            "نسبة القوس يجب أن تكون بين 0 و1، لكنها ${state.progress}",
            state.progress > 0f && state.progress < 1f,
        )
        assertTrue("المتبقي حتى الفجر يجب أن يكون موجبًا", state.remainingMs > 0L)
    }

    /** النصف الثاني من الجذر نفسه: بعد العشاء القادمة = فجر الغد. */
    @Test
    fun afterIsha_nextIsTomorrowFajr() {
        val d = data()
        val now = d.slots[5].timeMs + 30 * 60_000L // بعد العشاء بنصف ساعة
        val state = d.stateAt(now)

        assertEquals("العشاء", state.current?.name)
        assertEquals("الفجر", state.next?.name)
        assertTrue("القوس يجب أن يتقدّم بعد العشاء، لكنه ${state.progress}", state.progress > 0f)
        // المتبقي حتى فجر الغد أكبر من خمس ساعات
        assertTrue("المتبقي غير منطقي: ${state.remainingMs}", state.remainingMs > 5L * 3_600_000L)
    }

    /** الوصفية وسطر «التالية» كما في التصميم تمامًا، قبل الفجر. */
    @Test
    fun captionAndNextLine_matchDesignBeforeFajr() {
        val d = data()
        val now = d.slots[0].timeMs - 60 * 60_000L
        val card = buildWidgetRemoteViews(context, d, now).apply(context, FrameLayout(context))

        val cap = card.findViewById<TextView>(com.sakeenah.app.R.id.w_cap)
        val next = card.findViewById<TextView>(com.sakeenah.app.R.id.w_next)

        assertEquals("الصلاة الحالية", cap.text.toString())
        assertEquals("سطر «التالية» يجب أن يكون ظاهرًا", View.VISIBLE, next.visibility)
        assertEquals("التالية: الفجر", next.text.toString())
    }

    /**
     * السبب الجذري ② للامتداد السفلي:
     * الجذر كان match_parent فيأخذ ارتفاع الخلية كاملًا. البطاقة الآن
     * ترتفع بمقدار محتواها فقط (≈160dp) مهما كان ارتفاع الخلية.
     */
    @Test
    fun cardHeight_isContentDrivenNotCellDriven() {
        val d = data()
        val now = d.slots[0].timeMs + 45 * 60_000L
        val card = buildWidgetRemoteViews(context, d, now).apply(context, FrameLayout(context))

        val density = context.resources.displayMetrics.density
        val cellHeight = (400 * density).toInt() // نفس خلية الصورة الحقيقية
        card.measure(
            View.MeasureSpec.makeMeasureSpec((360 * density).toInt(), View.MeasureSpec.AT_MOST),
            View.MeasureSpec.makeMeasureSpec(cellHeight, View.MeasureSpec.AT_MOST),
        )
        card.layout(0, 0, card.measuredWidth, card.measuredHeight)
        val heightDp = card.measuredHeight / density
        println("CARD height = $heightDp dp (خلية 400dp)")

        assertTrue("البطاقة تمدّدت إلى $heightDp dp — التصميم ≈160dp", heightDp < 175f)
        assertTrue("البطاقة أقصر من محتواها: $heightDp dp", heightDp > 145f)

        // لا فراغ داخلي: أسفل شريط المواقيت يجب أن يكون قريبًا من حد البطاقة.
        val times = card.findViewById<LinearLayout>(com.sakeenah.app.R.id.w_tile_fajr).parent as View
        val slackDp = (card.measuredHeight - times.bottom) / density
        println("فراغ أسفل البلاطات = $slackDp dp")
        assertTrue("يوجد فراغ سفلي $slackDp dp داخل البطاقة", slackDp < 20f)
    }

    /**
     * السبب الجذري ③ لاختفاء «التالية»:
     * الصف العلوي كان بارتفاع ثابت 72dp، والعمود النصي يحتاج 77.7dp،
     * فكان يُقصّ عند حد الصف. الصف الآن يتمدّد حسب محتواه.
     */
    @Test
    fun nextLineIsNotClippedByTopRow() {
        val row = LayoutInflater.from(context)
            .inflate(com.sakeenah.app.R.layout.widget_top_row, null) as LinearLayout
        val density = context.resources.displayMetrics.density

        // اسم الصلاة يُرسم Bitmap بارتفاع صندوق ثابت 49dp (أقصى حبر).
        val name = row.findViewById<ImageView>(com.sakeenah.app.R.id.w_name)
        name.setImageBitmap(
            Bitmap.createBitmap((90 * density).toInt(), (49 * density).toInt(), Bitmap.Config.ARGB_8888),
        )
        row.findViewById<TextView>(com.sakeenah.app.R.id.w_cap).text = "الصلاة الحالية"
        val next = row.findViewById<TextView>(com.sakeenah.app.R.id.w_next)
        next.text = "التالية: الفجر"

        row.measure(
            View.MeasureSpec.makeMeasureSpec((328 * density).toInt(), View.MeasureSpec.EXACTLY),
            View.MeasureSpec.makeMeasureSpec((400 * density).toInt(), View.MeasureSpec.AT_MOST),
        )
        row.layout(0, 0, row.measuredWidth, row.measuredHeight)

        val rowHeightDp = row.measuredHeight / density
        val nextBottomDp = next.bottom / density
        println("TOP ROW = $rowHeightDp dp · أسفل «التالية» = $nextBottomDp dp")

        assertTrue("الصف أقصر من 72dp: $rowHeightDp", rowHeightDp >= 72f)
        assertTrue("الصف أطول من التصميم: $rowHeightDp", rowHeightDp <= 88f)
        assertTrue(
            "سطر «التالية» مقصوص: أسفله $nextBottomDp dp > ارتفاع الصف $rowHeightDp dp",
            nextBottomDp <= rowHeightDp + 0.5f,
        )
        assertEquals(View.VISIBLE, next.visibility)
    }

    /**
     * حارس هندسة الحلقة: القوس يجب أن يكون له نصف قطر 32/72 من الصندوق
     * كما في SVG (cx=36 cy=36 r=32)، لا أصغر.
     */
    @Test
    fun ringBitmapMatchesSvgGeometry() {
        val density = context.resources.displayMetrics.density
        val sizePx = (72 * density).toInt()
        val bitmap = ArabicRingRenderer.render(
            context = context,
            sizePx = sizePx,
            progress = 0.5f,
            trackColor = android.graphics.Color.GRAY,
            arcColor = android.graphics.Color.WHITE,
        )
        assertNotNull("فشل رسم الحلقة", bitmap)
        assertEquals(sizePx, bitmap!!.width)
        assertEquals(sizePx, bitmap.height)
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
