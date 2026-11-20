package com.sakeenah.app.widget

/**
 * WidgetData — العقد الوحيد بين الويدجت ومصدر الحقيقة.
 *
 * مصدر التعبئة: PrayerAlarmStore (SharedPreferences) — نفس القيم التي
 * جدولها التطبيق عبر AlarmScheduler. الويدجت لا يحسب أي وقت بنفسه.
 *
 * @property slots قائمة المواقيت مرتبة تصاعديًا حسب [Slot.timeMs]،
 *                 وتحتوي فقط الأوقات المستقبلية عند البناء.
 * @property cityName اسم المدينة كما يعرضه التطبيق.
 * @property hijriDate التاريخ الهجري نصًا جاهزًا (formatHijriDate في JS).
 * @property hasLocation false = لم يحدد المستخدم موقعه بعد → الحالة الفارغة الآمنة.
 */
data class WidgetData(
    val slots: List<Slot>,
    val cityName: String?,
    val hijriDate: String?,
    val hasLocation: Boolean,
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
    }

    companion object {
        const val FAJR = "fajr"
        const val SUNRISE = "sunrise"
        const val DHUHR = "dhuhr"
        const val ASR = "asr"
        const val MAGHRIB = "maghrib"
        const val ISHA = "isha"

        /** ترتيب العرض في شريط المواقيت (يطابق App.tsx:518-525). */
        val DISPLAY_ORDER = listOf(FAJR, SUNRISE, DHUHR, ASR, MAGHRIB, ISHA)

        /** الصلوات المفروضة فقط (الشروق ليس صلاة). */
        val MANDATORY = setOf(FAJR, DHUHR, ASR, MAGHRIB, ISHA)

        val EMPTY = WidgetData(
            slots = emptyList(),
            cityName = null,
            hijriDate = null,
            hasLocation = false,
        )
    }

    /**
     * الصلاة القادمة = أول مقطع مفروض يكون وقته بعد nowMs.
     * الشروق لا يصلح أن يكون "الصلاة القادمة" لأنه ليس صلاة.
     */
    fun nextPrayer(nowMs: Long): Slot? =
        slots.firstOrNull { it.timeMs > nowMs && it.key in MANDATORY }

    /** مواقيت اليوم الست للعرض في المقاس التفصيلي. */
    fun todaySlots(): List<Slot> =
        DISPLAY_ORDER.mapNotNull { key -> slots.firstOrNull { it.key == key } }
}
