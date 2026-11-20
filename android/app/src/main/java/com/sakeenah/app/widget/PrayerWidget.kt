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
        private const val TAG = "PrayerWidget"
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
                size = PrayerWidgetSizes.DETAILED,
                isKeyguard = isKeyguard,
            )
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
            .map { WidgetData.Slot(it.key, it.name, it.timeMs) }
            .filter { it.timeMs > 0L }

        if (slots.isEmpty()) return WidgetData.EMPTY

        // الشروق: حقل مستقل لأن AlarmScheduler لا يجدوله (ليس صلاة).
        val sunrise = PrayerAlarmStore.sunriseTimeMs(context)
        val withSunrise = if (sunrise > 0L) {
            slots + WidgetData.Slot(WidgetData.SUNRISE, "الشروق", sunrise)
        } else {
            slots
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
    override val glanceAppWidget: GlanceAppWidget = PrayerWidget()
}
