import test from "node:test";
import assert from "node:assert/strict";
import {
  canAutosave,
  canRetry,
  chapterIdMap,
  cleanChapter,
  compositionPayload,
  idReassigned,
  mappedId,
  reassignedFocusId,
  reconcileWithServer,
  remapSelection,
  type SaveFlags,
} from "../src/editor/compositionModel.ts";
import type { Chapter, Journey, Photo } from "../src/types.ts";

const chapter = (id: number, extra: Partial<Chapter> = {}) =>
  ({ id, kind: "text", title: `T${id}`, layout: {}, ...extra }) as Chapter;
const photo = (id: number) => ({ id, title: `P${id}`, featured: false }) as Photo;
const journey = (extra: Partial<Journey> = {}) =>
  ({
    id: 1,
    slug: "test",
    title: "Test",
    subtitle: "",
    location: "",
    country: "",
    start_date: "",
    end_date: "",
    introduction: "",
    reflection: "",
    closing: "",
    description: "",
    cover_id: null,
    cover: null,
    layout: {},
    story_template: "quiet-atlas",
    reveal_settings: {},
    composition_version: 4,
    chapters: [],
    photos: [],
    ...extra,
  }) as unknown as Journey;

test("chapterIdMap pairs sent and saved chapters by index", () => {
  const map = chapterIdMap([chapter(-5), chapter(7), chapter(-9)], [chapter(21), chapter(7), chapter(22)]);
  assert.deepEqual([...map], [[-5, 21], [7, 7], [-9, 22]]);
});

test("chapterIdMap keeps the old ID when the server returned fewer chapters", () => {
  const map = chapterIdMap([chapter(-5), chapter(7)], [chapter(21)]);
  assert.equal(map.get(7), 7);
  assert.equal(map.get(-5), 21);
});

test("mappedId falls back to the given ID", () => {
  const map = new Map([[-5, 21]]);
  assert.equal(mappedId(-5, map), 21);
  assert.equal(mappedId(8, map), 8);
});

test("remapSelection follows a new module ID", () => {
  const map = new Map([[-5, 21]]);
  assert.deepEqual(remapSelection({ type: "module", id: -5 }, map), { type: "module", id: 21 });
});

test("remapSelection keeps the same object when nothing changes", () => {
  const map = new Map([[7, 7], [-5, 21]]);
  const selected = { type: "module", id: 7 } as const;
  assert.equal(remapSelection(selected, map), selected);
  const unknown = { type: "module", id: 99 } as const;
  assert.equal(remapSelection(unknown, map), unknown);
  const hero = { type: "hero" } as const;
  assert.equal(remapSelection(hero, map), hero);
  const intro = { type: "intro" } as const;
  assert.equal(remapSelection(intro, map), intro);
});

test("remapSelection follows the module of a selected photo", () => {
  const map = new Map([[-5, 21]]);
  assert.deepEqual(
    remapSelection({ type: "photo", id: 3, moduleId: -5, placementId: "p" }, map),
    { type: "photo", id: 3, moduleId: 21, placementId: "p" },
  );
});

test("remapSelection leaves photos outside a module or with an unmapped module alone", () => {
  const map = new Map([[-5, 21]]);
  const loose = { type: "photo", id: 3, context: "loose" } as const;
  assert.equal(remapSelection(loose, map), loose);
  const other = { type: "photo", id: 3, moduleId: 8 } as const;
  assert.equal(remapSelection(other, map), other);
});

test("idReassigned is true for changed and for unknown IDs", () => {
  const map = new Map([[-5, 21], [7, 7]]);
  assert.equal(idReassigned(-5, map), true);
  assert.equal(idReassigned(7, map), false);
  assert.equal(idReassigned(99, map), true);
});

test("reassignedFocusId returns the new ID only when focus must move", () => {
  const map = new Map([[-5, 21], [7, 7]]);
  assert.equal(reassignedFocusId(-5, map), 21);
  assert.equal(reassignedFocusId(7, map), null);
  assert.equal(reassignedFocusId(99, map), null);
  assert.equal(reassignedFocusId(null, map), null);
});

test("cleanChapter fills missing text fields and drops client-only fields", () => {
  const cleaned = cleanChapter(
    chapter(3, { date: undefined, story: undefined, quote: undefined, position: 9 } as Partial<Chapter>),
  );
  assert.deepEqual(cleaned, {
    id: 3,
    title: "T3",
    date: "",
    story: "",
    quote: "",
    kind: "text",
    reveal: {},
    gallery_mode: "editorial",
    layout: {},
  });
});

test("compositionPayload sends version, slug, order and the publish flag", () => {
  const draft = journey({
    chapters: [chapter(-5), chapter(7)],
    photos: [photo(2), photo(1)],
  });
  const body = compositionPayload(draft, true);
  assert.equal(body.base_version, 4);
  assert.equal(body.base_slug, "test");
  assert.equal(body.publish, true);
  assert.deepEqual(body.photo_order, [2, 1]);
  assert.deepEqual(body.chapters.map((c) => c.id), [-5, 7]);
  assert.deepEqual(body.photos[0], {
    id: 2,
    edits: {},
    title: "P2",
    description: undefined,
    alt: undefined,
    featured: false,
  });
  assert.equal(compositionPayload(draft, false).publish, false);
});

test("compositionPayload defaults cover_focus and layout", () => {
  const draft = journey({ layout: undefined, cover_focus: undefined } as Partial<Journey>);
  const body = compositionPayload(draft, false);
  assert.equal(body.journey.cover_focus, null);
  assert.deepEqual(body.journey.layout, {});
});

test("reconcileWithServer lets the server decide which photos exist", () => {
  const mine = journey({
    photos: [photo(1), photo(2)],
    cover_id: 2,
    cover: photo(2),
    composition_version: 4,
    slug: "old",
  });
  const server = journey({
    photos: [photo(1), photo(3)],
    composition_version: 9,
    slug: "new",
  });
  const merged = reconcileWithServer(mine, server);
  assert.deepEqual(merged.photos.map((p) => p.id), [1, 3]);
  assert.equal(merged.photo_count, 2);
  assert.equal(merged.cover_id, null);
  assert.equal(merged.cover, null);
  assert.equal(merged.composition_version, 9);
  assert.equal(merged.slug, "new");
});

test("reconcileWithServer keeps a cover that still exists and the draft's own edits", () => {
  const edited = { ...photo(1), title: "Mine" };
  const mine = journey({ photos: [edited], cover_id: 1, cover: edited, title: "Draft title" });
  const server = journey({ photos: [photo(1)] });
  const merged = reconcileWithServer(mine, server);
  assert.equal(merged.cover_id, 1);
  assert.equal(merged.photos[0].title, "Mine");
  assert.equal(merged.title, "Draft title");
});

const idle: SaveFlags = {
  dirty: true,
  busy: false,
  backgroundSaving: false,
  uploadBusy: false,
  autoError: false,
  conflicted: false,
};

test("canAutosave needs changes and an otherwise idle editor", () => {
  assert.equal(canAutosave(idle), true);
  assert.equal(canAutosave({ ...idle, dirty: false }), false);
  for (const key of ["busy", "backgroundSaving", "uploadBusy", "autoError", "conflicted"] as const)
    assert.equal(canAutosave({ ...idle, [key]: true }), false, key);
});

test("canRetry needs a failed autosave, changes and an otherwise idle editor", () => {
  const failed = { ...idle, autoError: true };
  assert.equal(canRetry(failed), true);
  assert.equal(canRetry(idle), false);
  assert.equal(canRetry({ ...failed, dirty: false }), false);
  for (const key of ["busy", "backgroundSaving", "uploadBusy", "conflicted"] as const)
    assert.equal(canRetry({ ...failed, [key]: true }), false, key);
});
