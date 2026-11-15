import test from "node:test";
import assert from "node:assert/strict";
import { stripIndex, stripLabel, stripStep } from "../src/homeStripModel.ts";

test("the view closest to the scroll position is current", () => {
  const offsets = [0, 500, 1000, 1500, 2000];
  assert.equal(stripIndex(offsets, 0, 1800), 0);
  assert.equal(stripIndex(offsets, 240, 1800), 0);
  assert.equal(stripIndex(offsets, 260, 1800), 1);
  assert.equal(stripIndex(offsets, 1010, 1800), 2);
});

test("at the end of the strip the last view is current, even if it never reaches the left edge", () => {
  assert.equal(stripIndex([0, 500, 1000, 1500, 2000], 1800, 1800), 4);
  assert.equal(stripIndex([0, 500, 1000, 1500, 2000], 1799, 1800), 4);
});

test("an empty strip has index 0", () => {
  assert.equal(stripIndex([], 120, 0), 0);
});

test("steps stay inside the strip and never wrap", () => {
  assert.equal(stripStep(0, -1, 5), 0);
  assert.equal(stripStep(0, 1, 5), 1);
  assert.equal(stripStep(4, 1, 5), 4);
  assert.equal(stripStep(2, -1, 5), 1);
  assert.equal(stripStep(3, 0, 0), 0);
});

test("the counter is one-based", () => {
  assert.equal(stripLabel(1, 5), "2 / 5");
  assert.equal(stripLabel(9, 5), "5 / 5");
  assert.equal(stripLabel(0, 0), "0 / 0");
});
