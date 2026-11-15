import test from "node:test";
import assert from "node:assert/strict";
import { centerRevealOpacity, revealIsInZone } from "../src/revealMath.ts";

test("elements overlapping the zone are placed instantly", () => {
  assert.equal(revealIsInZone(100, 300, 0, 900), true);
  assert.equal(revealIsInZone(850, 1200, 0, 900), true);
  assert.equal(revealIsInZone(-400, -1, 0, 900), false);
  assert.equal(revealIsInZone(900, 1200, 0, 900), false);
});

test("an element well inside the zone has full final opacity", () => {
  assert.equal(centerRevealOpacity(200, 500, 0, 900), 1);
});
