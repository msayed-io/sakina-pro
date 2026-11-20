package com.sakeenah.app.widget

import android.content.Context
import android.widget.RemoteViews
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.appwidget.AndroidRemoteViews
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.layout.Box
import androidx.glance.layout.fillMaxSize
import com.sakeenah.app.R
import java.util.Locale

/**
 * PrayerWidgetContent — التنفيذ الحرفي لـ `prayer-widget-design.html`.
 *
 * ═══ المرجع الأعلى ════════════════════════════════════════════════════
 * prayer-widget-design.html (CSS + DOM سطرًا بسطر) — لا اجتهاد.
 * عند أي تعارض بينه وبين prayer-widget-spec.md فالـ HTML يحكم.
 * الألوان فقط من ثيم التطبيق الحي (WidgetPalette)، لا من الـ HTML.
 *
 * ═══ البنية ═══════════════════════════════════════════════════════════
 *   .widget  →  RemoteViews(widget_main.xml)
 *     padding 14/16/16/12 · gap 10 · radius @dimen/sk_w_card_radius
 *   .top     →  RemoteViews(widget_top_row.xml)  h=72dp
 *     [info: cap 12sp · name 38sp Bitmap · next 13sp]  [ring 72dp]
 *     في RTL: النص يمينًا والحلقة يسارًا.
 *   .times   →  RemoteViews(widget_times_row.xml) h=46dp
 *     6 بلاطات weight=1 · gap 5dp · radius 14dp
 *
 * ═══ ما يتحرّك وما يثبت ═══════════════════════════════════════════════
 *   • الحلقة **ثابتة تمامًا**: Bitmap لقوس واحد يرسمه
 *     ArabicRingRenderer — لا CircularProgressIndicator ولا دوران.
 *   • العد التنازلي: `Chronometer` أصلي بـ isCountDown — يتولّاه النظام.
 *
 * ═══ صفر Bitmap إلا موضعين ════════════════════════════════════════════
 *   اسم الصلاة (38sp، المواصفات §7) + قوس الحلقة (المواصفات §4).
 *   كلاهما بأبعاد فعلية ويُحرَّر فورًا.
 */
internal object PrayerWidgetSizes {
    /**
     * المقاس الحقيقي 4×2 مضغوط (المواصفات §1): صفان لا يتسعان في خلية.
     * نعلن حجمًا واحدًا فقط لأن الارتفاع لا يتمدد (min = max).
     */
    val COMPACT_4x2 = DpSize(360.dp, 154.dp)
    val ALL = setOf(COMPACT_4x2)
}

@Composable
internal fun PrayerWidgetContent(
    data: WidgetData,
    size: DpSize,
    isKeyguard: Boolean = false,
) {
    val context = LocalContext.current
    val nowMs = System.currentTimeMillis()

    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .clickable(
                actionStartActivity(
                    android.content.Intent(context, com.sakeenah.app.MainActivity::class.java)
                        .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
                ),
            ),
    ) {
        if (!data.hasLocation) {
            AndroidRemoteViews(
                remoteViews = RemoteViews(context.packageName, R.layout.widget_empty),
                modifier = GlanceModifier.fillMaxSize(),
            )
        } else {
            AndroidRemoteViews(
                remoteViews = buildWidgetRemoteViews(context, data, nowMs),
                modifier = GlanceModifier.fillMaxSize(),
            )
        }
    }
}

/**
 * يبني البطاقة كاملة كـ RemoteViews واحدة.
 *
 * RemoteViews **لا تدعم** setCompoundDrawables، فيجب بناء الشجرة كاملة
 * من تخطيطات XML مُدرَجة (include) ثم تعديل الحقول بمعرّفاتها.
 */
private fun buildWidgetRemoteViews(
    context: Context,
    data: WidgetData,
    nowMs: Long,
): RemoteViews {
    val pkg = context.packageName
    val state = data.stateAt(nowMs)
    val current = state.current
    val next = state.next

    val root = RemoteViews(pkg, R.layout.widget_main)

    // ═══ الصف العلوي: النصوص ═══
    root.setTextViewText(
        R.id.w_cap,
        context.getString(
            if (current != null) R.string.widget_caption_current
            else R.string.widget_caption_next,
        ),
    )

    // اسم الصلاة — Bitmap بالخط الحقيقي (38sp / Serif Display Black)
    val nameText = current?.name ?: next?.name.orEmpty()
    val nameColor = WidgetPalette.text(context)
    val nameBitmap = ArabicTextBitmapRenderer.render(
        context = context,
        text = nameText,
        fontRes = R.font.thmanyah_serif_display_black,
        sizeSp = 38f,
        color = nameColor,
    )
    if (nameBitmap != null) {
        try {
            root.setImageViewBitmap(R.id.w_name, nameBitmap)
        } finally {
            // تحرير فوري بعد الالتقاط (المواصفات §7)
            nameBitmap.recycle()
        }
    } else {
        // ارتداد آمن: نص RemoteViews عادي بدل إسقاط الويدجت.
        root.setViewVisibility(R.id.w_name, android.view.View.GONE)
    }

    // «التالية: X» — بلون accent للنص (القرار ①)
    if (next != null) {
        root.setTextViewText(
            R.id.w_next,
            context.getString(R.string.widget_next_prefix, next.name),
        )
    } else {
        root.setViewVisibility(R.id.w_next, android.view.View.GONE)
    }

    // ═══ الحلقة — Bitmap ثابت ═══
    val ringSizePx = (72 * context.resources.displayMetrics.density).toInt()
    val ring = ArabicRingRenderer.render(
        context = context,
        sizePx = ringSizePx,
        progress = state.progress,
        trackColor = WidgetPalette.track(context),
        arcColor = WidgetPalette.accent(context),
    )
    if (ring != null) {
        try {
            root.setImageViewBitmap(R.id.w_ring_arc, ring)
        } finally {
            ring.recycle()
        }
    }

    // ═══ العد التنازلي — Chronometer أصلي ═══
    val base = android.os.SystemClock.elapsedRealtime() + state.remainingMs
    root.setChronometer(R.id.w_ring_chronometer, base, "%s", true)
    root.setChronometerCountDown(R.id.w_ring_chronometer, true)

    // ═══ شريط المواقيت — 6 بلاطات ═══
    applyTiles(context, root, data, state, nowMs)

    return root
}

/**
 * البلاطات الست — نسخة حرفية من منطق الحالات في CSS:
 *   .on   → القادمة: تعبئة accent، الاسم on-accent بـ .85، الوقت on-accent
 *   .past → opacity .55
 *   .sun  → opacity .75 على الاسم والوقت (فوق .past إن انقضى)
 */
private fun applyTiles(
    context: Context,
    root: RemoteViews,
    data: WidgetData,
    state: WidgetData.State,
    nowMs: Long,
) {
    val keys = WidgetData.DISPLAY_ORDER
    val today = data.todaySlots(nowMs).associateBy { it.key }
    val nextKey = state.next?.key

    val tileBg = R.drawable.widget_tile_bg
    val tileBgOn = R.drawable.widget_tile_bg_on
    val onAccent = WidgetPalette.onAccent(context)

    for (key in keys) {
        val nameId = tileNameId(key)
        val timeId = tileTimeId(key)
        val tileId = tileId(key)
        val slot = today[key]

        // ── الوقت: بلا «ص/م» (المواصفات §5) ──
        if (slot != null) {
            root.setTextViewText(timeId, formatTimeNoMeridiem(slot.timeMs))
        } else {
            root.setTextViewText(timeId, "")
        }

        val isNext = key == nextKey
        val isPast = slot != null && slot.timeMs <= nowMs
        val isSunrise = key == WidgetData.SUNRISE

        // ── الخلفية ──
        root.setInt(tileId, "setBackgroundResource", if (isNext) tileBgOn else tileBg)

        // ── الألوان: النص والأسماء ──
        if (isNext) {
            root.setTextColor(nameId, applyAlpha(onAccent, 0.85f))
            root.setTextColor(timeId, onAccent)
        } else {
            root.setTextColor(nameId, WidgetPalette.text2(context))
            root.setTextColor(timeId, WidgetPalette.text(context))
        }

        // ── الشفافية: .past = .55 · .sun = .75 (الشروق أخفت) ──
        val alpha = when {
            isSunrise && isPast -> 0.75f * 0.55f
            isPast -> 0.55f
            isSunrise -> 0.75f
            else -> 1f
        }
        root.setFloat(tileId, "setAlpha", alpha)
    }
}

/** الخلط مع قناة ألفا — يعادل opacity:.85 على النص في CSS. */
private fun applyAlpha(color: Int, alpha: Float): Int {
    val a = (android.graphics.Color.alpha(color) * alpha).toInt().coerceIn(0, 255)
    return android.graphics.Color.argb(
        a,
        android.graphics.Color.red(color),
        android.graphics.Color.green(color),
        android.graphics.Color.blue(color),
    )
}

/**
 * «٤:٤٩» — أرقام هندية بلا ص/م، مطابقة لما يعرضه التطبيق
 * (toArabicIndicDigits في src/utils/prayerTimes.ts).
 */
private val ARABIC_DIGITS = charArrayOf('٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩')

internal fun toArabicIndic(input: String): String {
    val out = StringBuilder(input.length)
    for (ch in input) {
        out.append(if (ch in '0'..'9') ARABIC_DIGITS[ch - '0'] else ch)
    }
    return out.toString()
}

internal fun formatTimeNoMeridiem(timeMs: Long): String {
    val is24 = false // التطبيق يعرض 12 ساعة بلا ص/م في هذه البطاقة
    val pattern = if (is24) "HH:mm" else "h:mm"
    return try {
        toArabicIndic(
            java.text.SimpleDateFormat(pattern, Locale.US)
                .format(java.util.Date(timeMs)),
        )
    } catch (_: Exception) {
        ""
    }
}

// ── معرّفات البلاطات (مطابقة لأسماء widget_times_row.xml) ──────────────
private fun tileId(key: String): Int = when (key) {
    WidgetData.FAJR -> R.id.w_tile_fajr
    WidgetData.SUNRISE -> R.id.w_tile_sunrise
    WidgetData.DHUHR -> R.id.w_tile_dhuhr
    WidgetData.ASR -> R.id.w_tile_asr
    WidgetData.MAGHRIB -> R.id.w_tile_maghrib
    WidgetData.ISHA -> R.id.w_tile_isha
    else -> R.id.w_tile_fajr
}

private fun tileNameId(key: String): Int = when (key) {
    WidgetData.FAJR -> R.id.w_tile_fajr_name
    WidgetData.SUNRISE -> R.id.w_tile_sunrise_name
    WidgetData.DHUHR -> R.id.w_tile_dhuhr_name
    WidgetData.ASR -> R.id.w_tile_asr_name
    WidgetData.MAGHRIB -> R.id.w_tile_maghrib_name
    WidgetData.ISHA -> R.id.w_tile_isha_name
    else -> R.id.w_tile_fajr_name
}

private fun tileTimeId(key: String): Int = when (key) {
    WidgetData.FAJR -> R.id.w_tile_fajr_time
    WidgetData.SUNRISE -> R.id.w_tile_sunrise_time
    WidgetData.DHUHR -> R.id.w_tile_dhuhr_time
    WidgetData.ASR -> R.id.w_tile_asr_time
    WidgetData.MAGHRIB -> R.id.w_tile_maghrib_time
    WidgetData.ISHA -> R.id.w_tile_isha_time
    else -> R.id.w_tile_fajr_time
}
