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
import { centerRevealOpacity } from "../src/revealMath.ts";
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
test("edits made during a save survive its response, including new module ID remapping", () => {
  const pending = {
    ...journey,
    title: "Sent title",
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
  };
  const merged = mergeSavedJourney(current, pending, saved);
  assert.equal(merged.title, "Typed while saving");
  assert.equal(merged.chapters[1].story, "More words");
  assert.equal(merged.chapters[1].layout?.parent_id, 7);
  assert.equal(merged.chapters[2].id, -3);
  assert.equal(merged.chapters[2].layout?.parent_id, 7);
});
test("continuous reveal fades symmetrically on both sides of the central reading area", () => {
  assert.equal(centerRevealOpacity(350, 450, 0, 800), 1);
  assert.equal(centerRevealOpacity(760, 860, 0, 800), 0);
  assert.equal(centerRevealOpacity(-60, 40, 0, 800), 0);
  const below = centerRevealOpacity(600, 700, 0, 800),
    above = centerRevealOpacity(100, 200, 0, 800);
  assert.equal(below, above);
  assert.ok(below > 0 && below < 1);
  assert.ok(centerRevealOpacity(500, 600, 0, 800) > below);
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
