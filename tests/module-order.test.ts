import test from "node:test";
import assert from "node:assert/strict";
import { moveModule } from "../src/moduleOrder.ts";
import { mergeSavedJourney } from "../src/journalModel.ts";
import type { Chapter, Journey } from "../src/types.ts";
const module = (id: number, parent_id?: number) =>
  ({
    id,
    kind: parent_id ? "image" : "chapter",
    layout: { parent_id, placements: [{ id: `frame-${id}`, photo_id: 99 }] },
  }) as Chapter;
const chapters = [
  module(1),
  module(11, 1),
  module(2),
  module(12, 1),
  module(3),
  module(21, 2),
];
const ids = (items: Chapter[]) => items.map((c) => c.id);
test("moving roots forward and backward preserves every child and placement", () => {
  const forward = moveModule(chapters, 1, 3, true);
  assert.deepEqual(ids(forward), [2, 11, 3, 12, 1, 21]);
  assert.deepEqual(ids(moveModule(forward, 1, 2)), ids(chapters));
  assert.deepEqual(new Set(forward), new Set(chapters));
  assert.equal(forward.find((c) => c.id === 11)?.layout.parent_id, 1);
  assert.deepEqual(ids(chapters), [1, 11, 2, 12, 3, 21]);
});
test("nested peers move without reparenting or crossing sibling groups", () => {
  assert.deepEqual(
    ids(moveModule(chapters, 11, 12, true)),
    [1, 12, 2, 11, 3, 21],
  );
  assert.equal(moveModule(chapters, 11, 21), chapters);
  assert.equal(moveModule(chapters, 11, 1), chapters);
  assert.equal(moveModule(chapters, 1, 1), chapters);
  assert.equal(moveModule(chapters, -1, 1), chapters);
});
test("first/last moves and unsaved module IDs retain unique object identities", () => {
  const unsaved = [module(-1), module(-2), module(-3)];
  assert.deepEqual(ids(moveModule(unsaved, -3, -1)), [-3, -1, -2]);
  assert.deepEqual(ids(moveModule(unsaved, -1, -3, true)), [-2, -3, -1]);
  assert.deepEqual(
    new Set(moveModule(unsaved, -1, -2, true)),
    new Set(unsaved),
  );
});
test("a reorder made during a save retains local order while temporary IDs are remapped", () => {
  const sent = {
    id: 1,
    layout: {},
    photos: [],
    chapters: [module(-1), module(-2), module(-3)],
  } as unknown as Journey;
  const current = { ...sent, chapters: moveModule(sent.chapters, -3, -1) };
  const saved = { ...sent, chapters: [module(101), module(102), module(103)] };
  const merged = mergeSavedJourney(current, sent, saved);
  assert.deepEqual(ids(merged.chapters), [103, 101, 102]);
  assert.equal(new Set(ids(merged.chapters)).size, 3);
});
