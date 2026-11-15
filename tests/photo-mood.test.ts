import test from "node:test";
import assert from "node:assert/strict";
import {
  arcKey,
  lightFromPixels,
  moodArc,
  movementCount,
  smallestVariant,
  splitMovements,
  type ArcItem,
  type PhotoLight,
} from "../src/photoMood.ts";
import { draftStory, type DraftPhoto } from "../src/storyDraft.ts";
import { structurePreview } from "../src/newStoryFlow.ts";

const L = (brightness: number, warmth: number, saturation = 0.3): PhotoLight => ({
  brightness,
  warmth,
  saturation,
  color: "rgb(0 0 0)",
});
const item = (id: number, light: PhotoLight | null, position = id): ArcItem => ({ id, position, light });
const ids = (list: readonly ArcItem[]) => list.map((p) => p.id);

test("arc runs from bright and cool to dark and warm", () => {
  const input = [
    item(1, L(0.15, 0.5)), // dark, warm: last light
    item(2, L(0.9, -0.4)), // bright, cool: first light
    item(3, L(0.55, 0.05)),
    item(4, L(0.75, -0.2)),
    item(5, L(0.3, 0.3)),
  ];
  assert.deepEqual(ids(moodArc(input)), [2, 4, 3, 5, 1]);
  assert.ok(arcKey(L(0.9, -0.4)) < arcKey(L(0.15, 0.5)));
});

test("similar photographs stand together, hard jumps are avoided", () => {
  // Two looks with almost the same arc key: bright-warm (A) and darker-cool (B), interleaved.
  const A = (id: number) => item(id, L(0.62 + id * 0.001, 0.5, 0.6));
  const B = (id: number) => item(id, L(0.38 + id * 0.001, -0.3, 0.1));
  const order = ids(moodArc([A(1), B(2), A(3), B(4), A(5), B(6)]));
  const group = (id: number) => (id % 2 ? "A" : "B");
  let changes = 0;
  for (let i = 1; i < order.length; i++) if (group(order[i]) !== group(order[i - 1])) changes++;
  assert.ok(changes <= 2, `too many jumps: ${order.join(",")}`);
});

test("stable: same input, any input order, same output", () => {
  const input = Array.from({ length: 30 }, (_, i) =>
    item(i + 1, L(((i * 37) % 100) / 100, (((i * 53) % 200) - 100) / 100, ((i * 11) % 100) / 100)),
  );
  const a = ids(moodArc(input));
  assert.deepEqual(ids(moodArc(input.slice().reverse())), a);
  assert.deepEqual(ids(moodArc(input)), a);
  assert.equal(new Set(a).size, 30);
});

test("one photograph, identical photographs, duplicates", () => {
  assert.deepEqual(ids(moodArc([item(7, L(0.5, 0))])), [7]);
  const same = [3, 1, 2, 4].map((id) => item(id, L(0.5, 0.1, 0.2)));
  assert.deepEqual(ids(moodArc(same)), [1, 2, 3, 4]); // upload order breaks ties
  assert.deepEqual(ids(moodArc([item(1, L(0.5, 0)), item(1, L(0.9, 0))])), [1]);
  assert.deepEqual(moodArc([]), []);
});

test("missing values: upload order without any, neighbours kept otherwise", () => {
  assert.deepEqual(ids(moodArc([item(3, null), item(1, null), item(2, null)])), [1, 2, 3]);
  const nan = { ...L(0.5, 0), brightness: Number.NaN };
  const mixed = [item(1, null), item(2, L(0.2, 0.5)), item(3, nan), item(4, L(0.9, -0.5))];
  // 1 leads (nothing measured before it); 3 follows 2, which it followed when uploaded.
  assert.deepEqual(ids(moodArc(mixed)), [1, 4, 2, 3]);
});

test("movements: two to four, at least three photographs each", () => {
  assert.equal(movementCount(1), 1);
  assert.equal(movementCount(5), 1);
  assert.equal(movementCount(6), 2);
  assert.equal(movementCount(12), 3);
  assert.equal(movementCount(80), 4);
  for (const n of [1, 5, 6, 7, 11, 12, 23, 24, 50]) {
    const arc = moodArc(Array.from({ length: n }, (_, i) => item(i + 1, L(1 - i / n, i / n - 0.5))));
    const parts = splitMovements(arc);
    assert.equal(parts.length, movementCount(n), `n=${n}`);
    assert.deepEqual(parts.flat().map((p) => p.id), ids(arc), `n=${n}`);
    if (parts.length > 1) for (const m of parts) assert.ok(m.length >= 3, `n=${n}`);
  }
  assert.deepEqual(splitMovements([]), []);
});

test("movements cut at the biggest change of light", () => {
  const arc = [
    ...[1, 2, 3, 4].map((id) => item(id, L(0.9, -0.3))),
    ...[5, 6, 7, 8].map((id) => item(id, L(0.2, 0.5))),
  ];
  assert.deepEqual(splitMovements(arc).map(ids), [[1, 2, 3, 4], [5, 6, 7, 8]]);
});

test("pixels: mean light and placeholder colour", () => {
  const white = lightFromPixels([255, 255, 255, 255, 255, 255, 255, 255])!;
  assert.ok(Math.abs(white.brightness - 1) < 1e-9);
  assert.equal(white.saturation, 0);
  assert.equal(white.color, "rgb(255 255 255)");
  const orange = lightFromPixels([240, 140, 40, 255])!;
  assert.ok(orange.warmth > 0.7 && orange.saturation > 0.8);
  const blue = lightFromPixels([40, 90, 220, 255])!;
  assert.ok(blue.warmth < -0.6);
  assert.equal(lightFromPixels([0, 0, 0, 0]), null);
  assert.equal(lightFromPixels([]), null);
});

test("smallest variant from a srcset", () => {
  assert.equal(smallestVariant({ url: "/m/1/large", srcset: "/m/1/large 2200w, /m/1/small 640w, /m/1/medium 1280w" }), "/m/1/small");
  assert.equal(smallestVariant({ url: "/m/1", srcset: "" }), "/m/1");
});

// draftStory() "by mood" with light ---------------------------------------------------------

function photo(id: number, portrait = false): DraftPhoto {
  return { id, width: portrait ? 2000 : 3000, height: portrait ? 3000 : 2000, position: id, taken_at: null };
}

test("draftStory mood follows the light arc and separates movements with a calm single", () => {
  const photos = Array.from({ length: 12 }, (_, i) => photo(i + 1, i % 3 === 1));
  // Upload order is the reverse of the arc: photograph 12 is the brightest, 1 the darkest.
  const light = Object.fromEntries(photos.map((p) => [p.id, L(p.id / 13, 0.4 - p.id / 20)]));
  const modules = draftStory(photos, "mood", { light });
  const order = modules.flatMap((m) => m.photoIds);
  assert.deepEqual(order.slice().sort((a, b) => a - b), photos.map((p) => p.id));
  assert.equal(modules[0].kind, "hero");
  assert.ok(order.indexOf(11) < order.indexOf(2), "bright before dark");
  assert.equal(modules.filter((m) => m.kind === "chapter").length, 0, "no automatic headings");
  const breaks = modules.filter((m) => m.kind === "image" && m.spacious);
  assert.ok(breaks.length >= movementCount(11) - 1);
  assert.deepEqual(draftStory(photos, "mood", { light }), modules);
});

test("draftStory mood without usable light keeps the upload order", () => {
  const photos = Array.from({ length: 8 }, (_, i) => photo(i + 1));
  const plain = draftStory(photos, "mood");
  assert.deepEqual(draftStory(photos, "mood", { light: {} }), plain);
  assert.deepEqual(draftStory(photos, "mood", { light: { 1: null, 2: null } }), plain);
  // "By days" ignores light.
  const light = Object.fromEntries(photos.map((p) => [p.id, L(p.id / 9, 0)]));
  assert.deepEqual(draftStory(photos, "days", { light }), draftStory(photos, "days"));
});

test("step 3 preview: 'by mood' uses the arc, 'as a moment' keeps the upload order", () => {
  const photos = Array.from({ length: 8 }, (_, i) => photo(i + 1));
  const light = Object.fromEntries(photos.map((p) => [p.id, L(p.id / 9, -p.id / 10)]));
  assert.deepEqual(structurePreview(photos, "moment", { light }), structurePreview(photos, "moment"));
  assert.notDeepEqual(structurePreview(photos, "mood", { light }), structurePreview(photos, "mood"));
});
