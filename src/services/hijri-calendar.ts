import { FIRST_HIJRI_YEAR, MONTH_START_RJD } from '../features/hijri-month/month-starts';

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


/** A positive offset advances the displayed Hijri date; it advances every
 * projected Gregorian occurrence by the same number of local civil days.
 * The saved setting is internal: the UI follows Umm al-Qura automatically. */
export type HijriOffset = -2 | -1 | 0 | 1 | 2;
export const DEFAULT_HIJRI_OFFSET: HijriOffset = 0;
const OFFSET_KEY = 'hijriOffset';
const observers = new Set<() => void>();
let hijriOffset: HijriOffset | undefined;

function validOffset(value: unknown): value is HijriOffset {
  return typeof value === 'number' && Number.isInteger(value) && value >= -2 && value <= 2;
}
function readOffset(): HijriOffset {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_HIJRI_OFFSET;
    const raw = localStorage.getItem(OFFSET_KEY);
    if (raw === null || !/^-?[0-2]$/.test(raw)) return DEFAULT_HIJRI_OFFSET;
    const value = Number(raw);
    return validOffset(value) ? value : DEFAULT_HIJRI_OFFSET;
  } catch { return DEFAULT_HIJRI_OFFSET; }
}
export function getHijriOffset(): HijriOffset {
  if (hijriOffset === undefined) hijriOffset = readOffset();
  return hijriOffset;
}
export function setHijriOffset(value: number): void {
  if (!validOffset(value)) throw new RangeError('hijriOffset must be an integer between -2 and 2');
  if (value === getHijriOffset()) return;
  hijriOffset = value;
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(OFFSET_KEY, String(value)); } catch { /* Still update the active app. */ }
  observers.forEach(callback => callback());
}
export function subscribeHijriOffset(callback: () => void): () => void {
  observers.add(callback);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== OFFSET_KEY && event.key !== null) return;
    const next = readOffset();
    if (next !== hijriOffset) { hijriOffset = next; observers.forEach(fn => fn()); }
  };
  if (typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => { observers.delete(callback); if (typeof window !== 'undefined') window.removeEventListener('storage', onStorage); };
}
export function hijriForDate(now: Date, offset: HijriOffset = getHijriOffset()): HijriDate | null {
  return fromCivilDay(localCivilDay(now) + offset);
}
export const arabicDigits = (value: number): string => String(value).replace(/[0-9]/g, digit => '٠١٢٣٤٥٦٧٨٩'[Number(digit)]);
export function formatHijriDate(date: HijriDate): string {
  return `${arabicDigits(date.day)} ${HIJRI_MONTH_NAMES[date.month - 1]} ${arabicDigits(date.year)}`;
}
export type HijriOccasion = { name: string; month: number; day: number; year: number; civil: number; days: number };
export function upcomingHijriOccasions(now: Date, offset: HijriOffset = getHijriOffset()): { today: HijriDate | null; upcoming: HijriOccasion[] } {
  const civilToday = localCivilDay(now);
  const today = fromCivilDay(civilToday + offset);
  if (!today) return { today: null, upcoming: [] };
  const upcoming: HijriOccasion[] = [];
  for (const occasion of OCCASIONS) {
    const baseCivil = toCivilDay({ ...occasion, year: today.year });
    if (baseCivil === null) continue;
    const civil = baseCivil - offset;
    const days = civil - civilToday;
    if (days >= 0) upcoming.push({ ...occasion, year: today.year, civil, days });
  }
  upcoming.sort((a,b) => a.civil-b.civil);
  return { today, upcoming };
}
export function formatDaysRemaining(days: number): string {
  if (!Number.isInteger(days) || days < 0) throw new RangeError('days must be a non-negative integer');
  if (days === 0) return 'اليوم';
  if (days === 1) return 'غداً';
  if (days === 2) return 'بعد غد';
  return `بعد ${arabicDigits(days)} ${days <= 10 ? 'أيام' : 'يوماً'}`;
}
