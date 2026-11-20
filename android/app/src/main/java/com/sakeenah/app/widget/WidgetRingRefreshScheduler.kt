package com.sakeenah.app.widget

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * WidgetRingRefreshScheduler — تحديث **قوس الحلقة فقط** كل 10 دقائق.
 *
 * ═══ لماذا؟ ═══════════════════════════════════════════════════════════
 * العد التنازلي يتولاه `Chronometer` (صفر عمل منّا). لكن **قوس الحلقة**
 * ثابت في الـ Bitmap، فيتقدّم فقط عند إعادة الرسم. المواصفات §4 تلزم
 * تحديثه كل 10 دقائق على الأكثر — لا كل ثانية ولا كل دقيقة.
 *
 * ═══ ما نستخدمه ══════════════════════════════════════════════════════
 *   setInexactRepeating(RTC, الآن + 10د, 10د, PendingIntent)
 *   • **غير دقيق** → لا يحتاج SCHEDULE_EXACT_ALARM (صلاحية قائمة أصلًا
 *     لكن لا نستدعيها) ولا أي صلاحية جديدة.
 *   • يوقفه النظام تلقائيًا مع Doze، فلا يستهلك في وضع السكون.
 *   • لا خدمة ولا WorkManager (مطابق للقيد الدائم).
 *
 * ═══ الإيقاف ═════════════════════════════════════════════════════════
 * يُلغى المنبّه عند إزالة آخر ويدجت (onDisabled) فلا يبقى عمل بلا مستهلك.
 */
internal object WidgetRingRefreshScheduler {

    private const val TAG = "WidgetRingRefresh"
    private const val ACTION = "com.sakeenah.app.action.WIDGET_RING_REFRESH"
    private const val REQUEST_CODE = 71010
    private const val INTERVAL_MS = 10L * 60L * 1000L   // 10 دقائق

    /** يبدأ التقليب الدوري — آمن للاستدعاء المتكرر (نفس PendingIntent). */
    fun start(context: Context) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        val pending = pendingIntent(context) ?: return
        try {
            // setInexactRepeating: لا دقة مطلوبة، فلا حاجة لأي صلاحية.
            manager.setInexactRepeating(
                AlarmManager.RTC,
                System.currentTimeMillis() + INTERVAL_MS,
                INTERVAL_MS,
                pending,
            )
            Log.d(TAG, "Ring refresh scheduled every 10 min (inexact)")
        } catch (error: Throwable) {
            Log.w(TAG, "Could not schedule ring refresh: ${error.message}")
        }
    }

    /** يوقف التحديث — يُستدعى عند إزالة آخر ويدجت. */
    fun stop(context: Context) {
        val manager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager ?: return
        pendingIntent(context)?.let { pending ->
            try {
                manager.cancel(pending)
                pending.cancel()
                Log.d(TAG, "Ring refresh cancelled")
            } catch (error: Throwable) {
                Log.w(TAG, "Could not cancel ring refresh: ${error.message}")
            }
        }
    }

    private fun pendingIntent(context: Context): PendingIntent? = try {
        val intent = Intent(context, WidgetRingRefreshReceiver::class.java).setAction(ACTION)
        PendingIntent.getBroadcast(
            context,
            REQUEST_CODE,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    } catch (error: Throwable) {
        Log.w(TAG, "PendingIntent failed: ${error.message}")
        null
    }
}

/**
 * المستقبل: مجرد إعادة رسم. لا حساب هنا — PrayerWidgetUpdater يقرأ
 * المصدر الوحيد ويُعيد بناء الحلقة.
 */
class WidgetRingRefreshReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        PrayerWidgetUpdater.requestUpdate(context.applicationContext)
    }
}
