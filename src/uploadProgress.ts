/** Pure helpers for the upload progress display (no React, no DOM). */
export type UploadLocale = "de" | "en";

const MEGABYTE = 1_000_000;

export function formatMegabytes(bytes: number, locale: UploadLocale) {
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Math.max(0, bytes) / MEGABYTE);
}

/** Time-weighted moving average of throughput (bytes/s), about 5 s memory. */
export function smoothRate(previous: number | null, bytes: number, seconds: number) {
  if (!(seconds > 0) || bytes < 0) return previous;
  const instant = bytes / seconds;
  if (previous === null || previous <= 0) return instant;
  const weight = 1 - Math.exp(-seconds / 5);
  return previous + (instant - previous) * weight;
}

/** Upload time for the bytes still to send plus server time for unfinished images. */
export function estimateRemainingSeconds(input: {
  bytesLeft: number;
  rate: number | null;
  imagesLeft: number;
  averageProcessing: number | null;
  currentProcessingElapsed?: number;
}) {
  if (!input.rate || input.rate <= 0) return null;
  let seconds = Math.max(0, input.bytesLeft) / input.rate;
  if (input.averageProcessing !== null) {
    seconds += Math.max(0, input.imagesLeft) * input.averageProcessing;
    seconds -= Math.min(input.currentProcessingElapsed ?? 0, input.averageProcessing);
  }
  return Math.max(0, seconds);
}

/** "noch ca. 1 Min." — null when there is nothing worth showing (5 s or less). */
export function formatRemaining(seconds: number | null, locale: UploadLocale) {
  if (seconds === null || !(seconds > 5)) return null;
  const de = locale === "de";
  if (seconds < 60) {
    const rounded = Math.max(10, Math.round(seconds / 5) * 5);
    return de ? `noch ca. ${rounded} Sek.` : `about ${rounded} sec left`;
  }
  const minutes = Math.max(1, Math.round(seconds / 60));
  return de ? `noch ca. ${minutes} Min.` : `about ${minutes} min left`;
}

/** Uploads running at once. Journeys with a composition version stay sequential (the backend bumps it per photo). */
export const UPLOAD_CONCURRENCY = 3;
/** From this many files on, the result list collapses into one summary line. */
export const SUMMARY_THRESHOLD = 20;

export function uploadConcurrency(guardedByComposition: boolean) {
  return guardedByComposition ? 1 : UPLOAD_CONCURRENCY;
}

export function shouldSummarize(fileCount: number) {
  return fileCount >= SUMMARY_THRESHOLD;
}

export type UploadStatus = "waiting" | "uploading" | "processing" | "done" | "error" | "removed";

export type UploadSummary = {
  /** Files still in the list (removed ones do not count). */
  total: number;
  done: number;
  failed: number;
  active: number;
  waiting: number;
};

export function summarizeUploads(statuses: readonly UploadStatus[]): UploadSummary {
  const summary: UploadSummary = { total: 0, done: 0, failed: 0, active: 0, waiting: 0 };
  for (const status of statuses) {
    if (status === "removed") continue;
    summary.total += 1;
    if (status === "done") summary.done += 1;
    else if (status === "error") summary.failed += 1;
    else if (status === "waiting") summary.waiting += 1;
    else summary.active += 1;
  }
  return summary;
}

/** "87 / 120 fertig · 2 Fehler" (the error part only when there are errors). */
export function formatSummary(summary: Pick<UploadSummary, "total" | "done" | "failed">, locale: UploadLocale) {
  const de = locale === "de";
  const base = de
    ? `${summary.done} / ${summary.total} fertig`
    : `${summary.done} / ${summary.total} done`;
  if (summary.failed <= 0) return base;
  const errors = de
    ? `${summary.failed} Fehler`
    : `${summary.failed} ${summary.failed === 1 ? "error" : "errors"}`;
  return `${base} · ${errors}`;
}

/**
 * Collapses many change notifications into one flush per animation frame.
 * `request()` schedules a flush, `flushNow()` runs a pending one immediately
 * (e.g. when a batch ends), `cancel()` drops it (unmount).
 */
export function createFrameBatcher(
  flush: () => void,
  schedule: (callback: () => void) => number,
  unschedule: (handle: number) => void,
) {
  let handle: number | null = null;
  const run = () => {
    handle = null;
    flush();
  };
  return {
    request() {
      if (handle === null) handle = schedule(run);
    },
    flushNow() {
      if (handle === null) return;
      unschedule(handle);
      run();
    },
    cancel() {
      if (handle === null) return;
      unschedule(handle);
      handle = null;
    },
    get pending() {
      return handle !== null;
    },
  };
}

/**
 * Runs `worker` over `items` in order with at most `limit` in flight. The next item is
 * taken only when a slot frees up. `skip(item)` is checked right before an item starts.
 * If a worker throws, no new item starts; in-flight ones finish, then the first error is rethrown.
 */
export async function runPool<T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
  skip: (item: T) => boolean = () => false,
) {
  let index = 0;
  let failed = false;
  let firstError: unknown;
  const lane = async () => {
    while (!failed) {
      const item = items[index++];
      if (index > items.length) return;
      if (skip(item)) continue;
      try {
        await worker(item);
      } catch (error) {
        if (!failed) firstError = error;
        failed = true;
      }
    }
  };
  const lanes = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  await Promise.all(Array.from({ length: lanes }, lane));
  if (failed) throw firstError;
}

/** Newest-wins guard for snapshots that can arrive out of order. */
export function isStaleSnapshot(version: number | undefined, newestSeen: number) {
  return version !== undefined && version < newestSeen;
}

/** One frame of the light table (step 1 of "Neue Geschichte"). */
export interface SheetItem {
  status: UploadStatus;
  /** File size in bytes. */
  size: number;
  /** Bytes transferred so far. */
  loaded?: number;
}

export interface SheetProgress {
  /** Photographs finished (including ones already in the story before this batch). */
  done: number;
  /** Photographs in the sheet, without removed and failed ones. */
  total: number;
  failed: number;
  doneBytes: number;
  totalBytes: number;
  /** An upload is still running or waiting. */
  active: boolean;
}

/** Counts for the line above the contact sheet. `alreadyDone` are photographs without a file here (e.g. resumed). */
export function sheetProgress(items: readonly SheetItem[], alreadyDone = 0): SheetProgress {
  const out: SheetProgress = { done: Math.max(0, alreadyDone), total: Math.max(0, alreadyDone), failed: 0, doneBytes: 0, totalBytes: 0, active: false };
  for (const item of items) {
    if (item.status === "removed") continue;
    if (item.status === "error") {
      out.failed += 1;
      continue;
    }
    const size = Math.max(0, item.size);
    out.total += 1;
    out.totalBytes += size;
    if (item.status === "done") {
      out.done += 1;
      out.doneBytes += size;
    } else {
      out.active = true;
      out.doneBytes += item.status === "processing" ? size : Math.min(size, Math.max(0, item.loaded ?? 0));
    }
  }
  return out;
}

/** Whole megabytes from 10 MB on, one decimal below ("48", "3,4"). Scale follows the total so both numbers match. */
export function formatSheetMegabytes(bytes: number, scaleBytes: number, locale: UploadLocale) {
  const digits = scaleBytes >= 10 * MEGABYTE ? 0 : 1;
  return new Intl.NumberFormat(locale === "de" ? "de-DE" : "en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.max(0, bytes) / MEGABYTE);
}

/**
 * "12 von 30 Fotos · 48 von 126 MB" while uploading, "30 Fotos · 126 MB" when finished.
 * Bytes are left out when no file size is known (resumed story); errors are appended.
 */
export function formatSheetLine(p: SheetProgress, locale: UploadLocale) {
  const de = locale === "de";
  const noun = (n: number) => (de ? (n === 1 ? "Foto" : "Fotos") : n === 1 ? "photograph" : "photographs");
  const mb = (bytes: number) => formatSheetMegabytes(bytes, p.totalBytes, locale);
  const parts: string[] = [];
  if (p.active) {
    parts.push(de ? `${p.done} von ${p.total} ${noun(p.total)}` : `${p.done} of ${p.total} ${noun(p.total)}`);
    if (p.totalBytes > 0) parts.push(de ? `${mb(p.doneBytes)} von ${mb(p.totalBytes)} MB` : `${mb(p.doneBytes)} of ${mb(p.totalBytes)} MB`);
  } else {
    parts.push(`${p.total} ${noun(p.total)}`);
    if (p.totalBytes > 0) parts.push(`${mb(p.totalBytes)} MB`);
  }
  if (p.failed > 0) parts.push(de ? `${p.failed} Fehler` : `${p.failed} ${p.failed === 1 ? "error" : "errors"}`);
  return parts.join(" · ");
}
