import assert from "node:assert/strict";
import test from "node:test";
import { storyCreatingPlan } from "../src/storyCreatingPlan.ts";

test("full motion shows four lines for at least 3.6 s", () => {
  const plan = storyCreatingPlan(false, "quiet-atlas");
  assert.equal(plan.lines.length, 4);
  assert.ok(plan.totalMs >= 3600);
  assert.equal(plan.totalMs, plan.lines.length * plan.lineMs);
  assert.equal(plan.lines[2].en, "Setting the light …");
});

test("after-hours changes the third line", () => {
  assert.equal(storyCreatingPlan(false, "after-hours").lines[2].de, "Es wird Abend …");
});

test("reduced motion shows one static line for about 900 ms", () => {
  const plan = storyCreatingPlan(true, "quiet-atlas");
  assert.equal(plan.lines.length, 1);
  assert.equal(plan.totalMs, 900);
});
