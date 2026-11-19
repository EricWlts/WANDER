import test from "node:test";
import assert from "node:assert/strict";
import { sameFormat, edgeToEdgeAvailable, edgeToEdgeActive, edgeColumns } from "../src/edgeMedia.ts";
import type { Photo } from "../src/types.ts";

const photo = (width: number, height: number, ratio?: string): Photo =>
  ({ id: 1, width, height, edits: ratio ? { ratio } : undefined }) as unknown as Photo;

test("sameFormat tolerates 2 percent and needs two photographs", () => {
  assert.equal(sameFormat([1.5, 1.52]), true);
  assert.equal(sameFormat([1.5, 1.6]), false);
  assert.equal(sameFormat([1.5]), false);
  assert.equal(sameFormat([1.5, 0]), false);
  assert.equal(sameFormat([0.8, 0.8, 0.8, 0.8]), true);
});

test("availability follows kind, photograph size and crop", () => {
  const two = [photo(3000, 2000), photo(1500, 1000)];
  assert.equal(edgeToEdgeAvailable("pair", two), true);
  assert.equal(edgeToEdgeAvailable("rail", two), false);
  assert.equal(edgeToEdgeAvailable("wall", [photo(3000, 2000), photo(2000, 3000)]), false);
  // Module crop makes different formats equal.
  assert.equal(edgeToEdgeAvailable("gallery", [photo(3000, 2000), photo(2000, 3000)], { ratio: "1:1" }), true);
  // Per-photograph crop.
  assert.equal(edgeToEdgeAvailable("wall", [photo(3000, 2000, "4:5"), photo(2000, 3000, "4:5")]), true);
});

test("active needs the setting and still matching formats", () => {
  const two = [photo(3000, 2000), photo(3000, 2000)];
  assert.equal(edgeToEdgeActive("pair", two, { edge_to_edge: true }), true);
  assert.equal(edgeToEdgeActive("pair", two, {}), false);
  assert.equal(edgeToEdgeActive("pair", [photo(3000, 2000), photo(2000, 3000)], { edge_to_edge: true }), false);
});

test("columns: one row up to four, portraits stay in a row on phones", () => {
  assert.deepEqual(edgeColumns(2, 1.5), { desktop: 2, mobile: 1 });
  assert.deepEqual(edgeColumns(3, 0.8), { desktop: 3, mobile: 3 });
  assert.deepEqual(edgeColumns(4, 0.8), { desktop: 4, mobile: 2 });
  assert.deepEqual(edgeColumns(6, 1.5), { desktop: 3, mobile: 1 });
});
