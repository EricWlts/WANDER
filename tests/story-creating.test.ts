import assert from "node:assert/strict";
import test from "node:test";
import { CREATING_ZOOM_MS, DRAW_SHARE, FILL_START, EDGE_SOFT, MARK_BOTTOM, MARK_TOP, creatingFinished, drawProgress, fillEdgeY, fillProgress, lineIndexAt, progressAt, storyCreatingPlan } from "../src/storyCreatingPlan.ts";
import { W_STROKES, WINDOW, WINDOW_TOTAL_MS, coverScale, cubicBezier, strokeShare, windowScale } from "../src/wMark.ts";

test("full motion: four lines, each readable for at least 1.6 s, about 7 s until the zoom", () => {
  const plan = storyCreatingPlan(false, "quiet-atlas");
  assert.equal(plan.lines.length, 4);
  assert.ok(plan.totalMs >= 7000 && plan.totalMs <= 7200);
  plan.starts.forEach((start, i) => {
    const end = i + 1 < plan.starts.length ? plan.starts[i + 1] : plan.totalMs;
    assert.ok(end - start >= 1600, `line ${i}`);
  });
});

test("the window grows for 1.4 to 1.6 s with full motion, none when reduced", () => {
  assert.ok(CREATING_ZOOM_MS >= 1400 && CREATING_ZOOM_MS <= 1600);
  assert.equal(CREATING_ZOOM_MS, WINDOW.growMs);
  assert.equal(storyCreatingPlan(false, "quiet-atlas").zoomMs, CREATING_ZOOM_MS);
  assert.equal(storyCreatingPlan(true, "quiet-atlas").zoomMs, 0);
  assert.equal(WINDOW_TOTAL_MS, WINDOW.photoInMs + WINDOW.growMs + WINDOW.fadeMs);
});

test("ridge is drawn first, then the letter rises with the uneven percentage; nothing is visible at the start", () => {
  assert.equal(drawProgress(0), 0);
  assert.equal(fillProgress(0), 0);
  assert.equal(fillEdgeY(fillProgress(0)), MARK_BOTTOM);
  assert.ok(Math.abs(drawProgress(DRAW_SHARE) - 1) < 1e-6);
  assert.ok(DRAW_SHARE <= FILL_START);
  assert.equal(fillProgress(FILL_START), 0);
  assert.equal(fillProgress(1), 1);
  assert.equal(fillProgress(1, false), 0.95);
  let last = 0;
  for (let x = FILL_START; x <= 1; x += 0.01) {
    const p = fillProgress(x);
    assert.ok(p >= last - 1e-9);
    last = p;
  }
});

test("window maths: eased, exponential growth that covers the screen", () => {
  const ease = cubicBezier(...WINDOW.ease);
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.ok(ease(0.25) < 0.25 && ease(0.75) > 0.75);
  assert.equal(windowScale(0, 40), 1);
  assert.ok(Math.abs(windowScale(1, 40) - 40) < 1e-9);
  assert.ok(coverScale(1000, 30) >= 1000 / 30);
  assert.ok(WINDOW.photoScaleFrom > 1);
});

test("fill edge rises from below the baseline to above the letter", () => {
  assert.equal(fillEdgeY(0), MARK_BOTTOM);
  assert.equal(fillEdgeY(1), MARK_TOP - EDGE_SOFT);
  assert.ok(fillEdgeY(0.5) < fillEdgeY(0.2));
  assert.equal(fillEdgeY(2), fillEdgeY(1));
});

test("after-hours names the last light, otherwise the first", () => {
  assert.match(storyCreatingPlan(false, "after-hours").lines[1].en, /Last light/);
  assert.match(storyCreatingPlan(false, "quiet-atlas").lines[1].de, /erste Licht/);
});

test("reduced motion shows one line for 1.5 s", () => {
  const plan = storyCreatingPlan(true, "quiet-atlas");
  assert.equal(plan.lines.length, 1);
  assert.equal(plan.totalMs, 1500);
});

test("progress is monotonic, reaches 1 and waits at 95 % until ready", () => {
  let last = 0;
  for (let ms = 0; ms <= 7000; ms += 50) {
    const p = progressAt(ms, 7000, true);
    assert.ok(p >= last - 1e-9);
    last = p;
  }
  assert.equal(progressAt(7000, 7000, true), 1);
  assert.equal(progressAt(7000, 7000, false), 0.95);
  assert.equal(progressAt(0, 7000, true), 0);
});

test("line index and finish", () => {
  const plan = storyCreatingPlan(false, "quiet-atlas");
  assert.equal(lineIndexAt(plan.starts, 0), 0);
  assert.equal(lineIndexAt(plan.starts, 3600), 2);
  assert.equal(lineIndexAt(plan.starts, 6900), 3);
  assert.equal(creatingFinished(7000, 7000, false), false);
  assert.equal(creatingFinished(7000, 7000, true), true);
});
