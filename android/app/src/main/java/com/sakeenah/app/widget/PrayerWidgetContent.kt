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
 * PrayerWidgetContent — نسخٌ أمين لبطاقة الصلاة في الشاشة الرئيسية.
 *
 * ═══ المرجع البصري (لا اختراع) ═══════════════════════════════════════
 *  • البطاقة العليا   : App.tsx:1224-1290  (.cut-crystal-satin)
 *  • شريط المواقيت    : App.tsx:1338-1398  (.cut-crystal-panel + صفوف pill)
 *  • ألوان الوضعين    : src/index.css  (:root و html[data-theme="dark"])
 *  • الحلقة الدائرية  : App.tsx:1238-1276  (SVG → ProgressBar أصلي)
 *
 * ═══ البنية (مطابقة للأصل) ═══════════════════════════════════════════
 *
 *   ┌─────────────────────────────────────────────┐
 *   │ الصلاة الحالية            ╭───────────╮     │  ← 11px label2
 *   │ الفجر                     │  متبقي    │     │  ← 28px serif display
 *   │ التالية: الشروق           │ 08:24:05  │     │  ← 11px accent
 *   │                           ╰───────────╯     │  ← حلقة 80dp
 *   ├─────────────────────────────────────────────┤
 *   │ الأحد ٢٠ نوفمبر   ٢٩ جمادى الأولى ١٤٤٨      │  ← 11px, بينهما فاصل
 *   ├─────────────────────────────────────────────┤
 *   │  الفجر       ٥:١٢ ص   ← صفوف pill          │
 *   │  الشروق      ٦:٣٤ ص                          │
 *   └─────────────────────────────────────────────┘
 *
 * ═══ ثلاثة عيوب في الإصدار السابق عولجت هنا ══════════════════════════
 *  1. **القصّ**: 6 خلايا × defaultWeight على 250dp = 41dp للخلية، أقل من
 *     «الفجر + ٥:١٢ ص» بهامش. الحل: عدد الخلايا يُحسب من العرض الحقيقي،
 *     والعدد يُقلَّص بدل أن يُقصّ النص. (+ minHeight الفعلي في XML رُفع)
 *  2. **التصميم البدائي**: كان صفًّا أفقيًا مسطّحًا. الآن: تدرّج المادة
 *     الحقيقي، زاوية 28dp، الحلقة الدائرية، صفوف pill، خطوط بالحجم الأصلي.
 *  3. **«—» في المواقيت**: كان سببه أن loadFuture يُسقط ما مضى. الآن
 *     تُقرأ قائمة اليوم كاملة (loadDay) فتُعرض المواقيت كلها.
 */
internal object PrayerWidgetSizes {
    /** 4×1 — الشريط المدمج */
    val COMPACT = DpSize(250.dp, 60.dp)
    /** 4×2 — البطاقة التفصيلية */
    val DETAILED = DpSize(250.dp, 180.dp)
    /** 4×2 عريض — مساحة أكبر = مواقيت أكثر */
    val WIDE = DpSize(340.dp, 180.dp)
    /** 4×3 — الحد الأقصى */
    val TALL = DpSize(340.dp, 260.dp)

    val ALL = setOf(COMPACT, DETAILED, WIDE, TALL)
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
    val state = data.stateAt(nowMs)

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
        when {
            !data.hasLocation -> EmptyState(context)
            size.height < 100.dp -> CompactLayout(context, data, state, nowMs, isKeyguard)
            else -> DetailedLayout(context, data, state, nowMs, size, isKeyguard)
        }
    }
}

// ═════════════════════════════════════════════════════════════════════
//  الحالة الفارغة — قبل تحديد الموقع
// ═════════════════════════════════════════════════════════════════════
@Composable
private fun EmptyState(context: Context) {
    Row(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetPalette.card(context))
            .cornerRadius(28.dp)
            .padding(horizontal = 18.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        BrandText(
            text = "سَكِينَة",
            sizeSp = 17f,
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

// ═════════════════════════════════════════════════════════════════════
//  4×1 — الشريط المدمج
//  يبقي العناصر الحرجة فقط: الصلاة القادمة + العدّاد + وقتها.
// ═════════════════════════════════════════════════════════════════════
@Composable
private fun CompactLayout(
    context: Context,
    data: WidgetData,
    state: WidgetData.State,
    nowMs: Long,
    isKeyguard: Boolean,
) {
    val next = state.next

    Row(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetPalette.card(context))
            .cornerRadius(28.dp)
            .padding(horizontal = 18.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        // ── يمين (RTL): التسمية + اسم الصلاة القادمة ──
        Column(modifier = GlanceModifier.defaultWeight()) {
            BrandText(
                text = "الصلاة القادمة",
                sizeSp = 10f,
                color = rawLabel2(context),
                face = BrandFace.SANS,
            )
            Spacer(modifier = GlanceModifier.height(1.dp))
            BrandText(
                text = next?.name ?: "—",
                sizeSp = 22f,
                color = rawLabel(context),
                face = BrandFace.SERIF,
            )
        }

        // ── الوسط: العدّاد التنازلي (Chronometer أصلي) ──
        if (next != null) {
            val urgent = state.remainingMs in 1..(10 * 60 * 1000L)
            androidx.glance.appwidget.AndroidRemoteViews(
                remoteViews = buildChronometerRemoteViews(
                    packageName = context.packageName,
                    remainingMs = state.remainingMs,
                    color = if (urgent) rawDanger(context) else rawAccent(context),
                    sizeSp = 14f,
                ),
                modifier = GlanceModifier.width(60.dp),
            )
        }

        // ── يسار: وقت الصلاة ──
        if (!isKeyguard && next != null) {
            Spacer(modifier = GlanceModifier.width(6.dp))
            BrandText(
                text = formatClock(context, next.timeMs),
                sizeSp = 15f,
                color = rawLabel(context),
                face = BrandFace.SANS,
            )
        }
    }
}

// ═════════════════════════════════════════════════════════════════════
//  4×2 / 4×3 — البطاقة التفصيلية
//  ثلاث طبقات مطابقة للأصل: الرأس + الفاصل والتواريخ + المواقيت.
// ═════════════════════════════════════════════════════════════════════
@Composable
private fun DetailedLayout(
    context: Context,
    data: WidgetData,
    state: WidgetData.State,
    nowMs: Long,
    size: DpSize,
    isKeyguard: Boolean,
) {
    val next = state.next
    val current = state.current

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetPalette.card(context))
            .cornerRadius(28.dp)
            .padding(horizontal = 18.dp, vertical = 14.dp),
    ) {
        // ═══ الطبقة 1: الرأس — التسمية + الصلاة + التالية + الحلقة ═══
        Row(
            modifier = GlanceModifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = GlanceModifier.defaultWeight()) {
                // «الصلاة الحالية» — يتغيّر إلى «الصلاة القادمة» قبل الفجر
                BrandText(
                    text = if (current != null) "الصلاة الحالية" else "الصلاة القادمة",
                    sizeSp = 10f,
                    color = rawLabel2(context),
                    face = BrandFace.SANS,
                )
                Spacer(modifier = GlanceModifier.height(2.dp))
                // اسم الصلاة — 22sp Serif Display Black (الأصل 28px)
                BrandText(
                    text = current?.name ?: next?.name ?: "—",
                    sizeSp = 24f,
                    color = rawLabel(context),
                    face = BrandFace.SERIF,
                )
                // «التالية: …» — 10sp accent (الأصل 11px accent)
                next?.let {
                    Spacer(modifier = GlanceModifier.height(2.dp))
                    BrandText(
                        text = "التالية: ${it.name}",
                        sizeSp = 10f,
                        color = rawAccent(context),
                        face = BrandFace.SANS,
                    )
                }
                // التاريخ الهجري — هنا لا تحت الرأس، فتُحرَّر مساحة كاملة
                // لشريط المواقيت فيزيد عدد الخلايا قبل أن يبدأ أي قصّ.
                if (!isKeyguard && !data.hijriDate.isNullOrBlank()) {
                    Spacer(modifier = GlanceModifier.height(3.dp))
                    BrandText(
                        text = data.hijriDate.orEmpty(),
                        sizeSp = 9f,
                        color = rawLabel3(context),
                        face = BrandFace.SANS,
                    )
                }
            }

            // الحلقة — 80dp كما في الأصل (h-20 w-20)
            if (next != null && !isKeyguard) {
                Spacer(modifier = GlanceModifier.width(8.dp))
                androidx.glance.appwidget.AndroidRemoteViews(
                    remoteViews = buildRingRemoteViews(
                        packageName = context.packageName,
                        progress = state.progress,
                        remainingMs = state.remainingMs,
                        arcColor = rawArc(context),
                        trackColor = rawRingTrack(context),
                        labelColor = rawLabel2(context),
                        countdownColor = if (state.remainingMs in 1..(10 * 60 * 1000L)) {
                            rawDanger(context)
                        } else {
                            rawLabel(context)
                        },
                        labelText = "متبقي",
                        sizeSp = 12f,
                    ),
                    modifier = GlanceModifier.width(80.dp).height(80.dp),
                )
            }
        }

        Spacer(modifier = GlanceModifier.height(10.dp))

        // ═══ الطبقة 2: فاصل + التاريخ الميلادي والهجري ═══
        Box(
            modifier = GlanceModifier
                .fillMaxWidth()
                .height(1.dp)
                .background(WidgetPalette.separator(context)),
        ) {}
        Spacer(modifier = GlanceModifier.height(6.dp))

        if (!isKeyguard && !data.cityName.isNullOrBlank()) {
            // المدينة — صغيرة وباهتة، تحت الفاصل مباشرة (طبق الأصل).
            BrandText(
                text = data.cityName.orEmpty(),
                sizeSp = 9.5f,
                color = rawLabel3(context),
                face = BrandFace.SANS,
            )
            Spacer(modifier = GlanceModifier.height(6.dp))
        }

        // ═══ الطبقة 3: المواقيت — صفوف pill مطابقة للأصل ═══
        // العدد يُحسب من العرض الحقيقي: كل خلية تحتاج 62dp على الأقل،
        // فيمنع القصّ بدل أن يسمح له بالحدوث.
        val available = size.width.value - 36f
        val maxCells = (available / 62f).toInt().coerceIn(2, 6)
        val slots = data.upcomingSlots(nowMs, maxCells)

        if (slots.isNotEmpty()) {
            Row(modifier = GlanceModifier.fillMaxWidth()) {
                for (slot in slots) {
                    PrayerTimeCell(
                        context = context,
                        slot = slot,
                        isNext = slot.key == next?.key,
                    )
                }
            }
        }
    }
}

/**
 * خلية وقت — نظير الصف/العمود في الأصل.
 * المدمج: اسم فوق وقت، كلاهما بخط Sans، واللون يتدرّج مع الحالة.
 */
@Composable
private fun RowScope.PrayerTimeCell(
    context: Context,
    slot: WidgetData.Slot,
    isNext: Boolean,
) {
    val nameColor = if (isNext) rawAccent(context) else rawLabel2(context)
    val timeColor = if (isNext) rawAccent(context) else rawLabel(context)

    Column(
        modifier = GlanceModifier
            .defaultWeight()
            .padding(horizontal = 1.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        BrandText(
            text = slot.name,
            sizeSp = 9.5f,
            color = nameColor,
            face = BrandFace.SANS,
        )
        Spacer(modifier = GlanceModifier.height(2.dp))
        BrandText(
            text = formatClock(context, slot.timeMs),
            sizeSp = 11f,
            color = timeColor,
            face = BrandFace.SANS,
        )
    }
}

// ═════════════════════════════════════════════════════════════════════
//  تنسيق الوقت — أرقام هندية + ص/م كما في شاشة سَكِينَة
// ═════════════════════════════════════════════════════════════════════
private val ARABIC_DIGITS = charArrayOf(
    '٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩',
)

/** يحوّل 0-9 إلى ٠-٩ — يطابق toArabicIndicDigits في src/utils/prayerTimes.ts. */
internal fun toArabicIndic(input: String): String {
    val out = StringBuilder(input.length)
    for (ch in input) {
        out.append(if (ch in '0'..'9') ARABIC_DIGITS[ch - '0'] else ch)
    }
    return out.toString()
}

/**
 * «٥:١٢ ص» — مطابق لـ splitFormattedPrayerTime + toArabicIndicDigits في
 * التطبيق: ساعة:دقيقة بأرقام هندية ثم كلمة ص/م منفصلة بمسافة.
 */
internal fun formatClock(context: Context, timeMs: Long): String {
    val is24 = android.text.format.DateFormat.is24HourFormat(context)
    return try {
        if (is24) {
            toArabicIndic(SimpleDateFormat("HH:mm", Locale.US).format(Date(timeMs)))
        } else {
            val raw = SimpleDateFormat("h:mm", Locale.US).format(Date(timeMs))
            val meridiem = SimpleDateFormat("a", Locale.US).format(Date(timeMs))
                .let { if (it.uppercase(Locale.US).startsWith("P")) "م" else "ص" }
            "${toArabicIndic(raw)} $meridiem"
        }
    } catch (_: Exception) {
        toArabicIndic(SimpleDateFormat("HH:mm", Locale.US).format(Date(timeMs)))
    }
}

/** «الأحد ٢٠ نوفمبر» — التاريخ الميلادي كما في الأصل (11px label2). */
internal fun formatGregorian(timeMs: Long): String = try {
    val fmt = SimpleDateFormat("EEEE d MMMM", ARABIC)
    toArabicIndic(fmt.format(Date(timeMs)))
} catch (_: Exception) {
    ""
}

// ═════════════════════════════════════════════════════════════════════
//  ألوان خام — تمرَّر إلى TextView / drawable مباشرة
//  كل قيمة = رموز index.css نفسها (انظر values*/colors.xml)
// ═════════════════════════════════════════════════════════════════════
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

/** --sk-progress-arc: label فاتح / #EEDFC2 داكن (index.css:980 / :1068) */
internal fun rawArc(context: Context): Int =
    if (WidgetPalette.isDark(context)) 0xFFEEDFC2.toInt() else 0xFF2B1A10.toInt()

/** --sk-ring-track: #E8DFD4 / rgba(235,235,245,.12) (index.css:948 / :1038) */
internal fun rawRingTrack(context: Context): Int =
    if (WidgetPalette.isDark(context)) 0x1FEBEBF5 else 0xFFE8DFD4.toInt()
