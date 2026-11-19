import { FIRST_HIJRI_YEAR, MONTH_START_RJD } from './month-starts';

const UNIX_EPOCH_RJD = 40588;
const DAY_MS = 86_400_000;
export type HijriDate = { year: number; month: number; day: number };

// Civil days deliberately use the device-local calendar date (the prayer
// card's day boundary), then UTC for arithmetic so DST cannot change day counts.
export function localCivilDay(date: Date): number {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS);
}

export function fromCivilDay(day: number): HijriDate | null {
  const rjd = day + UNIX_EPOCH_RJD;
  if (!Number.isInteger(day) || rjd < MONTH_START_RJD[0] || rjd >= MONTH_START_RJD[MONTH_START_RJD.length - 1]) return null;
  let lo = 0, hi = MONTH_START_RJD.length - 1;
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (MONTH_START_RJD[mid] <= rjd) lo = mid;
    else hi = mid;
  }
  return { year: FIRST_HIJRI_YEAR + Math.floor(lo / 12), month: lo % 12 + 1, day: rjd - MONTH_START_RJD[lo] + 1 };
}

export function toCivilDay(date: HijriDate): number | null {
  const index = (date.year - FIRST_HIJRI_YEAR) * 12 + date.month - 1;
  if (!Number.isInteger(date.year) || !Number.isInteger(date.month) || !Number.isInteger(date.day) || date.month < 1 || date.month > 12 || index < 0 || index + 1 >= MONTH_START_RJD.length || date.day < 1 || date.day > MONTH_START_RJD[index + 1] - MONTH_START_RJD[index]) return null;
  return MONTH_START_RJD[index] - UNIX_EPOCH_RJD + date.day - 1;
}

export const HIJRI_MONTH_NAMES = [
  'مُحَرَّم', 'صَفَر', 'رَبِيعُ الأَوَّل', 'رَبِيعُ الآخِر', 'جُمَادَى الأُولَى', 'جُمَادَى الثَّانِيَة',
  'رَجَب', 'شَعْبَان', 'رَمَضَان', 'شَوَّال', 'ذُو القَعْدَة', 'ذُو الحِجَّة',
] as const;

export const OCCASIONS = [
  { name: 'بداية العام الهجري', month: 1, day: 1 },
  { name: 'تذكير بصيام تاسوعاء', month: 1, day: 9 },
  { name: 'تذكير بصيام عاشوراء', month: 1, day: 10 },
  { name: 'شهر رمضان', month: 9, day: 1 },
  { name: 'تذكير بليلة القدر', month: 9, day: 20 },
  { name: 'عيد الفطر', month: 10, day: 1 },
  { name: 'تذكير بصيام الست من شوال', month: 10, day: 3 },
  { name: 'ليالي عشر ذي الحجة', month: 12, day: 1 },
  { name: 'تذكير بصيام يوم عرفة', month: 12, day: 9 },
  { name: 'عيد الأضحى', month: 12, day: 10 },
] as const;
