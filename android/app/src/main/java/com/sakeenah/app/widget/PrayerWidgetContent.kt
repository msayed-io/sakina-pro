package com.sakeenah.app.widget

import android.content.Context
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.DpSize
import androidx.compose.ui.unit.dp
import androidx.glance.GlanceModifier
import androidx.glance.LocalContext
import androidx.glance.action.clickable
import androidx.glance.appwidget.action.actionStartActivity
import androidx.glance.appwidget.cornerRadius
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.ColumnScope
import androidx.glance.layout.Row
import androidx.glance.layout.RowScope
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * PrayerWidgetContent — التصميم المتجاوب للويدجت.
 *
 * الهوية البصرية مستخرجة حرفيًا من بطاقة الصلاة في الشاشة الرئيسية
 * (App.tsx:1223، مادة cut-crystal-satin) — التفاصيل في
 * docs/widget-design-tokens.md
 *
 * كل النصوص تُرسم بـ BrandText (خطوط سَكِينَة الأصلية، صفر Bitmap).
 * العدّاد يُرسم بـ buildChronometer (Chronometer أصلي، صفر استهلاك).
 */
internal object PrayerWidgetSizes {
    val COMPACT = DpSize(250.dp, 60.dp)
    val DETAILED = DpSize(250.dp, 120.dp)
    val NARROW = DpSize(180.dp, 60.dp)
    val ALL = setOf(COMPACT, DETAILED, NARROW)
}

private val ARABIC = Locale.forLanguageTag("ar")

@Composable
internal fun PrayerWidgetContent(
    data: WidgetData,
    size: DpSize,
    isKeyguard: Boolean = false,
) {
    val context = LocalContext.current
    val nowMs = System.currentTimeMillis()
    val next = data.nextPrayer(nowMs)

    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetPalette.page(context))
            .clickable(
                actionStartActivity(
                    android.content.Intent(context, com.sakeenah.app.MainActivity::class.java)
                        .addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK),
                ),
            ),
    ) {
        when {
            !data.hasLocation -> EmptyState(context)
            size.height < 90.dp -> CompactLayout(context, data, next, nowMs, isKeyguard)
            else -> DetailedLayout(context, data, next, nowMs, isKeyguard)
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  الحالة الفارغة الآمنة — قبل تحديد الموقع
// ─────────────────────────────────────────────────────────────────────────
@Composable
private fun EmptyState(context: Context) {
    Row(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetPalette.card(context))
            .cornerRadius(26.dp)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BrandText(
            text = "سَكِينَة",
            sizeSp = 16f,
            color = rawLabel(context),
            face = BrandFace.SERIF,
        )
        Spacer(modifier = GlanceModifier.width(10.dp))
        BrandText(
            text = "افتح سَكِينَة لتحديد موقعك",
            sizeSp = 11f,
            color = rawLabel2(context),
            face = BrandFace.SANS,
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  4x1 — المدمج
// ─────────────────────────────────────────────────────────────────────────
@Composable
private fun CompactLayout(
    context: Context,
    data: WidgetData,
    next: WidgetData.Slot?,
    nowMs: Long,
    isKeyguard: Boolean,
) {
    Row(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetPalette.card(context))
            .cornerRadius(26.dp)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // اسم الصلاة القادمة
        Column(modifier = GlanceModifier.defaultWeight()) {
            BrandText(
            text = "الصلاة القادمة",
            sizeSp = 10f,
            color = rawLabel2(context),
            face = BrandFace.SANS,
        )
            Spacer(modifier = GlanceModifier.height(2.dp))
            BrandText(
            text = next?.name ?: "—",
            sizeSp = 20f,
            color = rawAccent(context),
            face = BrandFace.SERIF,
        )
        }

        // العدّاد التنازلي — Chronometer أصلي
        if (next != null) {
            val remainingMs = (next.timeMs - nowMs).coerceAtLeast(0L)
            val urgent = remainingMs in 1..(10 * 60 * 1000L)
            androidx.glance.appwidget.AndroidRemoteViews(
                    remoteViews = buildChronometerRemoteViews(
                        packageName = context.packageName,
                        remainingMs = remainingMs,
                        color = if (urgent) rawDanger(context) else rawLabel(context),
                        sizeSp = 13f,
                    ),
                    modifier = GlanceModifier.width(58.dp),
                )
        }

        // وقت الصلاة + التاريخ الهجري
        if (!isKeyguard) {
            Spacer(modifier = GlanceModifier.width(8.dp))
            Column(
                modifier = GlanceModifier.defaultWeight(),
                horizontalAlignment = Alignment.End,
            ) {
                BrandText(
                    text = next?.let { formatClock(context, it.timeMs) } ?: "—",
                    sizeSp = 15f,
                    color = rawLabel(context),
                    face = BrandFace.SANS,
                )
                Spacer(modifier = GlanceModifier.height(2.dp))
                BrandText(
            text = data.hijriDate ?: "",
            sizeSp = 10f,
            color = rawLabel3(context),
            face = BrandFace.SANS,
        )
            }
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  4x2 — التفصيلي
// ─────────────────────────────────────────────────────────────────────────
@Composable
private fun DetailedLayout(
    context: Context,
    data: WidgetData,
    next: WidgetData.Slot?,
    nowMs: Long,
    isKeyguard: Boolean,
) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetPalette.card(context))
            .cornerRadius(26.dp)
            .padding(horizontal = 16.dp, vertical = 12.dp),
    ) {
        Row(
            modifier = GlanceModifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = GlanceModifier.defaultWeight()) {
                BrandText(
            text = "الصلاة القادمة",
            sizeSp = 10f,
            color = rawLabel2(context),
            face = BrandFace.SANS,
        )
                Spacer(modifier = GlanceModifier.height(2.dp))
                BrandText(
            text = next?.name ?: "—",
            sizeSp = 22f,
            color = rawAccent(context),
            face = BrandFace.SERIF,
        )
            }

            if (next != null) {
                val remainingMs = (next.timeMs - nowMs).coerceAtLeast(0L)
                val urgent = remainingMs in 1..(10 * 60 * 1000L)
                androidx.glance.appwidget.AndroidRemoteViews(
                    remoteViews = buildChronometerRemoteViews(
                        packageName = context.packageName,
                        remainingMs = remainingMs,
                        color = if (urgent) rawDanger(context) else rawLabel(context),
                        sizeSp = 15f,
                    ),
                    modifier = GlanceModifier.width(66.dp),
                )
            }

            if (!isKeyguard) {
                Spacer(modifier = GlanceModifier.width(10.dp))
                Column(
                    modifier = GlanceModifier.defaultWeight(),
                    horizontalAlignment = Alignment.End,
                ) {
                    BrandText(
            text = data.cityName ?: "",
            sizeSp = 13f,
            color = rawLabel(context),
            face = BrandFace.SANS,
        )
                    Spacer(modifier = GlanceModifier.height(2.dp))
                    BrandText(
            text = data.hijriDate ?: "",
            sizeSp = 10f,
            color = rawLabel3(context),
            face = BrandFace.SANS,
        )
                }
            }
        }

        Spacer(modifier = GlanceModifier.height(10.dp))

        // فاصل — border-[#e6dccf]/60 من البطاقة الأصلية
        Box(
            modifier = GlanceModifier
                .fillMaxWidth()
                .height(1.dp)
                .background(WidgetPalette.separator(context)),
        ) {}

        Spacer(modifier = GlanceModifier.height(8.dp))

        // شريط المواقيت الست
        val slots = data.todaySlots()
        if (slots.isNotEmpty()) {
            Row(modifier = GlanceModifier.fillMaxWidth()) {
                for (slot in slots) {
                    PrayerTimeCell(
                        context = context,
                        slot = slot,
                        isNext = slot.key == next?.key,
                        isPast = slot.timeMs < nowMs,
                    )
                }
            }
        }
    }
}

@Composable
private fun RowScope.PrayerTimeCell(
    context: Context,
    slot: WidgetData.Slot,
    isNext: Boolean,
    isPast: Boolean,
) {
    val nameColor = when {
        isNext -> rawAccent(context)
        isPast -> rawLabel3(context)
        else -> rawLabel2(context)
    }
    val timeColor = when {
        isNext -> rawAccent(context)
        isPast -> rawLabel3(context)
        else -> rawLabel(context)
    }

    Column(
        modifier = GlanceModifier.defaultWeight(),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BrandText(
            text = slot.name,
            sizeSp = 9f,
            color = nameColor,
            face = BrandFace.SANS,
        )
        Spacer(modifier = GlanceModifier.height(3.dp))
        BrandText(
            text = formatClock(context, slot.timeMs),
            sizeSp = 10f,
            color = timeColor,
            face = BrandFace.SANS,
        )
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  تنسيق الوقت — يحترم إعداد 12/24 ساعة في النظام
// ─────────────────────────────────────────────────────────────────────────
private fun formatClock(context: Context, timeMs: Long): String {
    val pattern = if (android.text.format.DateFormat.is24HourFormat(context)) "HH:mm" else "h:mm a"
    return try {
        SimpleDateFormat(pattern, ARABIC).format(Date(timeMs))
    } catch (_: Exception) {
        SimpleDateFormat("HH:mm", Locale.US).format(Date(timeMs))
    }
}

// ─────────────────────────────────────────────────────────────────────────
//  ألوان خام — تمرَّر إلى TextView مباشرة (AndroidRemoteViews)
// ─────────────────────────────────────────────────────────────────────────
internal fun rawLabel(context: Context): Int =
    if (WidgetPalette.isDark(context)) 0xFFFFFFFF.toInt() else 0xFF2B1A10.toInt()

internal fun rawLabel2(context: Context): Int =
    if (WidgetPalette.isDark(context)) 0x99EBEBF5.toInt() else 0xFF7F6A55.toInt()

internal fun rawLabel3(context: Context): Int =
    if (WidgetPalette.isDark(context)) 0x4DEBEBF5.toInt() else 0xFFA39282.toInt()

internal fun rawAccent(context: Context): Int =
    if (WidgetPalette.isDark(context)) 0xFFEEDFC2.toInt() else 0xFFB88A4F.toInt()

internal fun rawDanger(context: Context): Int =
    if (WidgetPalette.isDark(context)) 0xFFFF4245.toInt() else 0xFFC94A4A.toInt()
