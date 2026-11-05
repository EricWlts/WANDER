import test from "node:test";
import assert from "node:assert/strict";
import { initialHeaderScroll, updateHeaderScroll, resetHeaderGesture, headerIsCompact, headerScrollThresholds as t, initialHeaderWheel, updateHeaderWheel } from "../src/adaptiveHeader.ts";

const compact = () => ({ ...initialHeaderScroll, compact: true, lastY: 1500, lastTime: 1000 });
const input = (now: number, upwardIntent = true) => ({ now, upwardIntent });

test("downward collapse retains distance hysteresis and opening area", () => {
  let state = updateHeaderScroll(initialHeaderScroll, 150, input(1000));
  assert.equal(state.compact, false);
  state = updateHeaderScroll(state, 180, input(1032));
  assert.equal(state.compact, true);
});
test("long slow upward travel never expands", () => {
  let state = compact();
  for (let i = 1; i <= 160; i++) {
    state = updateHeaderScroll(state, 1500 - i * 6, input(1000 + i * 40));
    assert.equal(state.compact, true);
  }
});
test("fast upward travel needs both sustained time and minimum net distance", () => {
  let state = compact();
  state = updateHeaderScroll(state, 1468, input(1016));
  state = updateHeaderScroll(state, 1436, input(1032));
  state = updateHeaderScroll(state, 1404, input(1048));
  assert.equal(state.compact, true);
  state = updateHeaderScroll(state, 1372, input(1064));
  assert.equal(state.compact, false);
});
test("same time and distance produce the same result at different event rates", () => {
  for (const interval of [8, 16, 32, 64]) {
    let state = compact();
    for (let elapsed = interval; elapsed <= 128; elapsed += interval)
      state = updateHeaderScroll(state, 1500 - elapsed, input(1000 + elapsed));
    assert.equal(state.compact, false);
  }
});
test("minimum distance alone does not suffice at low velocity", () => {
  let state = compact();
  for (let i = 1; i <= 6; i++)
    state = updateHeaderScroll(state, 1500 - i * 20, input(1000 + i * 40));
  assert.equal(state.compact, true);
});
test("micro jitter cannot accumulate into a gesture", () => {
  let state = compact();
  for (let i = 1; i <= 100; i++)
    state = updateHeaderScroll(state, 1500 + (i % 2 ? -1 : 1), input(1000 + i * 16));
  assert.equal(state.compact, true);
  assert.equal(state.upTravel, 0);
});
test("small reversals subtract from upward travel without direction flicker", () => {
  let state = compact();
  for (const [y, now] of [[1470, 1016], [1475, 1032], [1435, 1048], [1405, 1064]])
    state = updateHeaderScroll(state, y, input(now));
  assert.equal(state.compact, true);
  state = updateHeaderScroll(state, 1385, input(1080));
  assert.equal(state.compact, false);
});
test("meaningful reversal starts a fresh burst", () => {
  let state = updateHeaderScroll(compact(), 1440, input(1032));
  state = updateHeaderScroll(state, 1450, input(1048));
  state = updateHeaderScroll(state, 1400, input(1080));
  assert.equal(state.compact, true);
  assert.equal(state.upTravel, 50);
});
test("idle intervals, late momentum, anchor corrections and spikes do not expand", () => {
  for (const [delta, elapsed, intent] of [[-200, 32, false], [-200, 200, true], [-300, 16, true], [-600, 100, true]] as const) {
    const state = updateHeaderScroll(compact(), 1500 + delta, input(1000 + elapsed, intent));
    assert.equal(state.compact, true);
    assert.equal(state.upTravel, 0);
  }
});
test("a single fast frame followed by unrequested touch momentum does not expand", () => {
  let state = updateHeaderScroll(compact(), 1380, input(1016));
  assert.equal(state.compact, true);
  state = updateHeaderScroll(state, 1280, input(1080, false));
  assert.equal(state.compact, true);
});
test("top wins over temporary hover/focus and negative bounce is clamped", () => {
  assert.equal(updateHeaderScroll(compact(), t.top, { now: 1016, protectedInteraction: true }).compact, false);
  assert.equal(updateHeaderScroll(compact(), -30, input(1016)).lastY, 0);
});
test("open menu freezes either state even at top and resets travel", () => {
  for (const value of [false, true]) {
    const state = updateHeaderScroll({ ...compact(), compact: value }, 0, { now: 1100, menuOpen: true });
    assert.equal(state.compact, value);
    assert.equal(state.upTravel, 0);
  }
});
test("protected interactions preserve underlying scroll intent", () => {
  const state = updateHeaderScroll(compact(), 1100, { now: 1100, protectedInteraction: true });
  assert.equal(state.compact, true);
  assert.equal(state.travel, 0);
});
test("layout and menu resets discard accumulated motion", () => {
  const moving = updateHeaderScroll(compact(), 1440, input(1032));
  const state = resetHeaderGesture(moving, 1400, 1064);
  assert.equal(state.upTravel, 0);
  assert.equal(updateHeaderScroll(state, 1340, input(1096)).compact, true);
});
test("studio disables adaptation", () => {
  const state = updateHeaderScroll(compact(), 1000, { now: 1064, upwardIntent: true, enabled: false });
  assert.equal(state.compact, true);
  assert.equal(state.upTravel, 0);
});
test("hover and focus temporarily reveal public and studio without mutating scroll state", () => {
  for (const publicHeader of [false, true]) {
    assert.equal(headerIsCompact(true, publicHeader, false, false, null), true);
    assert.equal(headerIsCompact(true, publicHeader, true, false, null), false);
    assert.equal(headerIsCompact(true, publicHeader, false, true, null), false);
    assert.equal(headerIsCompact(true, publicHeader, true, true, true), true);
    assert.equal(headerIsCompact(true, publicHeader, false, false, false), false);
  }
});


test("pixel, line and page wheel modes use direction while actual CSS-px travel decides expansion", () => {
  for (const mode of [0, 1, 2]) {
    let wheel = initialHeaderWheel;
    let state = compact();
    for (let i = 1; i <= 4; i++) {
      const now = 1000 + i * 16;
      wheel = updateHeaderWheel(wheel, -1, mode, now);
      assert.equal(wheel.upward, true);
      state = updateHeaderScroll(state, 1500 - i * 32, input(now, wheel.upward));
    }
    assert.equal(state.compact, false);
  }
});
test("a short wheel flick cannot use its long decaying tail to complete expansion", () => {
  let wheel = initialHeaderWheel;
  let state = compact();
  let y = 1500;
  // Total travel is162px over112ms: fast and far enough without tail protection.
  for (const [i, magnitude] of [48, 36, 27, 20, 14, 10, 7].entries()) {
    const now = 1016 + i * 16;
    wheel = updateHeaderWheel(wheel, -magnitude, 0, now);
    y -= magnitude;
    state = updateHeaderScroll(state, y, input(now, wheel.upward));
    assert.equal(state.compact, true);
    if (i > 0) assert.equal(wheel.upward, false);
  }
  assert.equal(wheel.tail, true);
});
test("sustained deliberate fast wheel movement remains eligible through mild variation", () => {
  let wheel = initialHeaderWheel;
  let state = compact();
  let y = 1500;
  for (const [i, magnitude] of [32, 31, 33, 31, 32].entries()) {
    const now = 1016 + i * 16;
    wheel = updateHeaderWheel(wheel, -magnitude, 0, now);
    assert.equal(wheel.upward, true);
    y -= magnitude;
    state = updateHeaderScroll(state, y, input(now, wheel.upward));
  }
  assert.equal(state.compact, false);
});
test("constant wheel tails cannot authorize indefinitely and a real gap restarts the burst", () => {
  let wheel = updateHeaderWheel(initialHeaderWheel, -30, 0, 1000);
  for (let elapsed = 16; elapsed <= 240; elapsed += 16)
    wheel = updateHeaderWheel(wheel, -30, 0, 1000 + elapsed);
  assert.equal(wheel.upward, false);
  wheel = updateHeaderWheel(wheel, -30, 0, 1400);
  assert.equal(wheel.upward, true);
  assert.equal(wheel.start, 1400);
});
test("renewed acceleration, direction and unit-mode changes start fresh wheel bursts", () => {
  const start = updateHeaderWheel(initialHeaderWheel, -40, 0, 1000);
  const tail = updateHeaderWheel(start, -20, 0, 1016);
  assert.equal(tail.upward, false);
  assert.equal(updateHeaderWheel(tail, -28, 0, 1032).upward, true);
  const down = updateHeaderWheel(tail, 20, 0, 1032);
  assert.equal(down.upward, false);
  assert.equal(updateHeaderWheel(down, -20, 0, 1048).upward, true);
  assert.equal(updateHeaderWheel(tail, -1, 1, 1032).upward, true);
});


test("slow-to-fast cadence with identical line/page steps rearms an expired burst", () => {
  for (const mode of [1, 2]) {
    let wheel = initialHeaderWheel;
    let state = compact();
    let y = 1500;
    for (let now = 1000; now <= 1400; now += 100) {
      wheel = updateHeaderWheel(wheel, -1, mode, now);
      y -= 16;
      state = updateHeaderScroll(state, y, input(now, wheel.upward));
    }
    assert.equal(wheel.upward, false);
    assert.equal(state.compact, true);
    for (let i = 1; i <= 4; i++) {
      const now = 1400 + i * 16;
      wheel = updateHeaderWheel(wheel, -1, mode, now);
      assert.equal(wheel.upward, true);
      y -= 32;
      state = updateHeaderScroll(state, y, input(now, wheel.upward));
    }
    assert.equal(wheel.start, 1416);
    assert.equal(state.compact, false);
  }
});
test("faster cadence cannot rearm a still-declining wheel momentum tail", () => {
  let wheel = updateHeaderWheel(initialHeaderWheel, -60, 0, 1000);
  wheel = updateHeaderWheel(wheel, -40, 0, 1064);
  assert.equal(wheel.tail, true);
  for (const [now, magnitude] of [[1080, 30], [1088, 20], [1092, 10]]) {
    wheel = updateHeaderWheel(wheel, -magnitude, 0, now);
    assert.equal(wheel.upward, false);
    assert.equal(wheel.tail, true);
  }
});
