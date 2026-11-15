import test from "node:test";
import assert from "node:assert/strict";
import { estimateRemainingSeconds, formatMegabytes, formatRemaining, smoothRate } from "../src/uploadProgress.ts";

test("megabytes use one decimal and the locale's separator", () => {
  assert.equal(formatMegabytes(12_400_000, "de"), "12,4");
  assert.equal(formatMegabytes(25_130_000, "en"), "25.1");
  assert.equal(formatMegabytes(0, "de"), "0,0");
  assert.equal(formatMegabytes(-5, "de"), "0,0");
});

test("remaining time is hidden at 5 seconds or less and rounded calmly", () => {
  assert.equal(formatRemaining(null, "de"), null);
  assert.equal(formatRemaining(5, "de"), null);
  assert.equal(formatRemaining(6, "de"), "noch ca. 10 Sek.");
  assert.equal(formatRemaining(42, "de"), "noch ca. 40 Sek.");
  assert.equal(formatRemaining(61, "de"), "noch ca. 1 Min.");
  assert.equal(formatRemaining(170, "en"), "about 3 min left");
});

test("throughput is smoothed over time, not per event", () => {
  assert.equal(smoothRate(null, 1000, 1), 1000);
  const rate = smoothRate(1000, 100, 0.05) as number;
  assert.ok(rate > 1000 && rate < 1100);
  assert.equal(smoothRate(1000, 10, 0), 1000);
});

test("estimate adds server time for unfinished images and needs a rate", () => {
  assert.equal(estimateRemainingSeconds({ bytesLeft: 10, rate: null, imagesLeft: 1, averageProcessing: 2 }), null);
  assert.equal(estimateRemainingSeconds({ bytesLeft: 1000, rate: 100, imagesLeft: 2, averageProcessing: null }), 10);
  assert.equal(estimateRemainingSeconds({ bytesLeft: 1000, rate: 100, imagesLeft: 2, averageProcessing: 3 }), 16);
  assert.equal(estimateRemainingSeconds({ bytesLeft: 0, rate: 100, imagesLeft: 1, averageProcessing: 3, currentProcessingElapsed: 10 }), 0);
});

import {
  SUMMARY_THRESHOLD,
  UPLOAD_CONCURRENCY,
  createFrameBatcher,
  formatSummary,
  isStaleSnapshot,
  runPool,
  shouldSummarize,
  summarizeUploads,
  uploadConcurrency,
} from "../src/uploadProgress.ts";

test("composition-guarded journeys upload one at a time, others three", () => {
  assert.equal(uploadConcurrency(true), 1);
  assert.equal(uploadConcurrency(false), UPLOAD_CONCURRENCY);
  assert.equal(UPLOAD_CONCURRENCY, 3);
});

test("the summary starts at 20 files", () => {
  assert.equal(shouldSummarize(SUMMARY_THRESHOLD - 1), false);
  assert.equal(shouldSummarize(20), true);
  assert.equal(shouldSummarize(120), true);
});

test("summary counts ignore removed files and split active from waiting", () => {
  const summary = summarizeUploads(["done", "done", "error", "uploading", "processing", "waiting", "removed"]);
  assert.deepEqual(summary, { total: 6, done: 2, failed: 1, active: 2, waiting: 1 });
  assert.deepEqual(summarizeUploads([]), { total: 0, done: 0, failed: 0, active: 0, waiting: 0 });
});

test("summary line reads '87 / 120 fertig · 2 Fehler' and drops the error part at zero", () => {
  assert.equal(formatSummary({ total: 120, done: 87, failed: 2 }, "de"), "87 / 120 fertig · 2 Fehler");
  assert.equal(formatSummary({ total: 120, done: 87, failed: 0 }, "de"), "87 / 120 fertig");
  assert.equal(formatSummary({ total: 25, done: 3, failed: 1 }, "en"), "3 / 25 done · 1 error");
  assert.equal(formatSummary({ total: 25, done: 3, failed: 2 }, "en"), "3 / 25 done · 2 errors");
});

test("frame batcher turns many requests into one flush per frame", () => {
  const frames = new Map<number, () => void>();
  let next = 1;
  let flushes = 0;
  const batcher = createFrameBatcher(
    () => (flushes += 1),
    (cb) => (frames.set(next, cb), next++),
    (handle) => frames.delete(handle),
  );
  for (let i = 0; i < 500; i++) batcher.request();
  assert.equal(frames.size, 1);
  assert.equal(flushes, 0);
  assert.equal(batcher.pending, true);
  frames.forEach((cb) => cb());
  frames.clear();
  assert.equal(flushes, 1);
  assert.equal(batcher.pending, false);
  batcher.request();
  assert.equal(frames.size, 1); // a new frame is scheduled after the flush
});

test("frame batcher: flushNow runs a pending flush once, cancel drops it", () => {
  const frames = new Map<number, () => void>();
  let next = 1;
  let flushes = 0;
  const batcher = createFrameBatcher(
    () => (flushes += 1),
    (cb) => (frames.set(next, cb), next++),
    (handle) => frames.delete(handle),
  );
  batcher.flushNow(); // nothing pending
  assert.equal(flushes, 0);
  batcher.request();
  batcher.flushNow();
  assert.equal(flushes, 1);
  assert.equal(frames.size, 0);
  batcher.request();
  batcher.cancel();
  assert.equal(frames.size, 0);
  assert.equal(flushes, 1);
});

test("pool never runs more than the limit at once and keeps the order of starts", async () => {
  let running = 0;
  let peak = 0;
  const started: number[] = [];
  await runPool([1, 2, 3, 4, 5, 6, 7, 8], 3, async (n) => {
    started.push(n);
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5 + (n % 3)));
    running -= 1;
  });
  assert.equal(peak, 3);
  assert.deepEqual(started, [1, 2, 3, 4, 5, 6, 7, 8]);
});

test("pool with limit 1 is strictly sequential and skips marked items", async () => {
  let running = 0;
  let peak = 0;
  const seen: number[] = [];
  await runPool(
    [1, 2, 3, 4],
    1,
    async (n) => {
      running += 1;
      peak = Math.max(peak, running);
      seen.push(n);
      await new Promise((resolve) => setTimeout(resolve, 2));
      running -= 1;
    },
    (n) => n === 3,
  );
  assert.equal(peak, 1);
  assert.deepEqual(seen, [1, 2, 4]);
});

test("pool stops starting new items after a failure, lets running ones finish, rethrows the first error", async () => {
  const started: number[] = [];
  const finished: number[] = [];
  await assert.rejects(
    runPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
      started.push(n);
      await new Promise((resolve) => setTimeout(resolve, 5));
      if (n === 1) throw new Error("conflict");
      finished.push(n);
    }),
    /conflict/,
  );
  assert.ok(started.length < 6);
  assert.ok(finished.includes(2));
});

test("pool handles an empty list and a limit larger than the list", async () => {
  await runPool([], 3, async () => assert.fail("no item expected"));
  const seen: string[] = [];
  await runPool(["a", "b"], 10, async (x) => void seen.push(x));
  assert.deepEqual(seen, ["a", "b"]);
});

test("older snapshots that arrive late are recognised as stale", () => {
  assert.equal(isStaleSnapshot(5, 7), true);
  assert.equal(isStaleSnapshot(7, 7), false);
  assert.equal(isStaleSnapshot(8, 7), false);
  assert.equal(isStaleSnapshot(undefined, 7), false);
});
