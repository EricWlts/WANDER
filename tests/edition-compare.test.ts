import test from "node:test";
import assert from "node:assert/strict";
import { editionSplit, sceneProgress, heroCopyOpacity, heroDim } from "../src/editionCompare.ts";

test("edition split holds at the ends and crosses the middle at half progress", () => {
  assert.equal(editionSplit(0), 100);
  assert.equal(editionSplit(0.1), 100);
  assert.equal(editionSplit(0.5), 50);
  assert.equal(editionSplit(0.9), 0);
  assert.equal(editionSplit(1), 0);
  assert.equal(editionSplit(-3), 100);
  assert.equal(editionSplit(7), 0);
});

test("edition split never moves backwards", () => {
  let last = 101;
  for (let i = 0; i <= 100; i++) {
    const x = editionSplit(i / 100);
    assert.ok(x <= last);
    last = x;
  }
});

test("scene progress maps wrapper offset to 0..1", () => {
  assert.equal(sceneProgress(100, 2000, 800), 0);
  assert.equal(sceneProgress(-600, 2000, 800), 0.5);
  assert.equal(sceneProgress(-5000, 2000, 800), 1);
  assert.equal(sceneProgress(0, 800, 800), 0);
});

test("hero copy stays visible to 45 % and is gone by 90 %", () => {
  assert.equal(heroCopyOpacity(0.2), 1);
  assert.equal(heroCopyOpacity(0.45), 1);
  assert.ok(heroCopyOpacity(0.675) > 0.4 && heroCopyOpacity(0.675) < 0.6);
  assert.equal(heroCopyOpacity(0.9), 0);
  assert.equal(heroDim(0.4), 0);
  assert.ok(Math.abs(heroDim(1) - 0.9) < 1e-9);
});
