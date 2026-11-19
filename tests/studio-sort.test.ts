import test from "node:test";
import assert from "node:assert/strict";
import { nextArchiveOrder, parseStudioOrder, sortArchiveJourneys, sortStudioJourneys } from "../src/studioSort.ts";

const js = [
  { id: 1, start_date: "2026-05-01" },
  { id: 2, start_date: "2024-01-10" },
  { id: 3, start_date: "2025-08-02" },
  { id: 4, start_date: "" },
];

test("created order is id descending and does not mutate the input", () => {
  const copy = [...js];
  assert.deepEqual(sortStudioJourneys(js, "created").map((j) => j.id), [4, 3, 2, 1]);
  assert.deepEqual(js, copy);
});
test("travel order is newest trip first", () => {
  assert.deepEqual(sortStudioJourneys(js, "travel").map((j) => j.id), [1, 3, 2, 4]);
});
test("parseStudioOrder falls back to created", () => {
  assert.equal(parseStudioOrder("travel"), "travel");
  assert.equal(parseStudioOrder("x"), "created");
  assert.equal(parseStudioOrder(null), "created");
});

test("published stories always come before drafts, each group in its own order", () => {
  const mixed = [
    { id: 1, start_date: "2026-05-01", published: true },
    { id: 2, start_date: "2024-01-10", published: false },
    { id: 3, start_date: "2025-08-02", published: true },
    { id: 4, start_date: "2027-01-01", published: false },
  ];
  assert.deepEqual(sortStudioJourneys(mixed, "created").map((j) => j.id), [3, 1, 4, 2]);
  assert.deepEqual(sortStudioJourneys(mixed, "travel").map((j) => j.id), [1, 3, 4, 2]);
});
test("archive: created first by default cycle, then newest and oldest trip", () => {
  assert.deepEqual(sortArchiveJourneys(js, "created").map((j) => j.id), [4, 3, 2, 1]);
  assert.deepEqual(sortArchiveJourneys(js, "newest").map((j) => j.id), [1, 3, 2, 4]);
  assert.equal(nextArchiveOrder("created"), "newest");
  assert.equal(nextArchiveOrder("newest"), "oldest");
  assert.equal(nextArchiveOrder("oldest"), "created");
});
