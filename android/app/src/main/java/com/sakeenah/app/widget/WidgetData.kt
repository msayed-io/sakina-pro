package com.sakeenah.app.widget

/**
 * WidgetData — العقد الوحيد بين الويدجت ومصدر الحقيقة.
 *
 * مصدر التعبئة: PrayerAlarmStore (SharedPreferences) — نفس القيم التي
 * جدولها التطبيق عبر AlarmScheduler، والمولّدة أصلًا من adhan-js.
 * الويدجت لا يحسب أي وقت بنفسه إطلاقًا.
 *
 * @property slots اليوم الكامل (بما مضى) مرتبًا تصاعديًا — يسمح بحساب
 *                 «الصلاة الحالية» و«القادمة» بدقة كما يفعل التطبيق.
 * @property cityName اسم المدينة كما يعرضه التطبيق (placeNameOnly).
 * @property hijriDate التاريخ الهجري نصًا جاهزًا.
 * @property hasLocation false = لم يحدد المستخدم موقعه → حالة فارغة آمنة.
 */
data class WidgetData(
    val slots: List<Slot>,
    val cityName: String?,
    val hijriDate: String?,
    val hasLocation: Boolean,
    val sunriseTimeMs: Long = 0L,
    val gregorianDate: String? = null,
) {
    /**
     * @property key fajr | sunrise | dhuhr | asr | maghrib | isha
     * @property name الاسم العربي كما في التطبيق
     * @property timeMs epoch milliseconds (مطلق — آمن لتغيير المنطقة الزمنية)
     */
    data class Slot(
        val key: String,
        val name: String,
        val timeMs: Long,
    ) {
        val isSunrise: Boolean get() = key == SUNRISE
        val isMandatory: Boolean get() = key in MANDATORY
    }

    /**
     * حالة البطاقة — مطابقة لما يحسبه التطبيق في
     * src/lib/prayer-times.ts (current → next).
     *
     * @property current الصلاة الجارية الآن (آخر صلاة دخل وقتها)
     * @property next الصلاة القادمة (أول صلاة لم يدخل وقتها)
     * @property progress نسبة ما مضى من الفترة [current → next] في 0..1
     * @property remainingMs ما تبقّى حتى [next] بالميلي ثانية
     */
    data class State(
        val current: Slot?,
        val next: Slot?,
        val progress: Float,
        val remainingMs: Long,
    )

    companion object {
        const val FAJR = "fajr"
        const val SUNRISE = "sunrise"
        const val DHUHR = "dhuhr"
        const val ASR = "asr"
        const val MAGHRIB = "maghrib"
        const val ISHA = "isha"

        /** ترتيب العرض في شريط المواقيت (مطابق App.tsx). */
        val DISPLAY_ORDER = listOf(FAJR, SUNRISE, DHUHR, ASR, MAGHRIB, ISHA)

        /** الصلوات المفروضة فقط — الشروق ليس صلاة (App.tsx:696). */
        val MANDATORY = setOf(FAJR, DHUHR, ASR, MAGHRIB, ISHA)

        val EMPTY = WidgetData(
            slots = emptyList(),
            cityName = null,
            hijriDate = null,
            hasLocation = false,
            gregorianDate = null,
        )
    }

    /** الصلاة القادمة = أول صلاة مفروضة بعد nowMs. */
    fun nextPrayer(nowMs: Long): Slot? =
        slots.firstOrNull { it.timeMs > nowMs && it.isMandatory }

    /** آخر صلاة مفروضة دخل وقتها (حتى لو من الأمس). */
    fun currentPrayer(nowMs: Long): Slot? =
        slots.lastOrNull { it.timeMs <= nowMs && it.isMandatory }

    /**
     * الحالة الكاملة للعرض.
     *
     * progress = (now − current) / (next − current) — نفس تعريف الحلقة
     * في البطاقة الأصلية (App.tsx:827 strokeDashoffset).
     * إذا غاب أحد الطرفين نرجع 0f بهدوء بدل قسمة على صفر.
     */
    fun stateAt(nowMs: Long): State {
        val next = nextPrayer(nowMs)
        val current = currentPrayer(nowMs)
        val remaining = next?.let { (it.timeMs - nowMs).coerceAtLeast(0L) } ?: 0L
        val progress = if (current != null && next != null && next.timeMs > current.timeMs) {
            val total = (next.timeMs - current.timeMs).toDouble()
            val elapsed = (nowMs - current.timeMs).toDouble()
            (elapsed / total).toFloat().coerceIn(0f, 1f)
        } else {
            0f
        }
        return State(current = current, next = next, progress = progress, remainingMs = remaining)
    }

    /** مواقيت اليوم — بترتيب العرض وبدون تكرار (يحتفظ بأول وقت لكل مفتاح). */
    fun todaySlots(nowMs: Long): List<Slot> {
        val dayStart = startOfLocalDay(nowMs)
        val dayEnd = dayStart + 24L * 60L * 60L * 1000L
        val today = slots.filter { it.timeMs in dayStart until dayEnd }
        if (today.isEmpty()) {
            // قد تكون البيانات من يوم آخر ( بعد منتصف الليل وقبل التحديث )
            return DISPLAY_ORDER.mapNotNull { key -> slots.firstOrNull { it.key == key } }
        }
        // نُفضّل مصدر اليوم، ونكمل من البقية إن غاب مفتاح (مثل الشروق)
        return DISPLAY_ORDER.mapNotNull { key ->
            today.firstOrNull { it.key == key } ?: slots.firstOrNull { it.key == key }
        }
    }

    /**
     * شريط المواقيت مضغوطًا ليلائم العرض الفعلي.
     *
     * سبب الحاجة: 6 خلايا على 250dp = ~41dp لكل خلية، وهذا أقل من
     * «الفجر» + التوقيت مع هامشٍ آمن. تقليص العدد يمنع القصّ نهائيًا.
     *
     * الترتيب المُفضّل في التفصيلي:
     *   • بعد صلاة → 4 التالية (نُظهر ما يهمّ فعلًا)
     *   • قبل الفجر → الفجر + التالية
     */
    fun upcomingSlots(nowMs: Long, limit: Int): List<Slot> =
        slots.filter { it.timeMs > nowMs }
            .sortedBy { it.timeMs }
            .distinctBy { it.key }
            .take(limit)
            .sortedBy { slot -> DISPLAY_ORDER.indexOf(slot.key).let { if (it < 0) 99 else it } }

    /** بداية اليوم المحلي — يساوي منتصف الليل في منطقة الجهاز. */
    private fun startOfLocalDay(nowMs: Long): Long {
        val cal = java.util.Calendar.getInstance()
        cal.timeInMillis = nowMs
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
        cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }
}
