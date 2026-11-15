// Journey dates derived from the photographs' capture dates (EXIF taken_at).
export interface DateRange {
  start: string;
  end: string;
}

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** First YYYY-MM-DD of a capture time, or null when absent/invalid. */
export function captureDay(value: string | null | undefined): string | null {
  const match = value ? ISO_DAY.exec(value) : null;
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  return date.getUTCFullYear() === Number(y) &&
    date.getUTCMonth() === Number(m) - 1 &&
    date.getUTCDate() === Number(d)
    ? `${y}-${m}-${d}`
    : null;
}

/** Earliest and latest capture day over all photographs; null when none carries a date. */
export function photoDateRange(
  photos: readonly { taken_at?: string | null }[],
): DateRange | null {
  let start: string | null = null;
  let end: string | null = null;
  for (const photo of photos) {
    const day = captureDay(photo.taken_at);
    if (!day) continue;
    if (start === null || day < start) start = day;
    if (end === null || day > end) end = day;
  }
  return start && end ? { start, end } : null;
}

export function sameRange(a: DateRange | null, b: DateRange | null): boolean {
  return a === b || (!!a && !!b && a.start === b.start && a.end === b.end);
}

/**
 * Should the journey dates follow the photographs after the photo set changed?
 * - flag true: the author left it on automatic;
 * - flag false: the author set dates by hand, never overwrite;
 * - flag unset (new or older journey): adopt only when no photograph had a date before.
 */
export function shouldAdoptDates(
  flag: boolean | undefined,
  before: DateRange | null,
  after: DateRange | null,
): boolean {
  if (!after || sameRange(before, after)) return false;
  if (flag === true) return true;
  if (flag === false) return false;
  return before === null;
}

/**
 * Label for a day range. The end always carries its year; the start carries
 * its year only when the range crosses a year boundary (27. Dez. 2024 — 01. Jan. 2025).
 * `label` formats one day, with or without its year.
 */
export function formatDayRange(
  start: string,
  end: string,
  label: (day: string, withYear: boolean) => string,
): string {
  if (start === end) return label(start, true);
  const crossesYear = start.slice(0, 4) !== end.slice(0, 4);
  return `${label(start, crossesYear)} — ${label(end, true)}`;
}
