package com.sakeenah.app.plugin

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.sakeenah.app.util.AlarmScheduler
import com.sakeenah.app.util.PrayerScheduleEntry
import com.sakeenah.app.util.MuezzinHelper
import com.sakeenah.app.util.PrayerPreferencesReader
import com.sakeenah.app.util.PrayerAlarmStore
import com.sakeenah.app.widget.PrayerWidgetUpdater
import android.util.Log

/**
 * PrayerAlarmPlugin — Capacitor bridge to the native AlarmScheduler.
 *
 * This plugin replaces the unreliable Capacitor LocalNotifications with
 * native Android Exact Alarms that survive Doze Mode and App Standby.
 *
 * Methods:
 * - scheduleAllPrayers: Schedule all prayers for today
 * - cancelAll: Cancel all scheduled alarms
 * - canScheduleExactAlarms: Check if SCHEDULE_EXACT_ALARM permission is granted
 * - requestExactAlarmPermission: Open settings to grant the permission
 */
@CapacitorPlugin(name = "PrayerAlarm")
class PrayerAlarmPlugin : Plugin() {

    companion object {
        private const val TAG = "PrayerAlarmPlugin"
    }

    private lateinit var scheduler: AlarmScheduler

    override fun load() {
        super.load()
        scheduler = AlarmScheduler(context)
    }

    /**
     * Schedule all prayers for today.
     *
     * Expected parameters:
     * {
     *   "prayers": [
     *     {"key": "fajr", "name": "الفجر", "timeMs": 1754400000000},
     *     ...
     *   ]
     * }
     */
    @PluginMethod
    fun scheduleAllPrayers(call: PluginCall) {
        try {
            // بيانات الويدجت تُحفظ أولًا وقبل أي بوابة صلاحيات — انظر updateWidget.
            persistWidgetData(call)

            val prayersArray = call.getArray("prayers")
            val prayers = mutableListOf<PrayerScheduleEntry>()

            for (i in 0 until (prayersArray?.length() ?: 0)) {
                val prayer = prayersArray?.getJSONObject(i)
                val key = prayer?.getString("key") ?: ""
                val name = prayer?.getString("name") ?: ""
                val timeMs = prayer?.getLong("timeMs") ?: 0L
                val schedulePrePrayer = prayer?.optBoolean("schedulePrePrayer", true) ?: true
                val schedulePrayerTime = prayer?.optBoolean("schedulePrayerTime", true) ?: true
                if (key.isNotEmpty() && name.isNotEmpty() && timeMs > 0) {
                    prayers.add(PrayerScheduleEntry(key, name, timeMs, schedulePrePrayer, schedulePrayerTime))
                }
            }

            if (prayers.isEmpty()) {
                call.reject("No valid prayers provided")
                return
            }
            if (!scheduler.canScheduleExactAlarms()) {
                call.reject("Exact alarm capability is not enabled")
                return
            }

            scheduler.scheduleAllPrayers(prayers)
            PrayerAlarmStore.replace(
                context,
                prayers.map { prayer ->
                    PrayerAlarmStore.Entry(
                        prayer.key,
                        prayer.name,
                        prayer.timeMs,
                        prayer.schedulePrePrayer,
                        prayer.schedulePrayerTime,
                    )
                }
            )
            Log.d(TAG, "Scheduled ${prayers.size} prayers")

            // ── Widget hook ──────────────────────────────────────────────
            // البيانات كُتبت بالفعل في persistWidgetData أعلى الدالة؛
            // هنا نعيد الرسم فقط ليقرأ الويدجت الجدول الجديد.
            PrayerWidgetUpdater.requestUpdate(context)

            call.resolve(JSObject().apply {
                put("success", true)
                put("count", prayers.size)
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to schedule all prayers", e)
            call.reject("Failed to schedule all prayers: ${e.message}")
        }
    }

    /**
     * ═══ ربط الويدجت بمصدر الحقيقة (v2.3.34) ══════════════════════════════
     * يقرأ بيانات الويدجت التي أرسلتها طبقة الويب (نفس قيم حساب التطبيق
     * الداخلي حرفيًا) ويحفظها في PrayerAlarmStore ثم يطلب إعادة رسم.
     *
     * ❗ لماذا دالة مستقلة؟ لأن هذه البيانات كانت تُحفظ **بعد** بوابتين لا
     * علاقة لهما بالويدجت في scheduleAllPrayers:
     *   • prayers.isEmpty()            → reject
     *   • !scheduler.canScheduleExactAlarms() → reject
     * ومع بوابات JS (إذن الإشعارات + futurePrayers فارغة) كان الويدجت
     * يبقى على بيانات قديمة إلى ما لا نهاية — وهو سبب اختلاف مواقيته عن
     * مواقيت التطبيق. الآن تُكتب البيانات دائمًا، مستقلة عن أي إذن.
     *
     * @return عدد المواقيت المكتوبة (0 = لم تُرسل dayTimes، فلا نمسح القديم)
     */
    private fun persistWidgetData(call: PluginCall): Int {
        val sunriseTimeMs = call.getLong("sunriseTimeMs", 0L) ?: 0L
        val cityName = call.getString("cityName")
        val hijriDate = call.getString("hijriDate")
        val gregorianDate = call.getString("gregorianDate")

        // مواقيت اليوم (وغدًا إن أرسلتها الويب) — يستهلكها شريط المواقيت.
        // نداء prayers يحمل المستقبل فقط، فهذا مسار مستقل بلا أي حساب.
        val dayTimesArray = call.getArray("dayTimes")
        val dayTimes = mutableListOf<PrayerAlarmStore.Entry>()
        for (i in 0 until (dayTimesArray?.length() ?: 0)) {
            val item = dayTimesArray?.getJSONObject(i) ?: continue
            val key = item.optString("key")
            val name = item.optString("name")
            val timeMs = item.optLong("timeMs", 0L)
            val label = item.optString("label").takeIf { it.isNotBlank() }
            if (key.isNotBlank() && name.isNotBlank() && timeMs > 0L) {
                dayTimes.add(PrayerAlarmStore.Entry(key, name, timeMs, label = label))
            }
        }

        PrayerAlarmStore.writeWidgetMetadata(
            context = context,
            sunriseTimeMs = sunriseTimeMs,
            cityName = cityName,
            hijriDate = hijriDate,
            gregorianDate = gregorianDate,
        )
        if (dayTimes.isNotEmpty()) PrayerAlarmStore.writeDayTimes(context, dayTimes)
        PrayerWidgetUpdater.requestUpdate(context)
        Log.d(TAG, "Widget data persisted: ${dayTimes.size} times")
        return dayTimes.size
    }

    /**
     * تحديث بيانات الويدجت فقط — بلا أي جدولة منبّهات وبلا أي صلاحية.
     * تستدعيها طبقة الويب في كل مرة تتغيّر فيها المواقيت أو الموقع أو اليوم،
     * حتى لو كانت الإشعارات مرفوضة أو صلاحية المنبّهات الدقيقة غير ممنوحة.
     */
    @PluginMethod
    fun updateWidget(call: PluginCall) {
        try {
            val count = persistWidgetData(call)
            call.resolve(JSObject().apply {
                put("success", true)
                put("count", count)
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to update widget data", e)
            call.reject("Failed to update widget data: ${e.message}")
        }
    }

    /**
     * Cancel all scheduled alarms.
     */
    @PluginMethod
    fun cancelAll(call: PluginCall) {
        try {
            scheduler.cancelAllPrayers()
            PrayerAlarmStore.clear(context)
            Log.d(TAG, "Cancelled all prayers")

            call.resolve(JSObject().apply {
                put("success", true)
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cancel all prayers", e)
            call.reject("Failed to cancel all prayers: ${e.message}")
        }
    }

    /**
     * Check if SCHEDULE_EXACT_ALARM permission is granted.
     * Required on Android 12+ for exact alarms.
     */
    @PluginMethod
    fun canScheduleExactAlarms(call: PluginCall) {
        val canSchedule = scheduler.canScheduleExactAlarms()
        Log.d(TAG, "Can schedule exact alarms: $canSchedule")

        call.resolve(JSObject().apply {
            put("canSchedule", canSchedule)
        })
    }

    /**
     * Open settings to grant SCHEDULE_EXACT_ALARM permission.
     */
    @PluginMethod
    fun requestExactAlarmPermission(call: PluginCall) {
        try {
            val intent = android.content.Intent(android.provider.Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM).apply {
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)

            call.resolve(JSObject().apply {
                put("success", true)
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open exact alarm settings", e)
            call.reject("Failed to open exact alarm settings: ${e.message}")
        }
    }

    /**
     * Open this app's system settings so the user can restore denied location access.
     */
    @PluginMethod
    fun openAppSettings(call: PluginCall) {
        try {
            val intent = android.content.Intent(
                android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                android.net.Uri.parse("package:${context.packageName}")
            ).apply {
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK
            }
            context.startActivity(intent)
            call.resolve(JSObject().apply {
                put("success", true)
            })
        } catch (e: Exception) {
            Log.e(TAG, "Failed to open app settings", e)
            call.reject("Failed to open app settings: ${e.message}")
        }
    }

    /**
     * Get prayer notification preferences.
     *
     * Expected parameters:
     * {
     *   "prayerKey": "fajr"
     * }
     *
     * Returns:
     * {
     *   "enabled": true,
     *   "mode": "azan_short"
     * }
     */
    @PluginMethod
    fun getPrayerPreference(call: PluginCall) {
        try {
            val prayerKey = call.getString("prayerKey") ?: ""

            if (prayerKey.isEmpty()) {
                call.reject("Missing required parameter: prayerKey")
                return
            }

            val enabled = PrayerPreferencesReader.isPrayerEnabled(context, prayerKey)
            val mode = PrayerPreferencesReader.getPrayerMode(context, prayerKey)

            call.resolve(JSObject().apply {
                put("enabled", enabled)
                put("mode", mode)
            })
        } catch (e: Exception) {
            call.reject("Failed to get prayer preference: ${e.message}")
        }
    }

    /**
     * Save prayer notification preferences.
     *
     * Expected parameters:
     * {
     *   "prayerKey": "fajr",
     *   "enabled": true,
     *   "mode": "azan_short"
     * }
     */
    @PluginMethod
    fun savePrayerPreference(call: PluginCall) {
        try {
            val prayerKey = call.getString("prayerKey") ?: ""
            val enabled = call.getBoolean("enabled", true) ?: true
            val mode = call.getString("mode", "beep") ?: "beep"

            if (prayerKey.isEmpty()) {
                call.reject("Missing required parameter: prayerKey")
                return
            }

            PrayerPreferencesReader.savePrayerPreference(context, prayerKey, enabled, mode)

            call.resolve(JSObject().apply {
                put("success", true)
            })
        } catch (e: Exception) {
            call.reject("Failed to save prayer preference: ${e.message}")
        }
    }

    /**
     * Check if adhan should be played for a prayer.
     *
     * Expected parameters:
     * {
     *   "prayerKey": "fajr"
     * }
     *
     * Returns:
     * {
     *   "shouldPlayAdhan": true
     * }
     */
    @PluginMethod
    fun shouldPlayAdhan(call: PluginCall) {
        try {
            val prayerKey = call.getString("prayerKey") ?: ""

            if (prayerKey.isEmpty()) {
                call.reject("Missing required parameter: prayerKey")
                return
            }

            val shouldPlay = PrayerPreferencesReader.shouldPlayAdhan(context, prayerKey)

            call.resolve(JSObject().apply {
                put("shouldPlayAdhan", shouldPlay)
            })
        } catch (e: Exception) {
            call.reject("Failed to check shouldPlayAdhan: ${e.message}")
        }
    }

    /**
     * Save the selected muezzin ID and file name.
     * Called from React when user selects a muezzin.
     */
    @PluginMethod
    fun saveSelectedMuezzin(call: PluginCall) {
        try {
            val prayerKey = call.getString("prayerKey") ?: ""
            val muezzinId = call.getString("muezzinId") ?: ""
            val fileName = call.getString("fileName") ?: ""

            if (prayerKey.isEmpty() || muezzinId.isEmpty() || fileName.isEmpty()) {
                call.reject("Missing required parameters: prayerKey, muezzinId, fileName")
                return
            }

            MuezzinHelper.saveSelectedMuezzin(context, prayerKey, muezzinId, fileName)
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            call.reject("Failed to save selected muezzin: ${e.message}")
        }
    }

    @PluginMethod
    fun clearSelectedMuezzin(call: PluginCall) {
        try {
            val prayerKey = call.getString("prayerKey") ?: ""
            if (prayerKey.isEmpty()) {
                call.reject("Missing required parameter: prayerKey")
                return
            }
            MuezzinHelper.clearSelectedMuezzin(context, prayerKey)
            call.resolve(JSObject().apply { put("success", true) })
        } catch (e: Exception) {
            call.reject("Failed to clear selected muezzin: ${e.message}")
        }
    }

    /**
     * Check if a muezzin file is downloaded.
     */
    @PluginMethod
    fun isMuezzinDownloaded(call: PluginCall) {
        try {
            val fileName = call.getString("fileName") ?: ""
            if (fileName.isEmpty()) {
                call.reject("Missing required parameter: fileName")
                return
            }

            val isDownloaded = MuezzinHelper.isMuezzinDownloaded(context, fileName)
            call.resolve(JSObject().apply { put("isDownloaded", isDownloaded) })
        } catch (e: Exception) {
            call.reject("Failed to check muezzin download status: ${e.message}")
        }
    }

    /**
     * Delete a muezzin file.
     */
    @PluginMethod
    fun deleteMuezzin(call: PluginCall) {
        try {
            val fileName = call.getString("fileName") ?: ""
            if (fileName.isEmpty()) {
                call.reject("Missing required parameter: fileName")
                return
            }

            val deleted = MuezzinHelper.deleteMuezzinFile(context, fileName)
            call.resolve(JSObject().apply { put("success", deleted) })
        } catch (e: Exception) {
            call.reject("Failed to delete muezzin file: ${e.message}")
        }
    }
}
