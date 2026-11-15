import test from "node:test";
import assert from "node:assert/strict";
import { smoothDamp } from "../src/titleDock.ts";

test("smoothDamp converges to the target without overshoot", () => {
  let value = 0;
  let velocity = 0;
  for (let i = 0; i < 120; i++) {
    ({ value, velocity } = smoothDamp(value, 1, velocity, 0.24, 1 / 60, 4));
    assert.ok(value <= 1 + 1e-9);
  }
  assert.ok(Math.abs(value - 1) < 0.01);
});

test("smoothDamp is monotonic and respects maxSpeed", () => {
  let value = 0;
  let velocity = 0;
  let prev = 0;
  for (let i = 0; i < 10; i++) {
    ({ value, velocity } = smoothDamp(value, 1, velocity, 0.24, 1 / 60, 2));
    assert.ok(value >= prev);
    prev = value;
  }
  assert.ok(value < 0.5);
});
