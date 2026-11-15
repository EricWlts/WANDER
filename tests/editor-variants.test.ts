import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPreset,
  presetDistance,
  presetsFor,
  stepVariant,
  variantState,
  legacyLayoutPatch,
  readLayout,
} from "../src/editorPresets.ts";
import type { ModuleKind } from "../src/editorPresets.ts";

const kinds: ModuleKind[] = [
  "chapter", "text", "quote", "gallery", "hero",
  "image", "pair", "rail", "filmstrip", "wall",
];

test("the active variant is the exact match and is not customised", () => {
  for (const kind of kinds)
    presetsFor(kind).forEach((preset, i) => {
      const state = variantState(applyPreset({}, preset), kind);
      assert.equal(state.index, i, `${kind}/${preset.id}`);
      assert.equal(state.customised, false, `${kind}/${preset.id}`);
      assert.equal(presetDistance(applyPreset({}, preset), kind, preset), 0);
    });
});

test("an empty layout counts as the first variant where the defaults agree", () => {
  const state = variantState({}, "image");
  assert.equal(state.list[state.index].id, "bleed");
  assert.equal(state.customised, true); // padding 0 is not the renderer default
  assert.equal(variantState(undefined, "hero").index, 0);
  assert.equal(variantState(undefined, "hero").customised, false);
});

test("own fine settings mark the module as customised but keep its variant", () => {
  const bleed = presetsFor("image").find((p) => p.id === "bleed")!;
  const tuned = { ...applyPreset({}, bleed), padding: 8 };
  const state = variantState(tuned, "image");
  assert.equal(state.list[state.index].id, "bleed");
  assert.equal(state.customised, true);
  // Fields no variant controls never count as a deviation.
  const framed = { ...applyPreset({}, bleed), ratio: "4:5" as const, margin_x: 40 };
  assert.equal(variantState(framed, "image").customised, false);
});

test("on a tie the closest values decide, then the earlier variant", () => {
  // Wall: gap 12 matches "balanced", padding 56 matches "airy" → one difference each;
  // padding 56 is 24 away from "balanced", gap 12 only 16 away from "airy".
  const state = variantState({ gap: 12, padding: 56 }, "wall");
  assert.equal(state.list[state.index].id, "airy");
  assert.equal(state.customised, true);
  // Exactly halfway between two variants → the earlier one.
  assert.equal(variantState({ gap: 12, padding: 22 }, "wall").list[0].id, "balanced");
  assert.equal(variantState({ gap: 8, padding: 32 }, "wall").index, 0);
});

test("next and previous wrap around and visit every variant once", () => {
  for (const kind of kinds) {
    const list = presetsFor(kind);
    let layout = applyPreset({}, list[0]);
    const seen: string[] = [];
    for (let i = 0; i < list.length; i++) {
      const next = stepVariant(layout, kind, 1)!;
      seen.push(next.id);
      layout = applyPreset(layout, next);
    }
    assert.deepEqual(seen, [...list.slice(1), list[0]].map((p) => p.id), kind);
    const back = stepVariant(applyPreset({}, list[0]), kind, -1)!;
    assert.equal(back.id, list[list.length - 1].id, kind);
  }
});

test("stepping from a customised module starts at its variant", () => {
  const list = presetsFor("text");
  const tuned = { ...applyPreset({}, list[1]), padding: 10 };
  assert.equal(stepVariant(tuned, "text", 1)!.id, list[2].id);
  assert.equal(stepVariant(tuned, "text", -1)!.id, list[0].id);
});

test("applying a variant replaces only the fields variants control", () => {
  const [framed, bleed] = presetsFor("image");
  const layout = { ...applyPreset({}, framed), ratio: "3:2" as const, padding: 12 };
  const next = applyPreset(layout, bleed);
  assert.equal(next.padding, 0);
  assert.equal(next.ratio, "3:2");
  assert.equal(variantState(next, "image").customised, false);
});

test("the former „Mit Weißraum“ image reads as „Gerahmt“", () => {
  const legacy = { padding: 64, media_spacing: 0, media_spacing_top: 0, media_spacing_bottom: 0, ratio: "3:2" as const };
  const read = readLayout("image", legacy);
  assert.equal(read.frame, true);
  assert.equal(read.ratio, "3:2");
  const state = variantState(legacy, "image");
  assert.equal(state.list[state.index].id, "framed");
  assert.equal(state.customised, false);
  assert.deepEqual(legacyLayoutPatch("image", { padding: 64, frame: false }), {});
  assert.deepEqual(legacyLayoutPatch("image", { padding: 40 }), {});
  assert.deepEqual(legacyLayoutPatch("pair", { padding: 64 }), {});
});

test("no two variants of a kind are near-duplicates", () => {
  assert.deepEqual(presetsFor("image").map((p) => p.id), ["framed", "bleed"]);
  assert.deepEqual(presetsFor("wall").map((p) => p.id), ["balanced", "airy"]);
  assert.deepEqual(presetsFor("gallery").map((p) => p.id), ["balanced", "airy"]);
});
