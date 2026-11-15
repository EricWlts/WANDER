import test from "node:test";
import assert from "node:assert/strict";
import {
  fixedHoverZoom,
  fixedMotion,
  fixedMotionTable,
  fixedParallax,
  fixedReveal,
  heroParallaxIntensity,
  hoverScale,
  subtleHoverZoom,
  type MotionKind,
} from "../src/fixedMotion.ts";
import { coverParallaxIntensity } from "../src/imageParallax.ts";

const kinds = Object.keys(fixedMotionTable) as MotionKind[];

test("the table covers every module kind and the story cover", () => {
  for (const kind of ["cover", "hero", "chapter", "text", "quote", "image", "pair", "gallery", "wall", "rail", "filmstrip"] as const)
    assert.ok(fixedMotionTable[kind], kind);
  assert.equal(kinds.length, 11);
});

test("text, quote and cover never fade in; every other module fades calmly", () => {
  for (const kind of ["cover", "text", "quote"] as const) assert.equal(fixedReveal(kind).effect, "none", kind);
  for (const kind of kinds.filter((k) => !["cover", "text", "quote"].includes(k)))
    assert.equal(fixedReveal(kind).effect, "fade", kind);
  for (const kind of kinds) {
    assert.equal(fixedReveal(kind).delay, 0);
    assert.ok(["none", "fade"].includes(fixedReveal(kind).effect), "no moving or parallax reveals");
  }
});

test("only the cover and the cover module use parallax; the story cover stays the stronger one", () => {
  assert.deepEqual(fixedParallax("cover"), { enabled: true, intensity: coverParallaxIntensity });
  assert.deepEqual(fixedParallax("hero"), { enabled: true, intensity: heroParallaxIntensity });
  assert.ok(fixedParallax("cover").intensity > fixedParallax("hero").intensity);
  for (const kind of kinds.filter((k) => k !== "cover" && k !== "hero"))
    assert.deepEqual(fixedParallax(kind), { enabled: false, intensity: 0 }, kind);
});

test("hover zoom is subtle, off on touch devices and never crops a fully shown motif", () => {
  assert.equal(subtleHoverZoom, 2.5);
  assert.equal(fixedHoverZoom("image"), 2.5);
  assert.equal(fixedHoverZoom("image", { touch: true }), 0);
  assert.equal(fixedHoverZoom("image", { contain: true }), 0);
  assert.equal(hoverScale("image"), 1.025);
  assert.equal(hoverScale("image", { touch: true }), 1);
  for (const kind of kinds) assert.ok(fixedMotion(kind).hoverZoom <= subtleHoverZoom, kind);
  for (const kind of ["cover", "hero", "text", "quote", "rail", "filmstrip"] as const)
    assert.equal(fixedHoverZoom(kind), 0, kind);
});

test("an unknown kind from old data falls back to the image values", () => {
  assert.deepEqual(fixedMotion("mystery" as MotionKind), fixedMotionTable.image);
});
