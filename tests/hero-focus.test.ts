import assert from "node:assert/strict";
import test from "node:test";
import {
  clampPercent,
  coverOverflow,
  defaultFocus,
  deviceForWidth,
  dragToFocus,
  focusToPosition,
  normalizeFocus,
  nudgeFocus,
  sameFocus,
  sharedFocus,
  sharedPoint,
  tapToPoint,
} from "../src/heroFocus.ts";

test("clampPercent limits, rounds and falls back", () => {
  assert.equal(clampPercent(-5), 0);
  assert.equal(clampPercent(140), 100);
  assert.equal(clampPercent(33.349), 33.3);
  assert.equal(clampPercent(Number.NaN), 50);
  assert.equal(clampPercent("12"), 50);
  assert.equal(clampPercent(undefined, 20), 20);
});

test("normalizeFocus fills missing devices and rejects junk", () => {
  const focus = normalizeFocus({ desktop: { x: 10, y: 200 }, mobile: { x: "a" }, tablet: null });
  assert.deepEqual(focus.desktop, { x: 10, y: 100 });
  assert.deepEqual(focus.tablet, { x: 50, y: 50 });
  assert.deepEqual(focus.mobile, { x: 50, y: 50 });
  assert.deepEqual(normalizeFocus(null), defaultFocus());
  assert.ok(sameFocus(normalizeFocus(undefined), defaultFocus()));
});

test("deviceForWidth follows the hero breakpoints", () => {
  assert.equal(deviceForWidth(390), "mobile");
  assert.equal(deviceForWidth(760), "mobile");
  assert.equal(deviceForWidth(761), "tablet");
  assert.equal(deviceForWidth(1100), "tablet");
  assert.equal(deviceForWidth(1101), "desktop");
});

test("coverOverflow measures the cropped overflow", () => {
  // 3:2 image in a 1:1 frame: scaled to 300x200 style, overflow only horizontally.
  assert.deepEqual(coverOverflow({ width: 200, height: 200 }, { width: 3000, height: 2000 }), { x: 100, y: 0 });
  assert.deepEqual(coverOverflow({ width: 0, height: 10 }, { width: 3, height: 2 }), { x: 0, y: 0 });
});

test("dragToFocus moves with the pointer, clamps and ignores fixed axes", () => {
  const frame = { width: 200, height: 200 };
  const image = { width: 3000, height: 2000 };
  // Dragging 50px right reveals the left: x falls by 50/100 = 50 points.
  assert.deepEqual(dragToFocus({ x: 50, y: 50 }, { dx: 50, dy: 80 }, frame, image), { x: 0, y: 50 });
  assert.deepEqual(dragToFocus({ x: 50, y: 50 }, { dx: -25, dy: 0 }, frame, image), { x: 75, y: 50 });
  assert.deepEqual(dragToFocus({ x: 50, y: 50 }, { dx: -999, dy: 0 }, frame, image), { x: 100, y: 50 });
  // Image with the frame's own ratio has no overflow: nothing moves.
  assert.deepEqual(dragToFocus({ x: 30, y: 60 }, { dx: 40, dy: 40 }, frame, { width: 100, height: 100 }), { x: 30, y: 60 });
});

test("nudgeFocus steps with arrows, larger with shift, Home recentres", () => {
  assert.deepEqual(nudgeFocus({ x: 50, y: 50 }, "ArrowRight"), { x: 52, y: 50 });
  assert.deepEqual(nudgeFocus({ x: 50, y: 50 }, "ArrowUp", true), { x: 50, y: 40 });
  assert.deepEqual(nudgeFocus({ x: 1, y: 99 }, "ArrowLeft", true), { x: 0, y: 99 });
  assert.deepEqual(nudgeFocus({ x: 10, y: 90 }, "Home"), { x: 50, y: 50 });
  assert.deepEqual(nudgeFocus({ x: 10, y: 90 }, "a"), { x: 10, y: 90 });
});

test("focusToPosition formats a CSS object-position", () => {
  assert.equal(focusToPosition({ x: 33.3, y: 70 }), "33.3% 70%");
  assert.equal(focusToPosition({ x: -4, y: 400 }), "0% 100%");
});

test("sharedFocus sets the same clamped point for desktop, tablet and phone", () => {
  const focus = sharedFocus({ x: 30.26, y: 140 });
  assert.deepEqual(focus.desktop, { x: 30.3, y: 100 });
  assert.deepEqual(focus.tablet, focus.desktop);
  assert.deepEqual(focus.mobile, focus.desktop);
  assert.notEqual(focus.desktop, focus.tablet);
});

test("sharedPoint is only set when all three crops agree", () => {
  assert.equal(sharedPoint(null), null);
  assert.equal(sharedPoint(undefined), null);
  assert.deepEqual(sharedPoint(sharedFocus({ x: 20, y: 70 })), { x: 20, y: 70 });
  const tuned = { ...sharedFocus({ x: 20, y: 70 }), mobile: { x: 80, y: 10 } };
  assert.equal(sharedPoint(tuned), null);
  // a tap after fine-tuning overwrites all three again
  assert.deepEqual(sharedPoint(sharedFocus({ x: 55, y: 45 })), { x: 55, y: 45 });
});

test("tapToPoint maps a tap to percent of the picture and guards empty boxes", () => {
  const box = { left: 10, top: 20, width: 200, height: 100 };
  assert.deepEqual(tapToPoint(box, { x: 110, y: 70 }), { x: 50, y: 50 });
  assert.deepEqual(tapToPoint(box, { x: 10, y: 20 }), { x: 0, y: 0 });
  assert.deepEqual(tapToPoint(box, { x: 900, y: -40 }), { x: 100, y: 0 });
  assert.equal(tapToPoint({ ...box, width: 0 }, { x: 5, y: 5 }), null);
});

test("existing stored crops stay untouched by normalizing", () => {
  const stored = { desktop: { x: 12, y: 34 }, tablet: { x: 56, y: 78 }, mobile: { x: 90, y: 10 } };
  assert.deepEqual(normalizeFocus(stored), stored);
  assert.equal(sharedPoint(stored), null);
});
