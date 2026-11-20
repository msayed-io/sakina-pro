package com.sakeenah.app.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Typeface
import android.util.TypedValue
import androidx.annotation.FontRes
import androidx.core.content.res.ResourcesCompat

/**
 * ArabicTextBitmapRenderer — يرسم نصًّا عربيًا بخط التطبيق الحقيقي إلى Bitmap
 * بأبعاد النص **الفعلية** (لا لوحة أكبر)، مع Anti-aliasing.
 *
 * ═══ لماذا Bitmap أصلًا؟ ══════════════════════════════════════════════
 * `Glance.text.FontFamily(String)` يُترجم إلى `Typeface.create(name, style)`
 * الذي يبحث في خطوط النظام فقط ولا يجد `res/font` (تحقق بـ javap على
 * glance-1.2.0.aar: المنشئ الوحيد `FontFamily(String)`).
 * البديل `RemoteViews` + `android:fontFamily` في XML يعمل بلا Bitmap لكنه
 * يفرض تخطيطًا كاملًا لكل نص. المواصفات §7 تلزم **Bitmap لاسم الصلاة فقط**
 * (38sp، النص الأكبر والأكثر ظهورًا) وتترك الباقي نصوصًا عادية توفيرًا للذاكرة.
 *
 * ═══ ضمانات الذاكرة (RemoteViews limits) ═════════════════════════════════
 *  • الأبعاد = قياسات النص الفعلية + حشوة صغيرة، لا مربّع ثابت.
 *  • ARGB_8888 بحجم 38sp ≈ 120×56dp ≈ 360×168px @xhdpi ≈ 242 KB
 *    (الحد الأقصى لـ RemoteViews ~ 1.5 MB لكل صورة).
 *  • كل Bitmap يُحرَّر بعد الالتقاط بـ `bitmap.recycle()` في finally.
 *  • سقف صريح: إن تجاوزت الأبعاد الحد الآمن نتوقف ونُرجع null
 *    (فيسقط العرض إلى نص RemoteViews عادي بدل أن نُسقِط الويدجت).
 */
internal object ArabicTextBitmapRenderer {

    /** حدّ أمان RemoteViews: 1.2 MB لكل صورة (تحفّظًا تحت سقف 1.5 MB). */
    private const val MAX_BITMAP_BYTES = 1_200_000

    /**
     * يرسم [text] بخط [fontRes] بحجم [sizeSp] ولون [color].
     *
     * @return Bitmap بأبعاد النص الفعلية، أو null إن تعذّر/تجاوز الحد.
     *         **المتصل مسؤول عن استدعاء recycle().**
     */
    fun render(
        context: Context,
        text: String,
        @FontRes fontRes: Int,
        sizeSp: Float,
        color: Int,
        letterSpacing: Float = 0f,
    ): Bitmap? {
        if (text.isBlank()) return null

        val typeface = loadTypeface(context, fontRes) ?: return null
        val paint = buildPaint(context, typeface, sizeSp, color, letterSpacing)

        // ── قياس النص الفعلي (لا تخمين) ──────────────────────────────
        val metrics = paint.fontMetrics
        val textWidth = paint.measureText(text)
        val textHeight = metrics.descent - metrics.ascent

        val padH = dp(context, 2)
        val padV = dp(context, 1)
        val width = (textWidth.ceil()).toInt() + padH * 2
        val height = (textHeight.ceil()).toInt() + padV * 2

        if (width <= 0 || height <= 0) return null

        val bytes = width.toLong() * height.toLong() * 4L
        if (bytes > MAX_BITMAP_BYTES) {
            android.util.Log.w(
                "ArabicTextBitmap",
                "Bitmap too large (${width}x$height = ${bytes}B > $MAX_BITMAP_BYTES) — skipping",
            )
            return null
        }

        return try {
            val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)
            // الخلفية شفافة افتراضيًا؛ لا نملؤها حتى تندمج مع البطاقة.
            canvas.drawText(text, padH.toFloat(), padV - metrics.ascent, paint)
            bitmap
        } catch (error: Throwable) {
            // OutOfMemory أو أي فشل رسم: نرتد إلى نص عادي بدل إسقاط الويدجت.
            android.util.Log.w("ArabicTextBitmap", "render failed: ${error.message}")
            null
        }
    }

    /** الخط من موارد التطبيق فقط — لا خط نظام ولا ملف خارجي. */
    private fun loadTypeface(context: Context, @FontRes fontRes: Int): Typeface? =
        try {
            ResourcesCompat.getFont(context, fontRes)
        } catch (error: Throwable) {
            android.util.Log.w("ArabicTextBitmap", "font load failed: ${error.message}")
            null
        }

    /** Anti-aliasing + subpixel + تشكيل عربي كامل من محرك النظام. */
    private fun buildPaint(
        context: Context,
        typeface: Typeface,
        sizeSp: Float,
        color: Int,
        letterSpacing: Float,
    ): Paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.SUBPIXEL_TEXT_FLAG).apply {
        this.typeface = typeface
        this.color = color
        textSize = sp(context, sizeSp)
        isDither = false
        if (letterSpacing != 0f) this.letterSpacing = letterSpacing
    }

    private fun dp(context: Context, value: Int): Int =
        (value * context.resources.displayMetrics.density).toInt()

    private fun sp(context: Context, value: Float): Float =
        TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_SP,
            value,
            context.resources.displayMetrics,
        )

    private fun Float.ceil(): Float = kotlin.math.ceil(this.toDouble()).toFloat()

    /**
     * يرسم الـ Bitmap داخل RemoteViews على ImageView مهيّأة.
     * المتصل يحرّر الـ Bitmap بعد استهلاكه.
     */
    fun applyTo(
        remoteViews: android.widget.RemoteViews,
        viewId: Int,
        bitmap: Bitmap,
    ) {
        remoteViews.setImageViewBitmap(viewId, bitmap)
    }
}
