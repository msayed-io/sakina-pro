package com.sakeenah.app.widget

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF

/**
 * ArabicRingRenderer — يرسم قوس الوقت المنقضي كـ Bitmap ثابتة.
 *
 * ═══ مطابقة الـ HTML ══════════════════════════════════════════════════
 *   .ring            width:72px; height:72px
 *   .ring svg        transform:rotate(-90deg)      ← يبدأ من أعلى
 *   .ring circle     fill:none; stroke-width:5.5; stroke-linecap:round
 *   .ring .track     stroke:var(--track)           ← دائرة كاملة
 *   .ring .arc       stroke:var(--accent);
 *                    stroke-dasharray:201.1        ← 2πr حيث r=32
 *                    stroke-dashoffset:82.5        ← 201.1 × (1 − progress)
 *
 * القوس = (الآن − بداية الحالية) ÷ (بداية القادمة − بداية الحالية)
 * ثابتة تمامًا — **لا CircularProgressIndicator ولا أي دوران** (المواصفات §4).
 *
 * ═══ الذاكرة ══════════════════════════════════════════════════════════
 *   bitmap = 72dp × density (×2 @xhdpi ≈ 144×144 px ≈ 83 KB) — تحرير فوري.
 */
internal object ArabicRingRenderer {

    /** r = 32px في viewBox 72×72 → نسبة 32/72 = 0.444 */
    private const val RADIUS_RATIO = 32f / 72f

    /** stroke-width 5.5px على 72px → 7.64٪ من الحجم */
    private const val STROKE_RATIO = 5.5f / 72f

    /**
     * @param sizePx 72dp بالبكسل الفعلي (72 × density)
     * @param progress نسبة ما مضى من الفترة، 0f..1f
     * @return Bitmap ARGB_8888 — **المتصل مسؤول عن recycle()**
     */
    fun render(
        context: Context,
        sizePx: Int,
        progress: Float,
        trackColor: Int,
        arcColor: Int,
    ): Bitmap? {
        if (sizePx <= 0) return null
        return try {
            val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)

            val stroke = sizePx * STROKE_RATIO
            val radius = sizePx * RADIUS_RATIO
            val center = sizePx / 2f

            // الدائرة تُرسم على خطِّ منتصف نصف قطره 32px في viewBox 72×72
            // (cx=36 cy=36 r=32) — نفس قيم الـ SVG حرفيًا. الأطراف الدائرية
            // تمتد نصف سمك (2.75px) خارج خط المنتصف فتبلغ 34.75px، وهذا
            // داخل حدود الـ bitmap (36px) بلا أي قصّ.
            val oval = RectF(
                center - radius,
                center - radius,
                center + radius,
                center + radius,
            )

            // ── المسار الكامل (track) ────────────────────────────────
            val trackPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = stroke
                isDither = false
                color = trackColor
            }
            canvas.drawOval(oval, trackPaint)

            // ── القوس (arc) ──────────────────────────────────────────
            val p = progress.coerceIn(0f, 1f)
            if (p > 0f) {
                val arcPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    style = Paint.Style.STROKE
                    strokeWidth = stroke
                    strokeCap = Paint.Cap.ROUND   // stroke-linecap:round
                    isDither = false
                    color = arcColor
                }
                // rotate(-90deg) في SVG = البدء من أعلى.
                // drawArc: -90f هي أعلى الدائرة في إحداثيات Canvas.
                canvas.drawArc(oval, -90f, 360f * p, false, arcPaint)
            }

            bitmap
        } catch (error: Throwable) {
            android.util.Log.w("ArabicRing", "render failed: ${error.message}")
            null
        }
    }
}
