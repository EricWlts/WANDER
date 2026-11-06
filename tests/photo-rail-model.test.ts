import test from "node:test";
import assert from "node:assert/strict";
import { railDirection, railEdgeCopies, railIndex, railPhoto, railWheel, type RailWheelBurst } from "../src/photoRailModel.ts";

const fresh = (): RailWheelBurst => ({ time: -Infinity, distance: 0, stepped: false });

test("cyclic slide identity wraps one neighbour in both directions", () => {
  assert.equal(railIndex(1, 0), 0);
  for (const count of [1, 2, 3, 24]) {
    assert.equal(railIndex(-1, count), count - 1);
    assert.equal(railIndex(count, count), 0);
    for (let i = -railEdgeCopies; i < count + railEdgeCopies; i++) {
      const real = railIndex(i, count);
      assert.equal(railIndex(real + count, count), real);
      assert.equal(railIndex(real - count, count), real);
    }
  }
});

test("a horizontal wheel burst crosses the threshold once, including inertia and reversal", () => {
  let state = fresh();
  const results = [5, 10, 18, 100, 50, -130, -20].map((x, i) => {
    const result = railWheel(state, i * 30, x, 3);
    state = result.burst;
    assert.equal(result.consume, true);
    return result.direction;
  });
  assert.deepEqual(results, [0, 0, 1, 0, 0, 0, 0]);
  assert.equal(railWheel(state, 410, -40, 0).direction, -1);
});

test("vertical, diagonal and tiny motion do not trigger navigation", () => {
  let result = railWheel(fresh(), 0, 17, 20);
  assert.equal(result.consume, false);
  result = railWheel(result.burst, 90, 90, 20);
  assert.equal(result.direction, 0);
  assert.equal(result.consume, false);
  result = railWheel(fresh(), 0, 12, 0);
  assert.equal(result.direction, 0);
  result = railWheel(result.burst, 40, 0, 90);
  assert.equal(result.consume, false);
  assert.equal(railDirection(29, 0, 36), 0);
  assert.equal(railDirection(72, 61, 36), 0);
  assert.equal(railDirection(-72, 40, 36), -1);
});

test("whole-image display bypasses crop edits without changing the original lightbox photo", () => {
  const photo = {
    id: 7,
    edits: {
      fit: "cover",
      ratio: "1:1",
      zoom: 3,
      x: 0,
      y: 100,
      hover_zoom: 20,
      show_title: true,
    },
  } as import("../src/types.ts").Photo;
  const before = structuredClone(photo);
  const shown = railPhoto(photo, true);
  assert.deepEqual(shown.edits, {
    fit: "contain",
    ratio: "original",
    zoom: 1,
    x: 50,
    y: 50,
    hover_zoom: 0,
    show_title: true,
  });
  assert.deepEqual(photo, before);
  assert.equal(railPhoto(photo, false), photo);
});
