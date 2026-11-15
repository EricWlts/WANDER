import test from "node:test";
import assert from "node:assert/strict";
import { issueKicker, issueNumbers, seasonOf, sortByTravelDate, toRoman, travelDate } from "../src/issueLabel.ts";

test("roman numerals", () => {
  assert.deepEqual([1, 2, 4, 9, 14, 40, 2026].map(toRoman), ["I", "II", "IV", "IX", "XIV", "XL", "MMXXVI"]);
  assert.equal(toRoman(0), "");
});
test("meteorological seasons", () => {
  assert.equal(seasonOf("2026-12-01"), "winter");
  assert.equal(seasonOf("2026-02-28"), "winter");
  assert.equal(seasonOf("2026-03-01"), "spring");
  assert.equal(seasonOf("2026-08-31"), "summer");
  assert.equal(seasonOf("2026-11-09"), "autumn");
  assert.equal(seasonOf(""), null);
});
test("kicker", () => {
  assert.equal(issueKicker(2, "2026-10-03", "de"), "Ausgabe II · Herbst 2026");
  assert.equal(issueKicker(2, "2026-10-03", "en"), "Issue II · Autumn 2026");
  assert.equal(issueKicker(3, "", "en"), "Issue III");
});
test("issue numbers are stable regardless of order", () => {
  const a = [{ id: 5, start_date: "2026-01-01" }, { id: 2, start_date: "2025-05-01" }, { id: 9, start_date: "2026-09-01" }];
  const n = issueNumbers(a);
  assert.equal(n.get(2), 1); assert.equal(n.get(5), 2); assert.equal(n.get(9), 3);
  assert.equal(issueNumbers([...a].reverse()).get(5), 2);
});

import { archiveStats } from "../src/issueLabel.ts";
test("archive stats", () => {
  const s = archiveStats([{ country: "Spanien", start_date: "2026-03-01" }, { country: "spanien ", start_date: "2024-07-01" }, { country: "", start_date: "" }]);
  assert.deepEqual(s, { count: 3, countries: 1, since: 2024 });
  assert.deepEqual(archiveStats([]), { count: 0, countries: 0, since: null });
});

test("travel date falls back to photos, then creation day", () => {
  assert.equal(travelDate({ start_date: "2026-03-02" }), "2026-03-02");
  assert.equal(travelDate({ start_date: "", highlights: [{ taken_at: "2025-01-02T10:00:00" }, { taken_at: "2024-12-27T09:00:00" }, {}] }), "2024-12-27");
  assert.equal(travelDate({ start_date: "", created_at: "2026-11-08T12:00:00" }), "2026-11-08");
  assert.equal(travelDate({}), "");
});
test("sorting and issue numbers share one chronology", () => {
  const a = [{ id: 3, start_date: "2026-11-08" }, { id: 1, start_date: "2026-10-19" }, { id: 2, start_date: "2026-11-08" }];
  assert.deepEqual(sortByTravelDate(a, "newest").map((j) => j.id), [3, 2, 1]);
  assert.deepEqual(sortByTravelDate(a, "oldest").map((j) => j.id), [1, 2, 3]);
  const n = issueNumbers(a);
  assert.deepEqual([1, 2, 3].map((id) => n.get(id)), [1, 2, 3]);
});
