package com.sakeenah.app.widget

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * WidgetTimeChangeReceiver — إشارات نظام رخيصة جدًا.
 *
 * TIME_SET و TIMEZONE_CHANGED يصلان عند:
 *   - تغيير المستخدم للساعة يدويًا
 *   - تغيير المنطقة الزمنية
 *   - تبديل التوقيت الصيفي (نادر في مصر لكن مستخدم محتمل)
 *
 * **لا يملك أي منطق حساب.** المواقيت مخزَّنة كـ epoch وتبقى صحيحة،
 * لكن التوقيت المعروض قد يتبدّل (12/24 ساعة أو offset العرض)،
 * فإعادة الرسم تكفي.
 *
 * هذا هو التجميع الوحيد لاستخدام TIME_SET/TIMEZONE_CHANGED كما
 * يوصي دليل أندرويد لتحديث الويدجت — ولا يوجد أي مؤقّت متكرر.
 */
class WidgetTimeChangeReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "WidgetTimeChange"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action ?: return
        if (action != Intent.ACTION_TIME_CHANGED && action != Intent.ACTION_TIMEZONE_CHANGED) return

        Log.d(TAG, "System time signal: $action → refreshing widget")
        PrayerWidgetUpdater.requestUpdate(context)
    }
}
