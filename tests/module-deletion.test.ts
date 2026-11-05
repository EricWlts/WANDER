import test from "node:test";
import assert from "node:assert/strict";
import { removeModuleFromDraft, selectionAfterModuleRemoval } from "../src/moduleDeletion.ts";
import { mergeSavedJourney } from "../src/journalModel.ts";
import { moveModule } from "../src/moduleOrder.ts";
import type { Chapter, Journey } from "../src/types.ts";
const module = (id: number, parent_id?: number) => ({
  id, kind: parent_id ? "image" : "chapter", title: `Module ${id}`, story: `Text ${id}`,
  layout: { parent_id, placements: [{ id: `frame-${id}`, photo_id: 99 }] },
}) as Chapter;
const journey = {
  id: 1, layout: {}, chapters: [module(1), module(11, 1), module(12, 1), module(2)],
  photos: [{ id: 99, chapter_id: 11, title: "Original" }, { id: 100, chapter_id: null }],
} as Journey;
const ids = (value: Journey) => value.chapters.map((c) => c.id);

test("deleting a nonselected module preserves the active module and other photo context", () => {
  const selected = { type: "module", id: 12 } as const;
  assert.equal(selectionAfterModuleRemoval(selected, 11), selected);
  const photo = { type: "photo", id: 99, moduleId: 12 } as const;
  assert.equal(selectionAfterModuleRemoval(photo, 11), photo);
  const next = removeModuleFromDraft(journey, 11);
  assert.deepEqual(ids(next), [1, 12, 2]);
  assert.equal(next.chapters[1], journey.chapters[2]);
  assert.equal(next.photos[0].chapter_id, null);
  assert.equal(next.photos[0].title, "Original");
  assert.equal(next.photos[1], journey.photos[1]);
  assert.equal(journey.photos[0].chapter_id, 11);
});
test("deleted module and its photo context reset to the cover", () => {
  assert.deepEqual(selectionAfterModuleRemoval({ type: "module", id: 11 }, 11), { type: "hero" });
  assert.deepEqual(selectionAfterModuleRemoval({ type: "photo", id: 99, moduleId: 11 }, 11), { type: "hero" });
});
test("deleting a chapter preserves every child and its contents as root modules", () => {
  const next = removeModuleFromDraft(journey, 1);
  assert.deepEqual(ids(next), [11, 12, 2]);
  assert.equal(next.chapters[0].layout.parent_id, undefined);
  assert.equal(next.chapters[0].layout.placements, journey.chapters[1].layout.placements);
  assert.equal(next.chapters[0].story, journey.chapters[1].story);
  assert.equal(next.photos[0], journey.photos[0]);
  assert.equal(removeModuleFromDraft(journey, 404), journey);
});
test("delete after a reorder and reorder after delete preserve remaining identities", () => {
  const reordered = { ...journey, chapters: moveModule(journey.chapters, 12, 11) };
  const next = removeModuleFromDraft(reordered, 11);
  assert.deepEqual(ids(next), [1, 12, 2]);
  const moved = moveModule(next.chapters, 2, 1);
  assert.deepEqual(moved.map((c) => c.id), [2, 12, 1]);
  assert.equal(moved[1], journey.chapters[2]);
});
test("an in-flight save cannot resurrect a deletion and remaps remaining temporary IDs", () => {
  const submitted = { ...journey, chapters: [module(-1), module(-2), module(-3, -1)] };
  const local = removeModuleFromDraft(submitted, -1);
  const saved = { ...submitted, chapters: [module(101), module(102), module(103, 101)] };
  const merged = mergeSavedJourney(local, submitted, saved);
  assert.deepEqual(ids(merged), [102, 103]);
  assert.equal(merged.chapters[1].layout.parent_id, undefined);
  const reloaded = JSON.parse(JSON.stringify(merged));
  assert.deepEqual(ids(reloaded), [102, 103]);
  assert.deepEqual(reloaded.chapters[1].layout.placements, local.chapters[1].layout.placements);
});
