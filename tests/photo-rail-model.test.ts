import test from "node:test";
import assert from "node:assert/strict";
import {
  railOptions,
  railDestination,
  railIndex,
  railPhoto,
  railTailSpace,
  railBoundaryDirection,
} from "../src/photoRailModel.ts";

test("old manual rails keep free finite behavior; all new combinations are independent", () => {
  assert.deepEqual(railOptions(), { single: false, loop: false });
  for (const rail_mode of ["free", "single"] as const) {
    for (const rail_loop of [false, true]) {
      const saved = JSON.parse(
        JSON.stringify({ rail_mode, rail_loop, speed: 52 }),
      );
      assert.deepEqual(railOptions(saved), {
        single: rail_mode === "single",
        loop: rail_loop,
      });
      assert.equal(saved.speed, 52);
    }
  }
});

test("empty and single sequences stay at zero in either direction", () => {
  for (const count of [0, 1])
    for (const loop of [false, true]) {
      assert.equal(railDestination(0, -1, count, loop), 0);
      assert.equal(railDestination(0, 1, count, loop), 0);
    }
  assert.equal(railIndex(0, []), 0);
  assert.equal(railIndex(100, [0]), 0);
});

test("two and many frames wrap exactly once in both directions without synthetic positions", () => {
  for (const count of [2, 8]) {
    let index = 0;
    const visited = [];
    for (let i = 0; i < count; i++) {
      visited.push(index);
      index = railDestination(index, 1, count, true);
    }
    assert.equal(new Set(visited).size, count);
    assert.equal(index, 0);
    assert.equal(railDestination(0, -1, count, true), count - 1);
    assert.equal(railDestination(count - 1, 1, count, false), count - 1);
    assert.equal(railDestination(0, -1, count, false), 0);
    for (let i = 0; i < count; i++) {
      const next = railDestination(i, 1, count, true);
      assert.equal(railDestination(next, -1, count, true), i);
    }
  }
});

test("position follows actual variable-width frames", () => {
  const starts = [0, 170, 540, 800];
  assert.equal(railIndex(0, starts), 0);
  assert.equal(railIndex(150, starts), 1);
  assert.equal(railIndex(530, starts), 2);
  assert.equal(railIndex(599, starts), 2);
  assert.equal(railIndex(0, starts), 0);
  assert.equal(railIndex(899, [0, 900, 1800]), 1);
  assert.equal(railIndex(1800, [0, 900, 1800]), 2);
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

test("free loop tail space makes every narrow frame reachable without skipped positions", () => {
  const starts = [0, 330, 660, 990, 1320];
  const viewport = 1050,
    lastWidth = 330;
  const originalMax = 600;
  const maximum = originalMax + railTailSpace(viewport, lastWidth);
  assert.equal(maximum, starts.at(-1));
  for (let i = 0; i < starts.length; i++)
    assert.equal(railIndex(Math.min(starts[i], maximum), starts), i);
  assert.equal(railTailSpace(350, 312), 38);
  assert.equal(railTailSpace(350, 500), 0);
});

test("only deliberate outward horizontal boundary gestures cancel native inertia and wrap", () => {
  assert.equal(railBoundaryDirection(-105, 0, true, false), -1);
  assert.equal(railBoundaryDirection(105, 0, false, true), 1);
  assert.equal(railBoundaryDirection(105, 0, true, false), 0);
  assert.equal(railBoundaryDirection(-105, 0, false, true), 0);
  assert.equal(railBoundaryDirection(-105, 120, true, false), 0);
  assert.equal(railBoundaryDirection(-20, 0, true, false), 0);
  assert.equal(railBoundaryDirection(-20, 0, true, false, 6), -1);
});
