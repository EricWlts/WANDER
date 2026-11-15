import test from "node:test";
import assert from "node:assert/strict";
import {
  modulePhotos,
  placementsFor,
  sequenceIndex,
  mergeSavedJourney,
  offsetsFor,
  surfaceColors,
  rootPhotos,
  replaceSourceReferences,
} from "../src/journalModel.ts";
import { centerRevealOpacity, maxRevealDistance, revealDistance } from "../src/revealMath.ts";
import type { Journey, Chapter } from "../src/types.ts";
const journey = {
  id: 1,
  chapters: [],
  photos: [
    { id: 11, chapter_id: 1, edits: {} },
    { id: 22, chapter_id: 1, edits: {} },
    { id: 33, chapter_id: 1, edits: {} },
  ],
} as unknown as Journey;
const wall = {
  id: 1,
  kind: "wall",
  layout: {
    placements: [
      { id: "one", photo_id: 11 },
      { id: "two", photo_id: 22 },
      { id: "three", photo_id: 33 },
      { id: "repeat", photo_id: 11, edits: { x: 80 } },
    ],
  },
} as Chapter;
test("a third photograph and a repeated occurrence open at their actual sequence position", () => {
  const photos = modulePhotos(wall, journey);
  assert.equal(sequenceIndex(photos, photos[2]), 2);
  assert.equal(sequenceIndex(photos, photos[3]), 3);
  assert.equal(photos[3].id, photos[0].id);
  assert.equal(photos[3].edits?.x, 80);
  assert.equal(photos[0].edits?.x, undefined);
  const reordered = [photos[3], photos[2], photos[0]];
  assert.equal(sequenceIndex(reordered, photos[2]), 1);
});
test("legacy image assignments receive stable keys without mutating stored data", () => {
  const old = {
    id: 1,
    kind: "wall",
    layout: { photo_ids: [33, 11] },
  } as Chapter;
  assert.deepEqual(placementsFor(old, journey), placementsFor(old, journey));
  assert.deepEqual(old.layout, { photo_ids: [33, 11] });
  assert.equal(modulePhotos(old, journey)[0].id, 33);
});
test("explicitly empty placements suppress legacy image assignments without mutation", () => {
  const old = {
    ...journey,
    photos: [...journey.photos],
  } as Journey;
  const module = {
    id: 1,
    kind: "wall",
    layout: { photo_ids: [11, 22], placements: [] },
  } as Chapter;
  const before = structuredClone({ old, module });

  assert.deepEqual(placementsFor(module, old), []);
  assert.deepEqual(modulePhotos(module, old), []);
  assert.deepEqual({ old, module }, before);
});
test("module placements skip missing photo sources without mutating inputs", () => {
  const record = { ...journey, photos: [...journey.photos] } as Journey;
  const module = {
    ...wall,
    layout: {
      placements: [
        { id: "missing", photo_id: 404 },
        { id: "present", photo_id: 22 },
      ],
    },
  } as Chapter;
  const before = structuredClone({ record, module });

  assert.deepEqual(
    modulePhotos(module, record).map(({ id, placement_id }) => ({
      id,
      placement_id,
    })),
    [{ id: 22, placement_id: "present" }],
  );
  assert.deepEqual({ record, module }, before);
});
test("placement edits override module edits, which override source edits", () => {
  const source = {
    ...journey.photos[0],
    edits: { ratio: "4:3", x: 10, zoom: 1.1 },
  };
  const record = { ...journey, photos: [source] } as Journey;
  const module = {
    id: 1,
    kind: "image",
    layout: {
      photo_edits: { [source.id]: { x: 20, y: 30, zoom: 1.2 } },
      placements: [
        {
          id: "edited",
          photo_id: source.id,
          edits: { x: 40, fit: "contain" },
        },
      ],
    },
  } as Chapter;
  const before = structuredClone({ record, module });

  assert.deepEqual(modulePhotos(module, record)[0].edits, {
    ratio: "4:3",
    x: 40,
    y: 30,
    zoom: 1.2,
    fit: "contain",
  });
  assert.deepEqual({ record, module }, before);
});
test("explicitly empty filmstrip placements suppress legacy filmstrip IDs", () => {
  const record = {
    ...journey,
    filmstrip_ids: [11, 22],
    photos: [...journey.photos],
    layout: { filmstrip_placements: [] },
  } as Journey;
  const before = structuredClone(record);

  assert.deepEqual(rootPhotos(record, "filmstrip"), []);
  assert.deepEqual(record, before);
});
test("edits made during a save survive its response, including new module ID remapping", () => {
  const pending = {
    ...journey,
    title: "Sent title",
    composition_version: 5,
    chapters: [
      { ...wall, id: -1 },
      { id: -2, kind: "text", story: "Sent", layout: { parent_id: -1 } },
    ],
  } as Journey;
  const current = {
    ...pending,
    title: "Typed while saving",
    chapters: [
      pending.chapters[0],
      { ...pending.chapters[1], story: "More words" },
      {
        id: -3,
        kind: "quote",
        quote: "Created during save",
        layout: { parent_id: -1 },
      },
    ],
  } as Journey;
  const saved = {
    ...pending,
    chapters: [
      { ...pending.chapters[0], id: 7 },
      { ...pending.chapters[1], id: 8 },
    ],
    has_unpublished_changes: true,
    composition_version: 6,
  };
  const before = structuredClone({ current, pending, saved });
  const merged = mergeSavedJourney(current, pending, saved);
  assert.equal(merged.title, "Typed while saving");
  assert.equal(merged.composition_version, 6);
  assert.equal(merged.chapters[1].story, "More words");
  assert.equal(merged.chapters[1].layout?.parent_id, 7);
  assert.equal(merged.chapters[2].id, -3);
  assert.equal(merged.chapters[2].layout?.parent_id, 7);
  assert.equal(merged.has_unpublished_changes, true);
  assert.deepEqual({ current, pending, saved }, before);
});
test("a module deleted while saving remains deleted", () => {
  const pending = {
    ...journey,
    chapters: [
      { id: 1, kind: "text", story: "First" },
      { id: 2, kind: "quote", quote: "Deleted during save" },
      { id: 3, kind: "text", story: "Last" },
    ],
  } as Journey;
  const current = { ...pending, chapters: [pending.chapters[0], pending.chapters[2]] };
  const saved = {
    ...pending,
    chapters: pending.chapters.map((chapter, index) => ({
      ...chapter,
      id: index + 11,
    })),
    has_unpublished_changes: true,
  };
  const before = structuredClone({ current, pending, saved });

  const merged = mergeSavedJourney(current, pending, saved);

  assert.deepEqual(merged.chapters.map(({ id }) => id), [11, 13]);
  assert.deepEqual({ current, pending, saved }, before);
});
test("local module order survives while IDs and parent references follow submitted save order", () => {
  const pending = {
    ...journey,
    chapters: [
      { id: -1, kind: "day", title: "Parent", layout: {} },
      { id: -2, kind: "text", story: "Child", layout: { parent_id: -1 } },
      { id: 5, kind: "quote", quote: "Standalone", layout: {} },
    ],
  } as Journey;
  const current = {
    ...pending,
    chapters: [pending.chapters[2], pending.chapters[1], pending.chapters[0]],
  };
  const saved = {
    ...pending,
    chapters: [
      { ...pending.chapters[0], id: 70 },
      { ...pending.chapters[1], id: 80 },
      { ...pending.chapters[2], id: 50 },
    ],
    has_unpublished_changes: false,
  };
  const before = structuredClone({ current, pending, saved });

  const merged = mergeSavedJourney(current, pending, saved);

  assert.deepEqual(merged.chapters.map(({ id }) => id), [50, 80, 70]);
  assert.equal(merged.chapters[1].layout?.parent_id, 70);
  assert.equal(merged.has_unpublished_changes, false);
  assert.deepEqual({ current, pending, saved }, before);
});
test("continuous reveal is edge based, symmetric and never hides a block that covers the zone", () => {
  assert.equal(centerRevealOpacity(350, 450, 0, 800), 1);
  assert.equal(centerRevealOpacity(860, 960, 0, 800), 0);
  assert.equal(centerRevealOpacity(-140, -60, 0, 800), 0);
  const below = centerRevealOpacity(720, 820, 0, 800),
    above = centerRevealOpacity(-20, 80, 0, 800);
  assert.equal(below, above);
  assert.ok(below > 0 && below < 1);
  assert.ok(centerRevealOpacity(600, 700, 0, 800) > below);
  // Starts before the element's top edge is on screen, and is complete early.
  assert.ok(centerRevealOpacity(810, 910, 0, 800) > 0);
  assert.equal(centerRevealOpacity(680, 780, 0, 800), 1);
  // A tall block spanning the viewport stays fully visible at every offset.
  for (const top of [-900, -500, -100, 0, 300])
    assert.equal(centerRevealOpacity(top, top + 1600, 0, 800), 1);
});
test("reveal travel is capped to a quiet settle", () => {
  assert.equal(revealDistance(30), maxRevealDistance);
  assert.equal(revealDistance(12), 12);
  assert.equal(revealDistance(-5), 0);
  assert.equal(revealDistance(Number.NaN), 0);
});
test("signed offsets and automatic contrast support light and dark editorial surfaces", () => {
  assert.deepEqual(
    offsetsFor({ columns: 3, align: "staggered", offset: -80 }, 3),
    [0, 80, 0],
  );
  assert.deepEqual(
    offsetsFor({ column_offsets: [-100, 0, 100] }, 3),
    [-100, 0, 100],
  );
  assert.equal(surfaceColors("#ECEDEB").ink, "#26302B");
  assert.equal(surfaceColors("#20241F").ink, "#F2F3EF");
});

test("root sequences keep independent occurrence IDs and replacing source references does not duplicate files", () => {
  const record = {
    ...journey,
    cover_id: 11,
    cover: journey.photos[0],
    filmstrip_ids: [11, 22, 11],
    chapters: [wall],
    photos: [...journey.photos, { id: 44, chapter_id: null, edits: {} }],
    layout: {
      placements: [{ id: "loose-copy", photo_id: 11, edits: { zoom: 1.3 } }],
    },
  } as Journey;
  const loose = rootPhotos(record, "loose");
  assert.equal(loose[0].placement_id, "loose-copy");
  assert.equal(loose[0].edits?.zoom, 1.3);
  const film = rootPhotos(record, "filmstrip");
  assert.equal(sequenceIndex(film, film[2]), 2);
  const changed = replaceSourceReferences(record, 11, 22);
  assert.equal(changed.photos, record.photos);
  assert.equal(changed.cover_id, 22);
  assert.equal(modulePhotos(changed.chapters[0], changed)[0].id, 22);
  assert.equal(rootPhotos(changed, "loose")[0].id, 22);
  assert.equal(rootPhotos(changed, "filmstrip")[2].id, 22);
  assert.equal(modulePhotos(record.chapters[0], record)[0].id, 11);
});
