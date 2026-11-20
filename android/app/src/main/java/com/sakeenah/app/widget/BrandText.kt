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
 * BrandText — نصوص سَكِينَة بخطوطها الأصلية + حلقة التقدّم الأصلية.
 *
 * ── لماذا لا نستخدم Glance Text المباشر؟ ─────────────────────────────
 * `Glance.text.FontFamily(String)` يُترجم إلى `Typeface.create(name, style)`
 * الذي يبحث في خطوط النظام فقط، **ولا يجد** موارد `res/font`.
 * (تحقق تجريبي بـ javap على glance-1.2.0.aar: المنشئ الوحيد
 *  `FontFamily(String)`، بلا أي قبول لمعرّف مورد.)
 *
 * ── الحل المعتمد ──────────────────────────────────────────────────────
 * تخطيطات XML حقيقية تحمل `android:fontFamily`، ثم نضبط النص/الحجم/اللون
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
internal enum class BrandFace {
    /** Thmanyah Sans — النصوص والمواقيت */
    SANS,
    /** Thmanyah Serif Display — أسماء الصلوات */
    SERIF,
}

@Composable
internal fun BrandText(
    text: String,
    sizeSp: Float,
    color: Int,
    face: BrandFace = BrandFace.SANS,
    modifier: GlanceModifier = GlanceModifier,
    maxWidth: Dp? = null,
    maxHeight: Dp? = null,
    maxLines: Int = 1,
) {
    var sized = modifier
    if (maxWidth != null) sized = sized.width(maxWidth)
    if (maxHeight != null) sized = sized.height(maxHeight)

    val context = LocalContext.current
    AndroidRemoteViews(
        remoteViews = buildTextRemoteViews(
            packageName = context.packageName,
            text = text,
            sizeSp = sizeSp,
            color = color,
            face = face,
            maxLines = maxLines,
        ),
        modifier = sized,
    )
}

/**
 * يبني RemoteViews نصيًا جاهزًا.
 * @param packageName context.packageName — يُمرَّر صراحةً لتبقى الدالة نقية.
 */
internal fun buildTextRemoteViews(
    packageName: String,
    text: String,
    sizeSp: Float,
    color: Int,
    face: BrandFace = BrandFace.SANS,
    maxLines: Int = 1,
): RemoteViews {
    val layout = if (face == BrandFace.SERIF) R.layout.widget_serif_text else R.layout.widget_text
    val id = if (face == BrandFace.SERIF) R.id.widget_serif_text else R.id.widget_text

    return RemoteViews(packageName, layout).apply {
        setTextViewText(id, text)
        setTextViewTextSize(id, TypedValue.COMPLEX_UNIT_SP, sizeSp)
        setTextColor(id, color)
        if (maxLines > 1) setInt(id, "setMaxLines", maxLines)
    }
}

/**
 * الحلقة الأصلية — نظير مباشر لـ SVG في البطاقة الأصلية.
 *
 * الأصل (App.tsx:1238-1276):
 *   <svg class="-rotate-90"> مسار خلفي + قوس progress-arc </svg>
 *   وفي المنتصف: «متبقي» + العدّاد
 *
 * التنفيذ هنا:
 *   • ProgressBar دائري (drawable ring بـ useLevel=true) → قوس حقيقي
 *     يُضبط بـ setProgress(pbar, level) مع max=1000.
 *     startAngle=-90 / endAngle=270 → يبدأ من الأعلى كـ -rotate-90.
 *   • Chronometer أصلي في المركز → العدّ التنازلي بثانية، من النظام.
 *
 * ✔ صفر Bitmap · ✔ صفر مؤقتات · ✔ صفر عمل على خيط التطبيق بعد الرسم.
 *
 * @param progress 0f..1f نسبة ما مضى من الفترة الحالية
 * @param remainingMs ما تبقّى حتى الصلاة القادمة
 */
internal fun buildRingRemoteViews(
    packageName: String,
    progress: Float,
    remainingMs: Long,
    @Suppress("UNUSED_PARAMETER") arcColor: Int,
    @Suppress("UNUSED_PARAMETER") trackColor: Int,
    labelColor: Int,
    countdownColor: Int,
    labelText: String,
    sizeSp: Float,
): RemoteViews {
    val base = android.os.SystemClock.elapsedRealtime() + remainingMs
    val level = (progress.coerceIn(0f, 1f) * 1000f).toInt()

    return RemoteViews(packageName, R.layout.widget_ring).apply {
        setProgressBar(R.id.widget_ring_progress, 1000, level, false)

        setTextViewText(R.id.widget_ring_label, labelText)
        setTextViewTextSize(R.id.widget_ring_label, TypedValue.COMPLEX_UNIT_SP, sizeSp * 0.62f)
        setTextColor(R.id.widget_ring_label, labelColor)

        setChronometer(R.id.widget_ring_chronometer, base, "%s", true)
        setChronometerCountDown(R.id.widget_ring_chronometer, true)
        setTextColor(R.id.widget_ring_chronometer, countdownColor)
        setTextViewTextSize(
            R.id.widget_ring_chronometer,
            TypedValue.COMPLEX_UNIT_SP,
            sizeSp,
        )
        // ملاحظة: RemoteViews لا يملك setProgressTintList (تم Verify بـ javap
        // على android-34.jar: الواجهة الوحيدة هي setProgressBar).
        // لذلك ألوان الحلقة تأتي من drawable → @color → values/values-night،
        // فتبدّل نفسها تلقائيًا مع وضع النظام.
    }
}

/**
 * Chronometer مجرّد (للمقاس المدمج 4×1 حيث لا يوجد حلقة).
 *
 *   base = SystemClock.elapsedRealtime() + remainingMs
 *   setChronometer(id, base, "%s", started=true)   — API 1
 *   setChronometerCountDown(id, true)              — API 24 ✔ (minSdk=24)
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
