package com.sakeenah.app.util

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Persists the exact prayer schedule produced by the React/Adhan layer.
 * Boot recovery must restore the same values that were scheduled before reboot;
 * it must not silently substitute a second calculation implementation.
 */
object PrayerAlarmStore {
    private const val PREFS_NAME = "sakeenah_prayer_alarm_store"
    private const val ENTRIES_KEY = "scheduled_prayers"

    // ── Widget metadata (additive only; no existing key is altered) ──────
    // Stored alongside the schedule so the home/lock-screen widget can show
    // sunrise, the city name and the Hijri date without recomputing anything.
    private const val KEY_SUNRISE_TIME_MS = "widget_sunrise_time_ms"
    private const val KEY_CITY_NAME = "widget_city_name"
    private const val KEY_HIJRI_DATE = "widget_hijri_date"
    private const val KEY_GREGORIAN_DATE = "widget_gregorian_date"
    private const val KEY_DAY_TIMES = "widget_day_times"

    data class Entry(
        val key: String,
        val name: String,
        val timeMs: Long,
        val schedulePrePrayer: Boolean = true,
        val schedulePrayerTime: Boolean = true,
        /**
         * نصّ الوقت كما تعرضه البطاقة الداخلية حرفيًا (أرقام هندية).
         * يُعرض في الويدجت كما هو بلا أي إعادة تنسيق — فلا مسار عرض ثانٍ.
         */
        val label: String? = null,
    )

    /** فجر اليوم التالي — يُستنتج من الأداة نفسها، لا يُخزَّن. */
    fun sunriseTimeMs(context: Context): Long =
        preferences(context).getLong(KEY_SUNRISE_TIME_MS, 0L)

    fun cityName(context: Context): String? =
        preferences(context).getString(KEY_CITY_NAME, null)?.takeIf { it.isNotBlank() }

    fun hijriDate(context: Context): String? =
        preferences(context).getString(KEY_HIJRI_DATE, null)?.takeIf { it.isNotBlank() }

    /** يقرأ قائمة اليوم المكتوبة من الويب، أو null إن لم تُكتب بعد. */
    @Synchronized
    fun dayTimes(context: Context): List<Entry>? {
        val raw = preferences(context).getString(KEY_DAY_TIMES, null) ?: return null
        return try {
            val json = JSONArray(raw)
            buildList {
                for (index in 0 until json.length()) {
                    val item = json.optJSONObject(index) ?: continue
                    val key = item.optString("key")
                    val name = item.optString("name")
                    val timeMs = item.optLong("timeMs", 0L)
                    val label = item.optString("label").takeIf { it.isNotBlank() }
                    if (key.isNotBlank() && name.isNotBlank() && timeMs > 0L) {
                        add(Entry(key, name, timeMs, label = label))
                    }
                }
            }.sortedBy { it.timeMs }
        } catch (_: Exception) {
            null
        }
    }

    fun gregorianDate(context: Context): String? =
        preferences(context).getString(KEY_GREGORIAN_DATE, null)?.takeIf { it.isNotBlank() }

    /**
     * يكتب بيانات الويدجت الإضافية. قيم null/0 = لا تغيير للقيمة السابقة غير
     * موجودة؛ نستخدم remove صراحةً حتى تبقى الحالة الفارغة الآمنة ممكنة.
     */
    @Synchronized
    fun writeWidgetMetadata(
        context: Context,
        sunriseTimeMs: Long?,
        cityName: String?,
        hijriDate: String?,
        gregorianDate: String? = null,
    ) {
        val editor = preferences(context).edit()
        if (sunriseTimeMs != null && sunriseTimeMs > 0L) {
            editor.putLong(KEY_SUNRISE_TIME_MS, sunriseTimeMs)
        } else {
            editor.remove(KEY_SUNRISE_TIME_MS)
        }
        if (!cityName.isNullOrBlank()) editor.putString(KEY_CITY_NAME, cityName) else editor.remove(KEY_CITY_NAME)
        if (!hijriDate.isNullOrBlank()) editor.putString(KEY_HIJRI_DATE, hijriDate) else editor.remove(KEY_HIJRI_DATE)
        if (!gregorianDate.isNullOrBlank()) editor.putString(KEY_GREGORIAN_DATE, gregorianDate) else editor.remove(KEY_GREGORIAN_DATE)
        editor.apply()
    }

    @Synchronized
    fun replace(context: Context, entries: List<Entry>) {
        val json = JSONArray()
        entries
            .filter { it.key.isNotBlank() && it.name.isNotBlank() && it.timeMs > 0L }
            .forEach { entry ->
                json.put(JSONObject().apply {
                    put("key", entry.key)
                    put("name", entry.name)
                    put("timeMs", entry.timeMs)
                    put("schedulePrePrayer", entry.schedulePrePrayer)
                    put("schedulePrayerTime", entry.schedulePrayerTime)
                })
            }
        preferences(context).edit().putString(ENTRIES_KEY, json.toString()).apply()
    }

    @Synchronized
    fun upsert(context: Context, entry: Entry) {
        val entries = load(context).filterNot { it.key == entry.key }.toMutableList()
        entries += entry
        replace(context, entries)
    }

    /**
     * مواقيت اليوم كاملة (بما مضى) — يكتبها الجانب الويب من نفس
     * prayerSchedule الذي يغذّي البطاقة الأصلية. صفر حساب هنا.
     */
    @Synchronized
    fun writeDayTimes(context: Context, entries: List<Entry>) {
        val json = JSONArray()
        for (entry in entries) {
            json.put(
                JSONObject().apply {
                    put("key", entry.key)
                    put("name", entry.name)
                    put("timeMs", entry.timeMs)
                    entry.label?.let { put("label", it) }
                }
            )
        }
        preferences(context).edit().putString(KEY_DAY_TIMES, json.toString()).apply()
    }

    /**
     * قائمة اليوم الكاملة — **بما مضى**.
     *
     * سبب الوجود: loadFuture يُسقط ما مضى، فكان الويدجت يعرض «—» لكل
     * وقت سابق. البطاقة الأصلية تعرض مواقيت اليوم كاملة، فلزم مصدر
     * يحتفظ بالماضي. (عيب مؤكَّد في v2.3.27)
     */
    @Synchronized
    fun loadDay(context: Context): List<Entry> {
        // المصدر الأدق أولًا: القائمة الكاملة القادمة من الويب.
        dayTimes(context)?.let { if (it.isNotEmpty()) return it }

        val cal = java.util.Calendar.getInstance()
        cal.set(java.util.Calendar.HOUR_OF_DAY, 0)
        cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0)
        cal.set(java.util.Calendar.MILLISECOND, 0)
        val dayStart = cal.timeInMillis
        val dayEnd = dayStart + 25L * 60L * 60L * 1000L
        return load(context)
            .filter { it.timeMs in (dayStart - 6L * 60L * 60L * 1000L) until dayEnd }
            .sortedBy { it.timeMs }
    }

    @Synchronized
    fun loadFuture(context: Context, nowMs: Long = System.currentTimeMillis()): List<Entry> {
        return load(context)
            .filter { it.timeMs > nowMs }
            .sortedBy { it.timeMs }
    }

    @Synchronized
    fun clear(context: Context) {
        // Only the schedule entries are cleared here. Widget metadata is
        // independent so a cancelled schedule leaves the widget in its
        // safe empty state rather than showing stale city/Hijri values.
        preferences(context).edit().remove(ENTRIES_KEY).apply()
    }

    private fun load(context: Context): List<Entry> {
        val raw = preferences(context).getString(ENTRIES_KEY, null) ?: return emptyList()
        return try {
            val json = JSONArray(raw)
            buildList {
                for (index in 0 until json.length()) {
                    val item = json.optJSONObject(index) ?: continue
                    val key = item.optString("key")
                    val name = item.optString("name")
                    val timeMs = item.optLong("timeMs", 0L)
                    val schedulePrePrayer = item.optBoolean("schedulePrePrayer", true)
                    val schedulePrayerTime = item.optBoolean("schedulePrayerTime", true)
                    if (key.isNotBlank() && name.isNotBlank() && timeMs > 0L) {
                        add(Entry(key, name, timeMs, schedulePrePrayer, schedulePrayerTime))
                    }
                }
            }
        } catch (_: Exception) {
            emptyList()
        }
    }

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
