package com.sakeenah.app.plugin

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.glance.appwidget.GlanceAppWidgetManager
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.sakeenah.app.MainActivity
import com.sakeenah.app.widget.PrayerWidget
import com.sakeenah.app.widget.PrayerWidgetReceiver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * PrayerWidgetPlugin — Capacitor bridge لزر «إضافة ويدجت للشاشة الرئيسية».
 *
 * يستخدم الواجهة الرسمية:
 *   GlanceAppWidgetManager(context).requestPinGlanceAppWidget(
 *       receiver = PrayerWidgetReceiver::class.java,
 *       preview = PrayerWidget::class.java,
 *       previewState = prefs,
 *       successCallback = pendingIntent,
 *   )
 *
 * ويعالج الحالات الثلاث بأمان:
 *   1. مدعوم            → نافذة تأكيد النظام تظهر
 *   2. غير مدعوم        → { supported: false } — الواجهة تعرض إرشادًا لطيفًا
 *   3. المستخدم ألغى    → successCallback يُستدعى بـ false
 */
@CapacitorPlugin(name = "PrayerWidget")
class PrayerWidgetPlugin : Plugin() {

    companion object {
        private const val TAG = "PrayerWidgetPlugin"
        private const val CALLBACK_ACTION = "com.sakeenah.app.action.WIDGET_PIN_RESULT"
        private const val CALLBACK_EXTRA_SUCCESS = "pin_success"
    }

    @PluginMethod
    fun isSupported(call: PluginCall) {
        try {
            val supported = AppWidgetManager.getInstance(context)
                .isRequestPinAppWidgetSupported
            call.resolve(JSObject().apply { put("supported", supported) })
        } catch (error: Throwable) {
            Log.w(TAG, "isSupported failed: ${error.message}")
            call.resolve(JSObject().apply { put("supported", false) })
        }
    }

    /**
     * يفتح نافذة تثبيت الويدجت الرسمية.
     * على API < 26 لا توجد الواجهة أصلًا → نعيد supported=false دائمًا.
     */
    @PluginMethod
    fun requestPin(call: PluginCall) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            call.resolve(JSObject().apply {
                put("supported", false)
                put("requested", false)
            })
            return
        }

        val appWidgetManager = AppWidgetManager.getInstance(context)
        if (!appWidgetManager.isRequestPinAppWidgetSupported) {
            call.resolve(JSObject().apply {
                put("supported", false)
                put("requested", false)
            })
            return
        }

        CoroutineScope(Dispatchers.Main).launch {
            try {
                val manager = GlanceAppWidgetManager(context)
                val receiver = ComponentName(context, PrayerWidgetReceiver::class.java)
                val successCallback = buildSuccessCallback()

                // التوقيع المؤكد من AAR:
                // requestPinGlanceAppWidget(receiver, preview, previewState, successCallback)
                manager.requestPinGlanceAppWidget(
                    receiver = PrayerWidgetReceiver::class.java,
                    preview = PrayerWidget(),
                    successCallback = successCallback,
                )

                Log.d(TAG, "Pin request dispatched (receiver=$receiver)")
                call.resolve(JSObject().apply {
                    put("supported", true)
                    put("requested", true)
                })
            } catch (error: Throwable) {
                Log.e(TAG, "requestPin failed", error)
                call.resolve(JSObject().apply {
                    put("supported", true)
                    put("requested", false)
                    put("error", error.message ?: "unknown")
                })
            }
        }
    }

    /**
     * PendingIntent يستقبله النظام عند نجاح التثبيت (أو إلغاء المستخدم).
     * نعيد النتيجة إلى الويب عبر notifyListeners.
     */
    private fun buildSuccessCallback(): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            action = CALLBACK_ACTION
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getActivity(context, 71001, intent, flags)
    }

    /** تستدعيها MainActivity عند وصول CALLBACK_ACTION. */
    fun dispatchPinResult(success: Boolean) {
        notifyListeners("widgetPinResult", JSObject().apply {
            put("success", success)
        })
    }
}
