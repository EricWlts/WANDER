import assert from "node:assert/strict";
import test from "node:test";
import { editionSampleTitle, editionTraits } from "../src/editionCopy.ts";

test("traits are shared by edition and language", () => {
  assert.deepEqual(editionTraits("quiet-atlas", "de"), ["Helle Darstellung", "Mit Rändern", "Ruhige Typografie"]);
  assert.deepEqual(editionTraits("after-hours", "en"), ["Dark layout", "Full-bleed", "Cinematic"]);
  assert.deepEqual(editionTraits("unknown", "en"), []);
});

test("the sample title prefers the studio title", () => {
  assert.equal(editionSampleTitle("quiet-atlas", "de"), "Zwischen Schnee und Stille");
  assert.equal(editionSampleTitle("after-hours", "en", { en: "Mine", de: "" }), "Mine");
  assert.equal(editionSampleTitle("after-hours", "de", { en: "Mine", de: "" }), "Was die Sonne dalässt");
});
