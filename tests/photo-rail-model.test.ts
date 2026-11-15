import test from "node:test";
import assert from "node:assert/strict";
import { railDirection, railEdgeCopies, railIndex, railPhoto } from "../src/photoRailModel.ts";

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

import { railFollows, railRestRect } from "../src/photoRailModel.ts";

test("the rest rectangle centres the frame in the viewport and keeps its top", () => {
  assert.deepEqual(
    railRestRect({ left: 100, width: 1000 }, { top: 40, width: 600, height: 300 }),
    { left: 300, top: 40, width: 600, height: 300 },
  );
});

test("the rail only follows the viewer when both list the same photographs", () => {
  assert.equal(railFollows(5, 5, 2, 7), true);
  assert.equal(railFollows(5, 5, 2, 3), false);
  assert.equal(railFollows(4, 5, 0, 0), false);
  assert.equal(railFollows(0, 0, 0, 0), false);
});

import {
  railDragOffset,
  railDuration,
  railKeyAction,
  railMouseDuration,
  railRelease,
  railStepDistance,
  railTouchDuration,
  railVelocity,
} from "../src/photoRailModel.ts";

test("glide time: touch settles in 450-600 ms by speed, mouse and keys keep 700 ms", () => {
  assert.equal(railDuration("touch", 0), railTouchDuration.max);
  assert.equal(railDuration("touch", 0.5), 525);
  assert.equal(railDuration("touch", -0.5), 525);
  assert.equal(railDuration("touch", 5), railTouchDuration.min);
  for (let speed = -6; speed <= 6; speed += 0.25) {
    const ms = railDuration("touch", speed);
    assert.ok(ms >= 450 && ms <= 600, `${speed} -> ${ms}`);
  }
  assert.equal(railDuration("mouse", 3), railMouseDuration);
  assert.equal(railDuration("key"), 700);
});

test("velocity comes from the last 100 ms and is zero for a resting finger", () => {
  const samples = [
    { time: 0, shift: 0 },
    { time: 60, shift: 10 },
    { time: 120, shift: 40 },
    { time: 150, shift: 70 },
  ];
  // Window 50..150 keeps the last three samples: 60 px over 90 ms.
  assert.ok(Math.abs(railVelocity(samples, 150) - 60 / 90) < 1e-9);
  assert.equal(railVelocity(samples, 400), 0);
  assert.equal(railVelocity(samples.slice(0, 1), 10), 0);
  assert.equal(railVelocity([], 10), 0);
  assert.equal(railVelocity([{ time: 5, shift: 3 }, { time: 5, shift: 9 }], 5), 0);
  assert.ok(railVelocity([{ time: 0, shift: 50 }, { time: 50, shift: 0 }], 50) < 0);
});

test("the track follows the finger 1:1 after the dead zone and resists beyond one slot", () => {
  assert.equal(railDragOffset(0, 300), -0);
  // Moving the finger left (shift > 0) pulls the track left (negative offset).
  assert.equal(railDragOffset(100, 300), -100);
  assert.equal(railDragOffset(-100, 300), 100);
  assert.equal(railDragOffset(110, 300, 10), -100);
  assert.equal(railDragOffset(8, 300, 10), -0);
  const beyond = railDragOffset(600, 300);
  assert.ok(beyond < -300 && beyond > -600);
  assert.ok(Math.abs(railDragOffset(2000, 300)) < 300 + 1700 * 0.3 + 1e-9);
  // Monotonic: more travel never moves the track back.
  let previous = 0;
  for (let shift = 0; shift <= 900; shift += 30) {
    const offset = Math.abs(railDragOffset(shift, 300, 10));
    assert.ok(offset >= previous);
    previous = offset;
  }
});

test("release steps on a flick or a long enough drag, otherwise snaps back", () => {
  const slot = 360;
  const distance = railStepDistance(slot);
  assert.ok(distance >= 28 && distance <= 56);
  // Slow drags decide by distance.
  assert.equal(railRelease(distance, 0, slot), 1);
  assert.equal(railRelease(-distance, 0, slot), -1);
  assert.equal(railRelease(distance - 1, 0, slot), 0);
  assert.equal(railRelease(0, 0, slot), 0);
  // A short fast flick steps; a tiny twitch does not.
  assert.equal(railRelease(20, 0.6, slot), 1);
  assert.equal(railRelease(-20, -0.6, slot), -1);
  assert.equal(railRelease(5, 2, slot), 0);
  // Fast flick against the drag direction follows the flick.
  assert.equal(railRelease(40, -0.8, slot), -1);
  // Never more than one photograph, however hard it is thrown.
  assert.equal(railRelease(900, 9, slot), 1);
  assert.equal(railRelease(-900, -9, slot), -1);
});

test("keys move the carousel unless a field, a modifier or a single photograph is involved", () => {
  assert.deepEqual(railKeyAction("ArrowRight", 4), { step: 1 });
  assert.deepEqual(railKeyAction("ArrowLeft", 4), { step: -1 });
  assert.deepEqual(railKeyAction("Home", 4), { index: 0 });
  assert.deepEqual(railKeyAction("End", 4), { index: 3 });
  assert.equal(railKeyAction("ArrowRight", 1), null);
  assert.equal(railKeyAction("ArrowRight", 0), null);
  assert.equal(railKeyAction("ArrowRight", 4, { editable: true }), null);
  assert.equal(railKeyAction("ArrowLeft", 4, { modified: true }), null);
  assert.equal(railKeyAction("a", 4), null);
  assert.equal(railKeyAction("ArrowUp", 4), null);
});
