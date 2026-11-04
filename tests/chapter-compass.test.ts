import test from "node:test";
import assert from "node:assert/strict";
import {
  activeChapterIndex,
  updateReadingDirection,
} from "../src/chapterCompass.ts";

test("scroll direction accumulates deliberate upward reading, ignoring small reversals", () => {
  let state = { anchor: 500, visible: false };
  for (const y of [490, 494, 480, 483, 465])
    state = updateReadingDirection(state, y);
  assert.equal(state.visible, false);
  state = updateReadingDirection(state, 452);
  assert.equal(state.visible, true);
  for (const y of [457, 455, 461]) state = updateReadingDirection(state, y);
  assert.equal(state.visible, true);
  assert.equal(updateReadingDirection(state, 468).visible, false);
});

test("downward travel resets the upward threshold from the furthest point", () => {
  let state = updateReadingDirection({ anchor: 500, visible: false }, 900);
  state = updateReadingDirection(state, 860);
  assert.equal(state.visible, false);
  assert.equal(updateReadingDirection(state, 852).visible, true);
});

test("active chapter follows full geometry after forward and backward jumps", () => {
  assert.equal(activeChapterIndex([400, 1800, 3200], 240), 0);
  assert.equal(activeChapterIndex([-2900, -1500, -100], 240), 2);
  assert.equal(activeChapterIndex([-1600, -200, 1200], 240), 1);
  assert.equal(activeChapterIndex([-100, 1300, 2700], 240), 0);
  assert.equal(activeChapterIndex([-100, 240, 2700], 240), 1);
});
