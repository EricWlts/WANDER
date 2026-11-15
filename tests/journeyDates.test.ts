import assert from "node:assert/strict";
import test from "node:test";
import { captureDay, formatDayRange, photoDateRange, shouldAdoptDates } from "../src/journeyDates.ts";

test("captureDay reads the day and rejects invalid values", () => {
  assert.equal(captureDay("2026-05-03T14:22:10"), "2026-05-03");
  assert.equal(captureDay("2026-02-30T10:00:00"), null);
  assert.equal(captureDay(""), null);
  assert.equal(captureDay(null), null);
  assert.equal(captureDay("garbage"), null);
});

test("photoDateRange spans earliest to latest capture day", () => {
  assert.equal(photoDateRange([{}, { taken_at: null }]), null);
  assert.deepEqual(
    photoDateRange([
      { taken_at: "2026-05-03T10:00:00" },
      { taken_at: "2026-04-28T23:59:00" },
      { taken_at: null },
      { taken_at: "2026-05-09T01:00:00" },
    ]),
    { start: "2026-04-28", end: "2026-05-09" },
  );
});

test("shouldAdoptDates respects manual dates and the automatic flag", () => {
  const a = { start: "2026-05-01", end: "2026-05-02" };
  const b = { start: "2026-05-01", end: "2026-05-09" };
  assert.equal(shouldAdoptDates(true, a, b), true);
  assert.equal(shouldAdoptDates(true, a, a), false);
  assert.equal(shouldAdoptDates(true, a, null), false);
  assert.equal(shouldAdoptDates(false, null, b), false);
  assert.equal(shouldAdoptDates(undefined, null, b), true);
  assert.equal(shouldAdoptDates(undefined, a, b), false);
});

test("formatDayRange shows the start year only when the range crosses a year", () => {
  const label = (day: string, withYear: boolean) => (withYear ? `${day}[Y]` : day);
  assert.equal(
    formatDayRange("2024-12-27", "2025-01-01", label),
    "2024-12-27[Y] — 2025-01-01[Y]",
  );
  assert.equal(
    formatDayRange("2026-05-01", "2026-05-09", label),
    "2026-05-01 — 2026-05-09[Y]",
  );
  assert.equal(formatDayRange("2026-05-01", "2026-05-01", label), "2026-05-01[Y]");
});
