package com.sakeenah.app.widget

import android.util.TypedValue
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.Dp
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.layout.height
import androidx.glance.layout.width
import com.sakeenah.app.R

/**
 * BrandText — نص بخط سَكِينَة الأصلي (Thmanyah) داخل ويدجت Glance.
 *
 * ── لماذا لا نستخدم Glance Text المباشر؟ ─────────────────────────────
 * `Glance.text.FontFamily(String)` يُترجَم إلى `Typeface.create(name, style)`
 * الذي يبحث في خطوط النظام فقط، **ولا يجد** موارد `res/font`.
 * (تحقق تجريبي: `javap androidx.glance.text.FontFamily` → المنشئ الوحيد
 * `FontFamily(String)`، بلا أي قبول لمعرّف مورد.)
 *
 * ── الحل المعتمد ──────────────────────────────────────────────────────
 * `RemoteViews(layout)` يحمل `android:fontFamily` يشير إلى مورد `res/font` في XML، فيطبّقه
 * النظام على كل الإصدارات المدعومة (minSdk 24). ثم نضبط النص/الحجم/اللون
 * عبر واجهات RemoteViews القياسية (كلها API ≤ 16):
 *   • setTextViewText(int, CharSequence)
 *   • setTextViewTextSize(int, int, float)
 *   • setTextColor(int, int)
 *
 * النتيجة:
 *   ✔ خطوط سَكِينَة الحقيقية (نفس ملفات WOFF2 الأصلية بعد فك الضغط)
 *   ✔ تشكيل عربي كامل من محرك النظام
 *   ✔ **صفر Bitmap** → لا احتمال TransactionTooLargeException
 *   ✔ صفر View مبرمج: RemoteViews.addView(int, RemoteViews) فقط — لا يقبل View
 */
internal enum class BrandFace { SANS, SERIF }

@Composable
internal fun BrandText(
    text: String,
    sizeSp: Float,
    color: Int,
    face: BrandFace = BrandFace.SANS,
    modifier: GlanceModifier = GlanceModifier,
    maxWidth: Dp? = null,
    maxHeight: Dp? = null,
) {
    var sized = modifier
    if (maxWidth != null) sized = sized.width(maxWidth)
    if (maxHeight != null) sized = sized.height(maxHeight)

    val context = LocalContext.current
    AndroidRemoteViews(
        remoteViews = buildTextRemoteViews(context.packageName, text, sizeSp, color, face),
        modifier = sized,
    )
}

/**
 * يبني RemoteViews نصيًا جاهزًا.
 * @param packageName context.packageName — يُمرَّر صراحةً حتى يبقى الدالة نقية.
 */
internal fun buildTextRemoteViews(
    packageName: String,
    text: String,
    sizeSp: Float,
    color: Int,
    face: BrandFace = BrandFace.SANS,
): RemoteViews {
    val layout = if (face == BrandFace.SERIF) R.layout.widget_serif_text else R.layout.widget_text
    val id = if (face == BrandFace.SERIF) R.id.widget_serif_text else R.id.widget_text

    return RemoteViews(packageName, layout).apply {
        setTextViewText(id, text)
        setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, sizeSp)
        setTextColor(id, color)
    }
}

/**
 * Chronometer أصلي — العدّ التنازلي صفر الاستهلاك.
 *
 *   base = SystemClock.elapsedRealtime() + remainingMs
 *   setChronometer(id, base, "%s", started=true)   — API 1
 *   setChronometerCountDown(id, true)              — API 24 ✔ (minSdk=24)
 *
 * بعد بناء RemoteViews لا يوجد أي عمل على خيط التطبيق — النظام يحدّث
 * الثواني في الـ render pass.
 */
internal fun buildChronometerRemoteViews(
    packageName: String,
    remainingMs: Long,
    color: Int,
    sizeSp: Float,
): RemoteViews {
    val base = android.os.SystemClock.elapsedRealtime() + remainingMs
    return RemoteViews(packageName, R.layout.widget_chronometer).apply {
        setChronometer(R.id.widget_chronometer, base, "%s", true)
        setChronometerCountDown(R.id.widget_chronometer, true)
        setTextColor(R.id.widget_chronometer, color)
        setTextViewTextSize(R.id.widget_chronometer, TypedValue.COMPLEX_UNIT_SP, sizeSp)
    }
}
