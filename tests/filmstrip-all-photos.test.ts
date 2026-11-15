import test from "node:test";
import assert from "node:assert/strict";
import { modulePhotos } from "../src/journalModel.ts";

const photo = (id: number, position: number) => ({ id, position, url: `/p${id}.jpg`, edits: {} });
const strip = (layout: object) => ({ id: 5, kind: "filmstrip", layout }) as never;
const journey = (photos: unknown[]) => ({ photos, chapters: [] }) as never;

test("all_photos shows the whole collection in collection order", () => {
  const j = journey([photo(3, 2), photo(1, 0), photo(2, 1)]);
  const m = strip({ all_photos: true, placements: [{ id: "x", photo_id: 2 }] });
  assert.deepEqual(modulePhotos(m, j).map((p) => p.id), [1, 2, 3]);
  assert.equal(modulePhotos(m, j)[0].placement_id, "all:1");
});

test("all_photos follows new and deleted photos", () => {
  const m = strip({ all_photos: true });
  assert.deepEqual(modulePhotos(m, journey([photo(1, 0), photo(2, 1), photo(4, 2)])).map((p) => p.id), [1, 2, 4]);
  assert.deepEqual(modulePhotos(m, journey([photo(1, 0), photo(4, 2)])).map((p) => p.id), [1, 4]);
});

test("without all_photos the own selection stays", () => {
  const j = journey([photo(1, 0), photo(2, 1), photo(3, 2)]);
  const placements = [{ id: "a", photo_id: 3 }];
  assert.deepEqual(modulePhotos(strip({ placements }), j).map((p) => p.id), [3]);
  assert.deepEqual(modulePhotos(strip({ placements, all_photos: false }), j).map((p) => p.id), [3]);
});
