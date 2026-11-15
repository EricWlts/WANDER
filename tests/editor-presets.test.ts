import test from "node:test";
import assert from "node:assert/strict";
import {
  applyPreset,
  pickerGroups,
  initialLayoutFor,
  basePreset,
  matchPreset,
  nextPreset,
  presetsFor,
} from "../src/editorPresets.ts";
import type { ModuleKind } from "../src/editorPresets.ts";

const kinds: ModuleKind[] = [
  "chapter", "text", "quote", "gallery", "hero",
  "image", "pair", "rail", "filmstrip", "wall",
];

test("every module kind offers 2 to 4 presets with unique ids", () => {
  for (const kind of kinds) {
    const list = presetsFor(kind);
    assert.ok(list.length >= 2 && list.length <= 4, kind);
    assert.equal(new Set(list.map((p) => p.id)).size, list.length, kind);
  }
});

test("each preset is recognised after applying it, and presets are distinguishable", () => {
  for (const kind of kinds)
    for (const preset of presetsFor(kind)) {
      assert.equal(matchPreset(applyPreset({}, preset), kind), preset.id, `${kind}/${preset.id}`);
      assert.equal(matchPreset(applyPreset({ padding: 99, gap: 3 }, preset), kind), preset.id);
    }
});

test("applyPreset keeps unrelated fields, never mutates and leaves no undefined keys", () => {
  const layout = { background: "#fff", edition: "after-hours" as const, column_offsets: [1, 2], parent_id: 7 };
  const pair = presetsFor("pair")[0];
  const next = applyPreset(layout, pair);
  assert.equal(next.background, "#fff");
  assert.equal(next.parent_id, 7);
  assert.equal(next.edition, "after-hours");
  assert.equal("column_offsets" in next, false);
  assert.deepEqual(layout.column_offsets, [1, 2]);
  assert.ok(Object.values(next).every((v) => v !== undefined));
});

test("modified values are reported as individual (null)", () => {
  const image = presetsFor("image")[0];
  assert.equal(matchPreset({ ...applyPreset({}, image), padding: 65 }, "image"), null);
  assert.equal(matchPreset({ padding: 7 }, "image"), null);
  assert.equal(matchPreset(undefined, "pair"), "balance");
});

test("stored renderer defaults count as unset", () => {
  assert.equal(matchPreset({ gap: 18, align: "flush", column_offsets: [0, 0] }, "pair"), "balance");
  assert.equal(matchPreset({}, "chapter"), "calm");
  assert.equal(matchPreset({ text_size: 16 }, "text"), "calm");
});

test("new modules start from the first preset without undefined keys", () => {
  for (const kind of kinds) {
    const layout = initialLayoutFor(kind);
    assert.ok(Object.values(layout).every((v) => v !== undefined), kind);
    assert.equal(matchPreset(layout, kind), presetsFor(kind)[0].id, kind);
  }
  assert.equal(initialLayoutFor("image").padding, 48);
  assert.equal(initialLayoutFor("image").frame, true);
});

test("presets only use fields from the Layout model", () => {
  const allowed = new Set([
    "padding", "gap", "media_spacing", "media_spacing_top", "media_spacing_bottom",
    "font", "text_preset", "text_size", "text_width", "text_align", "text_position",
    "title_style", "show_title", "align", "offset", "column_offsets", "speed", "stagger", "frame", "wall_mode",
  ]);
  for (const kind of kinds)
    for (const preset of presetsFor(kind))
      for (const key of Object.keys(preset.values)) assert.ok(allowed.has(key), `${kind}: ${key}`);
});

test("picker groups cover all kinds except none twice", () => {
  assert.equal(pickerGroups.length, 3);
  const all = pickerGroups.flatMap((g) => g.kinds);
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual([...all].sort(), [...kinds].sort());
});

test("hero offers the title on the image and an image-only variant", () => {
  const [overlay, only] = presetsFor("hero");
  assert.equal(matchPreset({ title_style: "overlay", parallax: true }, "hero"), overlay.id);
  assert.equal(matchPreset({ title_style: "overlay", show_title: true }, "hero"), overlay.id);
  assert.equal(matchPreset({ title_style: "overlay", show_title: false }, "hero"), only.id);
  const next = applyPreset({ title_style: "overlay", show_title: false, parallax: true }, overlay);
  assert.equal("show_title" in next, false);
  assert.equal(next.parallax, true);
});

test("nextPreset cycles through the presets and starts at the first from an individual layout", () => {
  for (const kind of kinds) {
    const list = presetsFor(kind);
    let layout = applyPreset({}, list[0]);
    const seen: string[] = [list[0].id];
    for (let i = 1; i < list.length; i++) {
      const next = nextPreset(layout, kind)!;
      seen.push(next.id);
      layout = applyPreset(layout, next);
    }
    assert.deepEqual(seen, list.map((p) => p.id), kind);
    assert.equal(nextPreset(layout, kind)!.id, list[0].id, `${kind} wraps`);
  }
  assert.equal(nextPreset({ padding: 7 }, "image")!.id, presetsFor("image")[0].id);
});

test("basePreset is the preset a new module starts with", () => {
  for (const kind of kinds) {
    assert.equal(basePreset(kind)!.id, matchPreset(initialLayoutFor(kind), kind));
    assert.equal(matchPreset(applyPreset({ padding: 99, gap: 1 }, basePreset(kind)!), kind), basePreset(kind)!.id);
  }
});
