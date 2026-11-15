import test from "node:test";
import assert from "node:assert/strict";
import { applyStoryDraft, replaceableIds, restoreStoryDraft } from "../src/storyDraftApply.ts";
import { draftStory } from "../src/storyDraft.ts";
import type { Chapter, Journey, Photo } from "../src/types.ts";

function photo(id: number, over: Partial<Photo> = {}): Photo {
  return {
    id, chapter_id: null, width: 3000, height: 2000, position: id, featured: false,
    taken_at: null, title: "", description: "", alt: "", credit: "", source_url: "",
    demo: false, url: "", srcset: "", large_url: "", original_url: null, ...over,
  } as Photo;
}
function module(id: number, kind: Chapter["kind"], over: Partial<Chapter> = {}): Chapter {
  return {
    id, kind, title: kind, date: "", story: "", quote: "", position: 0,
    gallery_mode: "editorial", reveal: {}, layout: {}, ...over,
  } as Chapter;
}
function journey(chapters: Chapter[], photos: Photo[]): Journey {
  return { id: 1, chapters, photos } as unknown as Journey;
}
let counter = 0;
const deps = () => ({
  firstId: -1000,
  newPlacementId: () => `p${++counter}`,
  titleFor: (kind: string) => `T-${kind}`,
});

test("replaceableIds keeps text, quotes and chapters with text; drops generated chapters", () => {
  const j = journey([
    module(1, "chapter", { story: "My own words", title: "Lisbon" }),
    module(2, "text", { story: "Hello" }),
    module(3, "image"),
    module(4, "chapter", { title: "Tag 1", date: "2026-06-01" }),
    module(5, "pair", { layout: { parent_id: 4 } }),
    module(6, "chapter", { title: "Day 2" }),
    module(7, "text", { story: "keep me", layout: { parent_id: 6 } }),
    module(8, "quote", { quote: "q" }),
  ], []);
  assert.deepEqual([...replaceableIds(j)].sort((a, b) => a - b), [3, 4, 5]);
});

test("apply (mood) replaces image modules, keeps text, uses each photograph once", () => {
  const photos = [1, 2, 3, 4, 5, 6].map((id) => photo(id, { chapter_id: id === 1 ? 3 : null }));
  const j = journey([
    module(2, "text", { story: "Intro" }),
    module(3, "image", { layout: { photo_ids: [1] } }),
  ], photos);
  const draft = draftStory(photos, "mood");
  const result = applyStoryDraft(j, draft, deps())!;
  assert.ok(result);
  assert.equal(result.chapters[0].kind, "hero");
  assert.equal(result.chapters[1].id, 2);
  assert.deepEqual(result.removedIds, [3]);
  const used = result.chapters.flatMap((c) => (c.layout?.placements || []).map((f) => f.photo_id));
  assert.deepEqual(used.sort(), [1, 2, 3, 4, 5, 6]);
  assert.equal(new Set(result.chapters.map((c) => c.id)).size, result.chapters.length);
  assert.ok(result.createdIds.every((id) => id < 0));
  assert.equal(result.photos.find((p) => p.id === 1)!.chapter_id, null);
  assert.deepEqual(result.chapters.map((c) => c.position), result.chapters.map((_, i) => i));
  assert.equal(result.chapters.some((c) => c.kind !== "text" && c.layout?.show_title), false);
});

test("apply (days) creates chapters with children, ordered by date", () => {
  const photos = [
    photo(1, { taken_at: "2026-06-02T10:00:00" }), photo(2, { taken_at: "2026-06-01T10:00:00" }),
    photo(3, { taken_at: "2026-06-01T11:00:00" }), photo(4, { taken_at: "2026-06-02T12:00:00" }),
    photo(5, { taken_at: "2026-06-01T12:00:00" }), photo(6, { taken_at: "2026-06-02T13:00:00" }),
  ];
  const result = applyStoryDraft(journey([], photos), draftStory(photos, "days", { locale: "en" }), deps())!;
  const days = result.chapters.filter((c) => c.kind === "chapter");
  assert.deepEqual(days.map((d) => d.date), ["2026-06-01", "2026-06-02"]);
  for (const c of result.chapters) {
    const parent = c.layout?.parent_id;
    if (parent) {
      const at = result.chapters.findIndex((m) => m.id === parent);
      assert.ok(at >= 0 && at < result.chapters.indexOf(c));
      assert.equal(result.chapters[at].kind, "chapter");
    }
  }
});

test("apply (days) reuses an existing chapter with text for the same date", () => {
  const photos = [1, 2, 3].map((id) => photo(id, { taken_at: "2026-06-01T10:0" + id + ":00" }));
  const j = journey([module(10, "chapter", { story: "Arrival", date: "2026-06-01" })], photos);
  const result = applyStoryDraft(j, draftStory(photos, "days"), deps())!;
  assert.equal(result.chapters.filter((c) => c.kind === "chapter").length, 1);
  assert.equal(result.chapters.find((c) => c.id === 10)!.story, "Arrival");
  assert.ok(result.chapters.some((c) => c.layout?.parent_id === 10));
});

test("kept modules lose displayed photographs so nothing is shown twice", () => {
  const photos = [photo(1, { chapter_id: 10 }), photo(2), photo(3)];
  const j = journey([module(10, "chapter", { story: "Words" })], photos);
  const result = applyStoryDraft(j, draftStory(photos, "mood"), deps())!;
  assert.deepEqual(result.chapters.find((c) => c.id === 10)!.layout?.placements, []);
});

test("apply refuses to exceed the module limit", () => {
  const many = Array.from({ length: 400 }, (_, i) => module(i + 1, "text", { story: "x" }));
  assert.equal(applyStoryDraft(journey(many, [photo(1), photo(2)]), draftStory([photo(1), photo(2)], "mood"), deps()), null);
});

test("restore brings back the exact previous modules with fresh ids for deleted ones", () => {
  const photos = [1, 2, 3, 4].map((id) => photo(id, { chapter_id: id === 1 ? 3 : null }));
  const before = journey([
    module(2, "text", { story: "Intro" }),
    module(3, "chapter", { title: "Tag 1" }),
    module(4, "image", { layout: { parent_id: 3, photo_ids: [1] } }),
  ], photos);
  const applied = applyStoryDraft(before, draftStory(photos, "mood"), deps())!;
  const current = { ...before, chapters: applied.chapters, photos: applied.photos } as Journey;
  const restored = restoreStoryDraft(current, { chapters: before.chapters, photos: before.photos }, -5000);
  assert.deepEqual(restored.chapters.map((c) => c.kind), ["text", "chapter", "image"]);
  assert.equal(restored.chapters[0].id, 2);
  assert.ok(restored.chapters[1].id < 0 && restored.chapters[2].id < 0);
  assert.equal(restored.chapters[2].layout?.parent_id, restored.chapters[1].id);
  assert.deepEqual(restored.chapters[2].layout?.placements?.map((f) => f.photo_id), [1]);
  assert.equal(restored.photos.find((p) => p.id === 1)!.chapter_id, null);
});

test("restore keeps ids of untouched modules", () => {
  const photos = [photo(1), photo(2), photo(3)];
  const before = journey([module(2, "text", { story: "Intro" })], photos);
  const applied = applyStoryDraft(before, draftStory(photos, "mood"), deps())!;
  const current = { ...before, chapters: applied.chapters, photos: applied.photos } as Journey;
  const restored = restoreStoryDraft(current, { chapters: before.chapters, photos: before.photos }, -5000);
  assert.deepEqual(restored.chapters, [{ ...before.chapters[0], position: 0, layout: {} }]);
});

test("new photo walls start balanced; presets for walls are balanced", async () => {
  const { initialLayoutFor, presetsFor } = await import("../src/editorPresets.ts");
  assert.equal(initialLayoutFor("wall").wall_mode, "balanced");
  assert.ok(presetsFor("wall").every((p) => (p.values as { wall_mode?: string }).wall_mode === "balanced"));
  const photos = Array.from({ length: 40 }, (_, i) => photo(i + 1));
  for (const kind of ["mood", "documentary"] as const) {
    const result = applyStoryDraft(journey([], photos), draftStory(photos, kind), deps());
    for (const c of result?.chapters.filter((m) => m.kind === "wall") ?? [])
      assert.equal(c.layout?.wall_mode, "balanced");
  }
});
