import assert from "node:assert/strict";
import test from "node:test";
import {
  chapterBlend,
  cloneOpacity,
  dockProgress,
  flightPose,
  lineTextOpacity,
  resolveActiveChapter,
} from "../src/titleDock.ts";

test("dock progress is 0 far away, 1 at the edge, linear between", () => {
  assert.equal(dockProgress(400, 90), 0);
  assert.equal(dockProgress(210, 90), 0);
  assert.equal(dockProgress(150, 90), 0.5);
  assert.equal(dockProgress(90, 90), 1);
  assert.equal(dockProgress(-50, 90), 1);
});

test("clone and line text hand over", () => {
  assert.equal(cloneOpacity(0), 1);
  assert.equal(cloneOpacity(1), 0);
  assert.equal(lineTextOpacity(0.4), 0);
  assert.equal(lineTextOpacity(1), 1);
});

test("flight pose hits both ends", () => {
  const a = { x: 10, y: 300, s: 1 };
  const b = { x: 200, y: 40, s: 0.1 };
  assert.deepEqual(flightPose(a, b, 0), a);
  const end = flightPose(a, b, 1);
  assert.equal(end.x, 200);
  assert.equal(end.y, 40);
  assert.ok(Math.abs(end.s - 0.1) < 1e-9);
});

test("chapter blend and active chapter follow the bar edge", () => {
  assert.equal(chapterBlend(200, 100), 0);
  assert.equal(chapterBlend(100, 100), 1);
  assert.equal(chapterBlend(140, 100), 0.5);
  assert.equal(resolveActiveChapter([-300, 90, 400], 100), 1);
  assert.equal(resolveActiveChapter([-300, 150, 400], 100), 0);
  assert.equal(resolveActiveChapter([-300, 180, 400], 100, 1), 1);
  assert.equal(resolveActiveChapter([-300, 260, 400], 100, 1), 0);
});
