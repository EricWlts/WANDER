import test from "node:test";
import assert from "node:assert/strict";
import { canPanImage, parallaxShift, maxParallaxShift } from "../src/imageParallax.ts";
import { railPhoto } from "../src/photoRailModel.ts";
import type { Photo } from "../src/types.ts";

test("full-motif containment and single rail pages remain static without changing crop or lightbox source", () => {
  const photo = {
    edits: { fit: "cover", zoom: 1.8, x: 21, y: 74, ratio: "4:5" },
  } as Photo;
  const before = structuredClone(photo);
  assert.equal(canPanImage(photo), true);
  assert.equal(canPanImage(railPhoto(photo, false)), true);
  assert.equal(canPanImage(railPhoto(photo, true)), false);
  assert.equal(
    canPanImage({ ...photo, edits: { ...photo.edits, fit: "contain" } }),
    false,
  );
  assert.equal(canPanImage(null), false);
  assert.deepEqual(photo, before);
});

test("parallax shift is bounded, signed, and gentler on small touch viewports", () => {
  assert.equal(parallaxShift(0, 140), 0);
  assert.equal(parallaxShift(1, 140), maxParallaxShift);
  assert.equal(parallaxShift(-3, 140), -maxParallaxShift);
  assert.equal(parallaxShift(1, 40), 20);
  assert.ok(parallaxShift(1, 140, true) < parallaxShift(1, 140));
  assert.equal(parallaxShift(Number.NaN, 90), 0);
});

test("cover parallax shifts twice as far as the regular ceiling", async () => {
  const { coverParallaxIntensity, coverParallaxShift } = await import("../src/imageParallax.ts");
  assert.equal(parallaxShift(1, coverParallaxIntensity), coverParallaxShift);
  assert.ok(coverParallaxShift >= 60 && coverParallaxShift <= 80);
  assert.ok(Math.abs(parallaxShift(0.02, coverParallaxIntensity)) < 1);
  // The layer overscan (intensity / 2 + 8) always covers the full shift: no edges.
  assert.ok(coverParallaxIntensity * 0.5 + 8 >= coverParallaxShift);
});
