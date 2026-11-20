package com.sakeenah.app.widget

import android.content.Context
import android.util.Log
import androidx.glance.appwidget.updateAll
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * PrayerWidgetUpdater — نقطة الربط الوحيدة بين التطبيق والويدجت.
 *
 * كل استدعاء هنا مجرد إعادة رسم. لا جدولة، لا مؤقتات، لا خدمات.
 * من يستدعيها:
 *   1. PrayerAlarmPlugin.scheduleAllPrayers()  — عند تغيّر المواقيت/الموقع
 *   2. AlarmReceiver (ACTION_PRAYER_ALARM)     — عند دخول وقت صلاة
 *   3. BootReceiver                            — بعد إعادة التشغيل
 *
 * كل واحدة من هذه الأحداث **موجودة أصلًا** في التطبيق؛ الويدجت يركب عليها.
 */
internal object PrayerWidgetUpdater {

    private const val TAG = "PrayerWidgetUpdater"

    /** نطاق خفيف لمرة واحدة — لا يعيش بعد انتهاء المهمة. */
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    /**
     * يعيد رسم كل ويدجت موضوع. آمن للاستدعاء من أي خيط، بما في ذلك
     * BroadcastReceiver (لا يحجب onReceive).
     */
    fun requestUpdate(context: Context) {
        val appContext = context.applicationContext
        scope.launch {
            try {
                PrayerWidget().updateAll(appContext)
                Log.d(TAG, "Widget refresh requested")
            } catch (error: Throwable) {
                // فشل إعادة الرسم يجب ألا يؤثر أبدًا على مسار الأذان.
                Log.w(TAG, "Widget refresh failed (alarm path unaffected): ${error.message}")
            }
        }
    }
}
