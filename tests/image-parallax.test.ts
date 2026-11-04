import test from "node:test";
import assert from "node:assert/strict";
import { imageParallax, canPanImage } from "../src/imageParallax.ts";
import { railPhoto } from "../src/photoRailModel.ts";
import type { Photo } from "../src/types.ts";

test("untouched cover defaults and saved strengths survive while other modules stay static", () => {
  assert.deepEqual(imageParallax({}, true), { enabled: true, intensity: 90 });
  assert.deepEqual(
    imageParallax({ parallax: false, parallax_intensity: 125 }, true),
    { enabled: false, intensity: 125 },
  );
  assert.deepEqual(imageParallax({ parallax_intensity: 20 }, true), {
    enabled: true,
    intensity: 20,
  });
  assert.equal(imageParallax({ parallax: true }).enabled, false);
});

test("an explicit choice uses the same maximum on covers and modules without destroying legacy settings", () => {
  const legacy = { parallax: false, parallax_intensity: 125 };
  for (const cover of [false, true]) {
    assert.deepEqual(
      imageParallax({ ...legacy, image_parallax: true }, cover),
      { enabled: true, intensity: 140 },
    );
    assert.deepEqual(
      imageParallax({ ...legacy, image_parallax: false }, cover),
      { enabled: false, intensity: 140 },
    );
  }
  assert.deepEqual(legacy, { parallax: false, parallax_intensity: 125 });
});

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
