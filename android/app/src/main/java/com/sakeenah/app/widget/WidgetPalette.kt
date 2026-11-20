package com.sakeenah.app.widget

import android.content.Context
import android.content.res.Configuration
import androidx.glance.unit.ColorProvider
import com.sakeenah.app.R

/**
 * WidgetPalette — القيم الحرفية المستخرجة من الكود الحي.
 *
 * المرجع الوحيد: src/index.css  (سطر مذكور لكل قيمة)
 * لا لون واحد هنا مُختَرَع.
 *
 * ملاحظة: Glance يحلّ ColorProvider في وقت الرسم على الجهاز؛ لذلك
 * عند تبديل وضع النظام تتبدّل الأسطح الملوّنة بـ ColorProvider فورًا.
 * النصوص المرسومة عبر AndroidRemoteViews تستخدم raw* في
 * PrayerWidgetContent.kt (نفس القيم) لحظة إعادة التركيب.
 */
internal object WidgetPalette {

    internal fun isDark(context: Context): Boolean =
        (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

    // ── الوضع الفاتح (:root) ─────────────────────────────────────────────
    private const val LIGHT_BG_PAGE = 0xFFECE7DE.toInt()   // index.css:898  --sk-bg
    private const val LIGHT_BG2 = 0xFFF7F2EA.toInt()       // index.css:899  --sk-bg2
    private const val LIGHT_SEP = 0xFFE6DCCF.toInt()       // index.css:902  --sk-sep
    // cut-crystal-satin: index.css:234-238 rgba(253,252,251,.93)
    private const val LIGHT_CARD = 0xFFFDFCFB.toInt()

    // ── الوضع الداكن (html[data-theme="dark"]) ──────────────────────────
    private const val DARK_BG_PAGE = 0xFF000000.toInt()    // index.css:991
    private const val DARK_BG2 = 0xFF1C1C1E.toInt()        // index.css:992
    private const val DARK_SEP = 0x99545458.toInt()        // index.css:996
    // cut-crystal-satin في الداكن: index.css:1145 rgba(28,28,30,0.90)
    private const val DARK_CARD = 0xFF1C1C1E.toInt()

    /**
     * ColorProvider(resId: Int) هو التوقيع الوحيد المتاح إلى جانب
     * ColorProvider(Color) من compose-ui-graphics. كون Glance يعتمد
     * على compose-ui-graphics 1.6.0 (بلا Color(int)) نمرّر قيمًا
     * خامّة عبر ثابت موردي: نستخدم DayNight-aware ColorProvider
     * من خلال ColorProvider(resId) — لذلك نعرّف الموارد في
     * res/values/colors.xml و res/values-night/colors.xml.
     */
    internal fun page(context: Context): ColorProvider = ColorProvider(R.color.sk_widget_page)

    internal fun card(context: Context): ColorProvider = ColorProvider(R.color.sk_widget_card)

    internal fun surface(context: Context): ColorProvider = ColorProvider(R.color.sk_widget_surface)

    internal fun separator(context: Context): ColorProvider = ColorProvider(R.color.sk_widget_separator)
}
