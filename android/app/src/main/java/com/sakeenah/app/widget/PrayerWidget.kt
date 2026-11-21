package com.sakeenah.app.widget

import android.content.Context
import android.os.Build
import android.util.Log
import androidx.glance.GlanceId
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.provideContent
import androidx.glance.state.PreferencesGlanceStateDefinition
import com.sakeenah.app.R
import com.sakeenah.app.util.PrayerAlarmStore

/**
 * PrayerWidget — ويدجت الشاشة الرئيسية وشاشة القفل.
 *
 * مبدأ المصدر الواحد: كل البيانات تُقرأ من PrayerAlarmStore، وهي نفس
 * القيم التي أنتجها adhan-js في طبقة الويب وجدولها AlarmScheduler.
 * لا يوجد مُحلّل فلكي ثانٍ هنا. (docs/widget-data-flow.md)
 *
 * آلة العرض:
 *   - provideGlance  → الشاشة الرئيسية
 *   - providePreview → المعاينة في منتقي الويدجت + شاشة القفل
 */
class PrayerWidget : GlanceAppWidget() {

    companion object {
        internal const val TAG = "PrayerWidget"
    }

    override val stateDefinition = PreferencesGlanceStateDefinition

    override val sizeMode: SizeMode = SizeMode.Responsive(PrayerWidgetSizes.ALL)

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val data = readData(context)
        Log.d(TAG, "provideGlance: hasLocation=${data.hasLocation}, slots=${data.slots.size}")

        provideContent {
            val size = androidx.glance.LocalSize.current
            PrayerWidgetContent(data = data, size = size)
        }
    }

    /**
     * معاينة الغلاف — تُستخدم في منتقي الويدجت وفي شاشة القفل.
     * تتبع تصنيف المضيف: على شاشة القفل نخفي المدينة والتاريخ.
     * المرجع: GlanceAppWidget.providePreview (Android Developers).
     */
    override suspend fun providePreview(context: Context, widgetCategory: Int) {
        val isKeyguard = if (Build.VERSION.SDK_INT >= 17) {
            widgetCategory and
                (android.appwidget.AppWidgetProviderInfo.WIDGET_CATEGORY_KEYGUARD) != 0
        } else false

        val data = readData(context)
        provideContent {
            PrayerWidgetContent(
                data = data,
                size = PrayerWidgetSizes.COMPACT_4x2,
                isKeyguard = isKeyguard,
            )
        }
    }

    /**
     * ═══ شبكة أمان أخيرة ═══════════════════════════════════════════════════
     * Glance يستدعي هذه الدالة عند أي استثناء أثناء التركيب، وتنفيذه الافتراضي
     * يعرض `R.layout.glance_error_layout` — الذي نصّه العربي «يتعذّر عرض المحتوى.».
     *
     * نُغيّره هنا إلى البطاقة الفارغة المصمّمة + سجل كامل للاستثناء، فلا يرى
     * المستخدم رسالة خطأ خام أبدًا. (GlanceAppWidget.kt:219 دالة onCompositionError)
     */
    override fun onCompositionError(
        context: Context,
        glanceId: GlanceId,
        appWidgetId: Int,
        throwable: Throwable,
    ) {
        Log.e(TAG, "Composition error (widget=$appWidgetId) — showing empty state", throwable)
        try {
            val rv = android.widget.RemoteViews(context.packageName, R.layout.widget_empty)
            android.appwidget.AppWidgetManager
                .getInstance(context)
                .updateAppWidget(appWidgetId, rv)
        } catch (secondary: Throwable) {
            // لا شيء نفعله أكثر؛ السجل أعلاه يحمل السبب الأصلي.
            Log.e(TAG, "onCompositionError fallback failed", secondary)
        }
    }

    /**
     * قراءة واحدة موحّدة. عند غياب أي بيانات → WidgetData.EMPTY
     * (الحالة الفارغة الآمنة، لا انهيار ولا أصفار وهمية).
     */
    private fun readData(context: Context): WidgetData {
        val entries = try {
            PrayerAlarmStore.loadDay(context)
        } catch (error: Throwable) {
            Log.w(TAG, "Failed to read prayer store: ${error.message}")
            return WidgetData.EMPTY
        }

        if (entries.isEmpty()) return WidgetData.EMPTY

        val slots = entries
            .map { WidgetData.Slot(it.key, it.name, it.timeMs, it.label) }
            .filter { it.timeMs > 0L }

        if (slots.isEmpty()) return WidgetData.EMPTY

        // الشروق: قد يأتي داخل dayTimes (من نفس prayerSchedule) وقد يأتي
        // من الحقل المستقل. نُضيفه فقط إن لم يكن موجودًا — منعًا لتكرار
        // المفتاح الذي يجعل associateBy يلتقط نسخة عشوائية.
        val sunriseFromStore = PrayerAlarmStore.sunriseTimeMs(context)
        val hasSunrise = slots.any { it.key == WidgetData.SUNRISE }
        val withSunrise = if (!hasSunrise && sunriseFromStore > 0L) {
            slots + WidgetData.Slot(WidgetData.SUNRISE, "الشروق", sunriseFromStore)
        } else {
            slots
        }
        val sunrise = if (hasSunrise) {
            slots.first { it.key == WidgetData.SUNRISE }.timeMs
        } else {
            sunriseFromStore
        }

        return WidgetData(
            slots = withSunrise.sortedBy { it.timeMs },
            cityName = PrayerAlarmStore.cityName(context),
            hijriDate = PrayerAlarmStore.hijriDate(context),
            hasLocation = true,
            sunriseTimeMs = sunrise,
            gregorianDate = PrayerAlarmStore.gregorianDate(context),
        )
    }
}

/**
 * Receiver — نقطة تسجيل النظام.
 * GlanceAppWidgetReceiver يتولّى ACTION_APPWIDGET_UPDATE وحده.
 */
class PrayerWidgetReceiver : GlanceAppWidgetReceiver() {

    private companion object {
        // اسم متمايز: GlanceAppWidgetReceiver يملك TAG خاصًا به، وأي مرجع
        // غير مؤهَّل داخل الصنف يُحلّ إلى عضو الوراثة الخاص فيفشل الترجمة.
        const val RECEIVER_TAG = "PrayerWidgetReceiver"
    }

    override val glanceAppWidget: GlanceAppWidget = PrayerWidget()

    /**
     * ويدجت أُضيف → ابدأ تحديث قوس الحلقة كل 10 دقائق.
     * (لا يمكن بدء التقليب من provideGlance لأنها تُستدعى كثيرًا.)
     */
    override fun onEnabled(context: Context) {
        super.onEnabled(context)
        try {
            WidgetRingRefreshScheduler.start(context.applicationContext)
        } catch (error: Throwable) {
            Log.w(RECEIVER_TAG, "onEnabled ring schedule failed: ${error.message}")
        }
    }

    /** آخر ويدجت أُزيل → أوقف العمل الدوري فلا يبقى بلا مستهلك. */
    override fun onDisabled(context: Context) {
        super.onDisabled(context)
        try {
            WidgetRingRefreshScheduler.stop(context.applicationContext)
        } catch (error: Throwable) {
            Log.w(RECEIVER_TAG, "onDisabled ring stop failed: ${error.message}")
        }
    }
}
