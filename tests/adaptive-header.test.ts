import test from "node:test";
import assert from "node:assert/strict";
import {
  initialHeaderScroll,
  updateHeaderScroll,
} from "../src/adaptiveHeader.ts";

test("header waits for deliberate downward travel beyond the opening area", () => {
  let state = updateHeaderScroll(initialHeaderScroll, 150);
  assert.equal(state.compact, false);
  state = updateHeaderScroll(state, 185);
  assert.equal(state.compact, true);
  state = updateHeaderScroll(state, 89);
  assert.equal(state.compact, false);
  state = updateHeaderScroll(state, 160);
  assert.equal(state.compact, false);
  state = updateHeaderScroll(state, 180);
  assert.equal(state.compact, true);
});
test("compact header ignores small repeated trackpad reversals", () => {
  let state = updateHeaderScroll(initialHeaderScroll, 500);
  for (let i = 0; i < 30; i++) {
    for (const y of [494, 502, 490, 499, 480, 492])
      state = updateHeaderScroll(state, y);
  }
  assert.equal(state.compact, true);
  state = updateHeaderScroll(state, 407);
  assert.equal(state.compact, true);
  state = updateHeaderScroll(state, 406);
  assert.equal(state.compact, false);
});
test("small reversals preserve deliberate net travel without double counting", () => {
  let state = updateHeaderScroll(initialHeaderScroll, 500);
  for (const y of [470, 474, 444, 449, 420, 424, 405])
    state = updateHeaderScroll(state, y);
  assert.equal(state.compact, true);
  state = updateHeaderScroll(state, 404);
  assert.equal(state.compact, false);
  for (const y of [425, 421, 450, 444, 475])
    state = updateHeaderScroll(state, y);
  assert.equal(state.compact, false);
  state = updateHeaderScroll(state, 476);
  assert.equal(state.compact, true);
});
test("fast scrolling responds to distance in one frame and top immediately wins", () => {
  let state = updateHeaderScroll(initialHeaderScroll, 1800);
  assert.equal(state.compact, true);
  state = updateHeaderScroll(state, 1500);
  assert.equal(state.compact, false);
  state = updateHeaderScroll(state, 2200);
  assert.equal(state.compact, true);
  assert.equal(updateHeaderScroll(state, 24).compact, false);
  assert.equal(updateHeaderScroll(state, -30).lastY, 0);
});
test("ordinary header focus holds expanded and starts fresh after leaving", () => {
  let state = updateHeaderScroll(initialHeaderScroll, 400);
  for (const y of [430, 1200, 800]) {
    state = updateHeaderScroll(state, y, true);
    assert.equal(state.compact, false);
    assert.equal(state.travel, 0);
  }
  state = updateHeaderScroll(state, 871);
  assert.equal(state.compact, false);
  state = updateHeaderScroll(state, 872);
  assert.equal(state.compact, true);
});
test("stationary frames preserve travel and studio disables adaptation", () => {
  const compact = updateHeaderScroll(initialHeaderScroll, 400);
  const upward = updateHeaderScroll(compact, 350);
  assert.equal(updateHeaderScroll(upward, 350), upward);
  const studio = updateHeaderScroll(upward, 900, false, false);
  assert.equal(studio.compact, false);
  assert.equal(studio.travel, 0);
});

test("an open menu holds either header state through focus and background scrolling", () => {
  for (const compact of [false, true]) {
    let state = { compact, lastY: 500, travel: compact ? -80 : 60 };
    for (const y of [530, 1500, 300, 0, 200, 800]) {
      state = updateHeaderScroll(state, y, true, true, true);
      assert.deepEqual(state, { compact, lastY: y, travel: 0 });
    }
  }
});
test("closing a compact menu requires fresh upward travel", () => {
  let state = updateHeaderScroll(initialHeaderScroll, 500);
  for (const y of [300, 0, 800])
    state = updateHeaderScroll(state, y, false, true, true);
  state = updateHeaderScroll(state, 800);
  assert.equal(state.compact, true);
  state = updateHeaderScroll(state, 705);
  assert.equal(state.compact, true);
  state = updateHeaderScroll(state, 704);
  assert.equal(state.compact, false);
});
test("closing an expanded menu requires fresh downward travel", () => {
  let state = updateHeaderScroll(initialHeaderScroll, 500, false, true, true);
  state = updateHeaderScroll(state, 500);
  assert.equal(state.compact, false);
  state = updateHeaderScroll(state, 571);
  assert.equal(state.compact, false);
  state = updateHeaderScroll(state, 572);
  assert.equal(state.compact, true);
});
test("the menu lock preserves the existing disabled studio behavior", () => {
  const compact = updateHeaderScroll(initialHeaderScroll, 500);
  assert.deepEqual(updateHeaderScroll(compact, 900, true, false, true), {
    compact: false, lastY: 900, travel: 0,
  });
});
