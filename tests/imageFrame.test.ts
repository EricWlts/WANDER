import assert from "node:assert/strict";
import test from "node:test";
import {
  FRAME_FORMATS,
  TITLE_GRID,
  canMoveCrop,
  dragTitlePosition,
  gridIndex,
  nudgeTitle,
  pairOffsets,
  defaultSideMargin,
  snapTitle,
  readTitlePosition,
  titleAlign,
  dragFrameFocus,
  fitFrameWidth,
  focusPatch,
  formatFromRatio,
  frameRatio,
  keyFrameFocus,
  maxFrameHeight,
  ratioForFormat,
  readFocus,
} from "../src/imageFrame.ts";

test("offers at most five formats, original first", () => {
  assert.equal(FRAME_FORMATS.length, 5);
  assert.equal(FRAME_FORMATS[0].id, "original");
});

test("format <-> layout ratio is backward compatible", () => {
  assert.equal(formatFromRatio(undefined), "original");
  assert.equal(formatFromRatio("original"), "original");
  assert.equal(formatFromRatio("16:9"), "16:9");
  assert.equal(formatFromRatio("4:3"), null);
  assert.equal(formatFromRatio("free"), null);
  assert.equal(ratioForFormat("original"), undefined);
  assert.equal(ratioForFormat("4:5"), "4:5");
});

test("frameRatio uses the photo for original", () => {
  assert.equal(frameRatio("original", { width: 3000, height: 2000 }), 1.5);
  assert.equal(frameRatio("1:1", { width: 3000, height: 2000 }), 1);
  assert.equal(frameRatio("original", { width: 0, height: 0 }), 1.5);
});

test("frame never exceeds the screen below the header", () => {
  assert.equal(maxFrameHeight(800), 800 - 64 - 32);
  assert.equal(maxFrameHeight(50), 0);
  // landscape on a wide container: height-limited
  assert.equal(fitFrameWidth(16 / 9, 2000, 800), (800 - 96) * (16 / 9));
  // portrait: width is reduced
  assert.ok(fitFrameWidth(0.8, 1200, 800) < 1200);
  assert.equal(fitFrameWidth(0.8, 1200, 800), (800 - 96) * 0.8);
  // narrow container wins
  assert.equal(fitFrameWidth(1.5, 300, 900), 300);
});

test("crop only moves when the ratio differs from the photo", () => {
  assert.equal(canMoveCrop(1.5, { width: 3000, height: 2000 }), false);
  assert.equal(canMoveCrop(1, { width: 3000, height: 2000 }), true);
  assert.equal(canMoveCrop(1, { width: 0, height: 0 }), false);
});

test("dragging moves the focus opposite to the pointer and clamps", () => {
  const frame = { width: 400, height: 400 };
  const photo = { width: 3000, height: 2000 }; // overflows horizontally only
  const moved = dragFrameFocus({ x: 50, y: 50 }, { dx: -100, dy: 80 }, frame, photo);
  assert.ok(moved.x > 50);
  assert.equal(moved.y, 50);
  const clamped = dragFrameFocus({ x: 50, y: 50 }, { dx: 5000, dy: 0 }, frame, photo);
  assert.equal(clamped.x, 0);
});

test("keyboard nudges by 2 %, Home resets, values stay in 0..100", () => {
  assert.deepEqual(keyFrameFocus({ x: 50, y: 50 }, "ArrowRight"), { x: 52, y: 50 });
  assert.deepEqual(keyFrameFocus({ x: 1, y: 50 }, "ArrowLeft"), { x: 0, y: 50 });
  assert.deepEqual(keyFrameFocus({ x: 20, y: 70 }, "Home"), { x: 50, y: 50 });
});

test("readFocus defaults missing values to the centre", () => {
  assert.deepEqual(readFocus(undefined), { x: 50, y: 50 });
  assert.deepEqual(readFocus({ x: 30 }), { x: 30, y: 50 });
});

test("focusPatch writes to the first placement or photo_edits", () => {
  const withPlacement = focusPatch(
    { placements: [{ id: "a", photo_id: 7, edits: { zoom: 1.2 } }] },
    7,
    { x: 20.04, y: 150 },
  );
  assert.deepEqual(withPlacement.placements?.[0].edits, { zoom: 1.2, x: 20, y: 100 });
  const legacy = focusPatch({ photo_edits: { "7": { zoom: 1.1 } } }, 7, { x: 10, y: 90 });
  assert.deepEqual(legacy.photo_edits, { "7": { zoom: 1.1, x: 10, y: 90 } });
});

test("title position: stored values, defaults and grid", () => {
  assert.equal(readTitlePosition({}), null);
  assert.equal(readTitlePosition({ title_x: 10 }), null);
  assert.deepEqual(readTitlePosition({ title_x: -5, title_y: 130 }), { x: 0, y: 100 });
  assert.equal(TITLE_GRID.length, 9);
  assert.equal(gridIndex(null), 6); // bottom left = default
  assert.equal(gridIndex({ x: 50, y: 50 }), 4);
  assert.equal(gridIndex({ x: 13, y: 50 }), null);
});

test("title drag maps pixels to the free travel range and clamps", () => {
  const frame = { width: 1000, height: 600 };
  const block = { width: 400, height: 200 };
  assert.deepEqual(dragTitlePosition({ x: 0, y: 100 }, { dx: 300, dy: -200 }, frame, block), { x: 50, y: 50 });
  assert.deepEqual(dragTitlePosition({ x: 90, y: 10 }, { dx: 9999, dy: -9999 }, frame, block), { x: 100, y: 0 });
  // a block as wide as the frame cannot move horizontally
  assert.equal(dragTitlePosition({ x: 20, y: 50 }, { dx: 50, dy: 0 }, frame, { width: 1000, height: 200 }).x, 20);
});

test("title keys nudge, shift is large, Home resets", () => {
  assert.deepEqual(nudgeTitle(null, "ArrowUp"), { x: 0, y: 98 });
  assert.deepEqual(nudgeTitle({ x: 50, y: 50 }, "ArrowRight", true), { x: 60, y: 50 });
  assert.equal(nudgeTitle({ x: 50, y: 50 }, "Home"), null);
});

test("title alignment follows the anchor", () => {
  assert.equal(titleAlign(0), "left");
  assert.equal(titleAlign(50), "center");
  assert.equal(titleAlign(100), "right");
});

test("title snaps to the nine positions only when close", () => {
  assert.deepEqual(snapTitle({ x: 4, y: 97 }), { point: { x: 0, y: 100 }, index: 6 });
  assert.deepEqual(snapTitle({ x: 47, y: 53 }), { point: { x: 50, y: 50 }, index: 4 });
  assert.deepEqual(snapTitle({ x: 25, y: 25 }), { point: { x: 25, y: 25 }, index: null });
});

test("pair stagger maps to opposite offsets, legacy handled", () => {
  assert.equal(pairOffsets({}), undefined);
  assert.equal(pairOffsets({ stagger: 0 }), undefined);
  assert.deepEqual(pairOffsets({ stagger: 100 }), [-72, 72]);
  assert.deepEqual(pairOffsets({ stagger: -50 }), [36, -36]);
  assert.deepEqual(pairOffsets({ stagger: 500 }), [-72, 72]);
  assert.deepEqual(pairOffsets({ column_offsets: [-36, 36] }), [-36, 36]);
  assert.equal(pairOffsets({ column_offsets: [0, 72] }), undefined);
});

test("default side margin follows the theme", () => {
  assert.equal(defaultSideMargin("quiet-atlas", "quiet-atlas", 32), 0);
  assert.equal(defaultSideMargin("quiet-atlas", "after-hours", undefined), 36);
  assert.equal(defaultSideMargin("after-hours", "after-hours", 20), 20);
});
