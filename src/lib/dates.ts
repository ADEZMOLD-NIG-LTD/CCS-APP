/**
 * Date helpers. All "day" and "month" values the user picks are LOCAL calendar values
 * (the business operates in WAT). Never derive them from toISOString(), which is UTC and
 * shifts the day/month around midnight.
 */

const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD for the given date in the user's local timezone. */
export function toLocalDateString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** YYYY-MM for the given date in the user's local timezone. */
export function toLocalMonthString(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export const todayLocal = () => toLocalDateString(new Date());
export const currentMonthLocal = () => toLocalMonthString(new Date());

/** Local date N days before today as YYYY-MM-DD. */
export function daysAgoLocal(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return toLocalDateString(d);
}

/**
 * Converts a YYYY-MM-DD picked date to an ISO timestamp anchored at local noon, so the
 * calendar day survives conversion to UTC for every timezone between UTC-11 and UTC+11.
 */
export function localDateToIso(dateStr: string | null | undefined, fallback: string = new Date().toISOString()): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return fallback;
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0).toISOString();
}

/** Local calendar day (YYYY-MM-DD) of a stored ISO timestamp; '' when missing/invalid. */
export function isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return toLocalDateString(d);
}

/** Inclusive YYYY-MM-DD range check for a stored ISO timestamp. */
export function isWithinLocalRange(iso: string | null | undefined, start?: string, end?: string): boolean {
  const day = isoToLocalDate(iso);
  if (!day) return false;
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
}

export function compareByDateThenPosting<T extends { date?: string; postingDate?: string }>(a: T, b: T): number {
  const da = new Date(a.date || 0).getTime();
  const dbb = new Date(b.date || 0).getTime();
  if (da !== dbb) return da - dbb;
  return new Date(a.postingDate || a.date || 0).getTime() - new Date(b.postingDate || b.date || 0).getTime();
}
