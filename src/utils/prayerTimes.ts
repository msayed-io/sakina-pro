/**
 * محوّل واجهة سكينة فوق منظومة Dar-Al-Hikayat المرجعية (src/lib/prayer-times.ts).
 *
 * كل الحسابات الفلكية (الخط الزمني المتصل UTC، الأوقات التابعة، المنطقة
 * الزمنية IANA) تتم في الملف المرجعي المنقول حرفيًا؛ هذا الملف يحوّل
 * النتائج فقط إلى أشكال العرض التي تعتمدها واجهة سكينة:
 * أرقام عربية مشرقية (٠١٢٣) وفصل ص/م في حقل مستقل.
 */
import {
  getDayPrayers,
  calculateSecondaryTimes,
  minutesFromMidnight,
} from "../lib/prayer-times";
import type { CalculationMethodId } from "../lib/prayer-config";
import { PRAYER_DEFINITIONS } from "../lib/prayer-config";
import type { CalculationMethod, AsrSchool } from "./locationDetection";

export type PrayerItem = {
  key: "fajr" | "sunrise" | "dhuhr" | "asr" | "maghrib" | "isha";
  name: string;
  time: string;
  meridiem: string;
  minutes: number;
  date?: Date;
};

export type SecondaryPrayerTimes = {
  duha: { time: string; meridiem: string };
  midnight: { time: string; meridiem: string };
  firstThird: { time: string; meridiem: string };
  lastThird: { time: string; meridiem: string };
};

/** تحويل طريقة حساب سكينة (أحرف كبيرة) إلى معرّف المنظومة المرجعية */
export function toCalculationMethodId(
  method: CalculationMethod,
): CalculationMethodId {
  switch (method) {
    case "EGYPTIAN":
      return "egyptian";
    case "UMM_AL_QURA":
      return "umm_al_qura";
    case "ISNA":
      return "isna";
    case "KARACHI":
      return "karachi";
    case "MWL":
    default:
      return "mwl";
  }
}

const ARABIC_INDIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toArabicIndicDigits(value: string): string {
  return value.replace(/\d/g, (digit) => ARABIC_INDIC_DIGITS[Number(digit)]);
}

/**
 * تفكيك نص الوقت المنسّق من المنظومة المرجعية ("5:30 ص") إلى
 * { time: "٥:٣٠", meridiem: "ص" } بأسلوب عرض سكينة (أرقام مشرقية).
 */
export function splitFormattedPrayerTime(formatted: string): {
  time: string;
  meridiem: string;
} {
  const match = formatted.match(/(\d{1,2}):(\d{2})\s*(ص|م)?/);
  if (!match) {
    return { time: toArabicIndicDigits(formatted), meridiem: "" };
  }
  const hour = Number(match[1]);
  const minute = match[2];
  const meridiem = match[3] ?? (hour >= 12 ? "م" : "ص");
  return {
    time: `${toArabicIndicDigits(String(hour))}:${toArabicIndicDigits(minute)}`,
    meridiem,
  };
}

/**
 * جدول صلوات يوم كامل (6 صلوات دون الضحى) عبر محرك المنظومة المرجعية.
 * يُغذّي مزامنة الإشعارات وشاشة إعدادات الصلاة.
 */
export function calculatePrayerTimes(
  date: Date,
  lat: number,
  lon: number,
  method: CalculationMethod,
  school: AsrSchool,
  timezoneId: string = "Africa/Cairo",
): PrayerItem[] {
  const { prayers } = getDayPrayers(
    lat,
    lon,
    date,
    toCalculationMethodId(method),
    timezoneId,
    school,
  );
  return prayers
    .filter((prayer) => prayer.prayerId !== "duha")
    .map((prayer) => {
      const { time, meridiem } = splitFormattedPrayerTime(
        prayer.timeFormatted ?? "",
      );
      return {
        key: prayer.prayerId as PrayerItem["key"],
        name: PRAYER_DEFINITIONS[prayer.prayerId].nameAr,
        time,
        meridiem,
        minutes: minutesFromMidnight(prayer.time, timezoneId),
        date: prayer.time,
      };
    });
}

/**
 * الأوقات التابعة (الضحى، منتصف الليل، الثلث الأول، الثلث الأخير)
 * بصيغة عرض سكينة، محسوبة بالكامل في المنظومة المرجعية.
 */
export function calculateSecondaryPrayerTimes(
  date: Date,
  lat: number,
  lon: number,
  method: CalculationMethod,
  school: AsrSchool,
  timezoneId: string = "Africa/Cairo",
): SecondaryPrayerTimes {
  const secondary = calculateSecondaryTimes(
    lat,
    lon,
    date,
    toCalculationMethodId(method),
    timezoneId,
    school,
  );
  return {
    duha: splitFormattedPrayerTime(secondary.duha),
    midnight: splitFormattedPrayerTime(secondary.midnight),
    firstThird: splitFormattedPrayerTime(secondary.firstThird),
    lastThird: splitFormattedPrayerTime(secondary.lastThird),
  };
}
