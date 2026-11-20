package com.sakeenah.app.widget

import android.content.Context
import android.content.res.Configuration
import androidx.glance.unit.ColorProvider
import com.sakeenah.app.R

/**
 * WidgetPalette — ربط كل دور لوني في prayer-widget-design.html
 * بقيمة حرفية مثبتة رسميًا من ثيم التطبيق الحي (src/index.css).
 *
 * ═══ قرارات التباين المعتمدة (WCAG AA) ═════════════════════════════════
 * ① accent فُصل إلى دورين لأن قيمة واحدة لا تصلح للاثنين:
 *      • تعبئة/حدود/قوس (عنصر واجهة — يحتاج 3:1): --sk-accent
 *      • نص «التالية» (13sp — يحتاج 4.5:1): --sk-accent-deep
 * ② --on-accent في الداكن = --sk-on-accent-soft (#000000) لأن
 *    --sk-on-accent = accent نفسه (= #EEDFC2) → نسبة 1.00:1، نص مخفي.
 * ③ --tile بسلم الارتفاع: فاتح = --sk-bg2، داكن = --sk-bg3،
 *    لأن أي رمز واحد منهما يصبح مطابقًا للبطاقة في أحد الوضعين.
 * ④ لا لون مُخترَع. كل قيمة مع سطرها في index.css.
 */
internal object WidgetPalette {

    internal fun isDark(context: Context): Boolean =
        (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
            Configuration.UI_MODE_NIGHT_YES

    // ═══════════════════════════════════════════════════════════════════
    //  رموز الثيم الحية — الوضع الفاتح (:root)
    // ═══════════════════════════════════════════════════════════════════
    // --bg   البطاقة        : index.css:902  --sk-bg3 = #fdfcfb
    // --tile سطح البلاطات   : index.css:901  --sk-bg2 = #f7f2ea
    // --text النص الأساسي   : index.css:912  --sk-label  = #2b1a10
    // --text2 النص الثانوي  : index.css:913  --sk-label2 = #7f6a55
    // --accent (واجهة)      : index.css:918  --sk-accent = #b88a4f
    // --accent (نص)         : index.css:920  --sk-accent-deep = #8a6a3d
    // --on-accent           : index.css:921  --sk-on-accent = #2b1a10
    // --track مسار الحلقة   : index.css:948  --sk-ring-track = #e8dfd4

    // ═══════════════════════════════════════════════════════════════════
    //  رموز الثيم الحية — الوضع الداكن
    // ═══════════════════════════════════════════════════════════════════
    // --bg                  : index.css:992  --sk-bg2 = #1C1C1E
    // --tile                : index.css:993  --sk-bg3 = #2C2C2E
    // --text                : index.css:1002 --sk-label = #FFFFFF
    // --text2               : index.css:1003 rgba(235,235,245,.60)
    // --accent (واجهة)      : index.css:1008 --sk-accent = #EEDFC2
    // --accent (نص)         : index.css:1008 (داكن: نفس القيمة، تباين 12.94 ✔)
    // --on-accent (قرار ②)  : index.css:1012 --sk-on-accent-soft = #000000
    // --track               : index.css:1038 rgba(235,235,245,.12)

    /** يُحلّ عبر موارد DayNight فيُحدَّث تلقائيًا مع النظام. */
    internal fun bg(context: Context): Int = resolve(context, R.color.sk_w_page)
    internal fun tile(context: Context): Int = resolve(context, R.color.sk_w_tile)
    internal fun text(context: Context): Int = resolve(context, R.color.sk_w_text)
    internal fun text2(context: Context): Int = resolve(context, R.color.sk_w_text2)
    internal fun accent(context: Context): Int = resolve(context, R.color.sk_w_accent)
    internal fun accentText(context: Context): Int = resolve(context, R.color.sk_w_accent_text)
    internal fun onAccent(context: Context): Int = resolve(context, R.color.sk_w_on_accent)
    internal fun track(context: Context): Int = resolve(context, R.color.sk_w_track)

    /** نسخة ColorProvider لـ Glance (تُحلّ وقت الرسم على الجهاز). */
    internal fun provider(resId: Int): ColorProvider = ColorProvider(resId)

    private fun resolve(context: Context, resId: Int): Int =
        androidx.core.content.ContextCompat.getColor(context, resId)
}
