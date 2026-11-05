import test from "node:test";
import assert from "node:assert/strict";
import {
  railIndicators,
  railVisibleIndex,
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


test("indicator geometry covers all requested counts and shrinks continuously on resize", () => {
  for (const count of [0, 1, 2, 3, 4, 8, 12]) {
    for (const available of [288, 320, 390, 768, 1280, 1440]) {
      const { width, compact } = railIndicators(count, available);
      assert.ok(width <= available && width <= 320);
      assert.equal(compact, false);
      if (count > 1) {
        const bar = width / count - 8;
        assert.ok(bar >= 16 && bar <= 48);
        assert.ok(bar + 8 >= 24); // pointer target, not merely a 2px line
        assert.ok(Math.abs(count * (bar + 8) - width) < 1e-9);
      }
    }
  }
  assert.equal(railIndicators(12, 288).width, 288);
  assert.equal(railIndicators(12, 287).compact, true);
  assert.equal(railIndicators(1000, 1440).compact, true);
  assert.equal(railIndicators(2, 0).compact, true);
});

test("free active image uses real visible fractions, gaps, and deterministic ties", () => {
  const frames = [{ start: 0, width: 200 }, { start: 220, width: 400 }, { start: 640, width: 100 }];
  assert.equal(railVisibleIndex(0, 300, frames), 0);
  assert.equal(railVisibleIndex(180, 300, frames), 1);
  assert.equal(railVisibleIndex(600, 200, frames), 2);
  assert.equal(railVisibleIndex(0, 100, [{ start: 0, width: 200 }, { start: 50, width: 100 }]), 0);
  assert.equal(railVisibleIndex(100, 200, [{ start: 0, width: 200 }, { start: 200, width: 200 }]), 0);
  assert.equal(railVisibleIndex(0, 300, []), 0);
  assert.equal(railVisibleIndex(99, 300, [{ start: 0, width: 0 }]), 0);
  assert.equal(railVisibleIndex(0, 1000, frames), 0);
  // A changed sequence/viewport is evaluated from geometry, without a stale index.
  assert.equal(railVisibleIndex(180, 30, frames), 0);
  assert.equal(railVisibleIndex(180, 300, frames.slice(1)), 0);
});

test("compact fallback navigation can reach every logical original without skips", () => {
  const count = 1000;
  assert.equal(railIndicators(count, 320).compact, true);
  let index = 0;
  const visited = new Set<number>();
  for (let i = 0; i < count; i++) {
    visited.add(index);
    index = railDestination(index, 1, count, true);
  }
  assert.equal(visited.size, count);
  assert.equal(index, 0);
  assert.equal(railDestination(0, -1, count, true), count - 1);
});
