import test from "node:test";
import assert from "node:assert/strict";
import { pickShots } from "../src/homeStoryModel.ts";

const photo = (id: number, chapter: number | null, position = id, file = `p${id}`) =>
  ({ id, chapter_id: chapter, position, title: `t${id}`, alt: `a${id}`, url: `/images/${file}-1280.webp`, srcset: `/images/${file}-640.webp 640w` }) as never;
const module_ = (id: number, position: number, layout?: unknown) => ({ id, kind: "chapter", position, title: `c${id}`, layout }) as never;
const journey = (photos: unknown[], chapters: unknown[], cover_id: number | null = 1) =>
  ({ cover_id, cover: null, photos, chapters }) as never;
const keys = (shots: { key: string }[]) => shots.map((shot) => shot.key);

test("the cover comes first, then the photos of the modules in story order", () => {
  const shots = pickShots(
    journey(
      [photo(1, null), photo(2, 10), photo(3, 11), photo(4, 10, 0)],
      [module_(11, 1), module_(10, 0)],
    ),
  );
  assert.deepEqual(keys(shots), ["1", "4", "2", "3"]);
  assert.equal(shots[0].alt, "a1");
  assert.equal(shots[0].srcSet, "/images/p1-640.webp 640w");
});

test("placements decide which photos a module shows, in their order", () => {
  const placements = [{ id: "a", photo_id: 3 }, { id: "b", photo_id: 2 }];
  const shots = pickShots(journey([photo(1, null), photo(2, 10), photo(3, 10)], [module_(10, 0, { placements })]));
  assert.deepEqual(keys(shots), ["1", "3", "2"]);
});

test("a picture used twice (copies per module) appears once", () => {
  const shots = pickShots(journey([photo(1, null, 0, "same"), photo(2, 10, 0, "same"), photo(3, 10, 1, "other")], [module_(10, 0)]));
  assert.deepEqual(keys(shots), ["1", "3"]);
});

test("more than the cap: exactly the cap, spread over the whole story, first and last included", () => {
  const photos = Array.from({ length: 20 }, (_, i) => photo(i + 1, 10, i));
  const shots = pickShots(journey(photos, [module_(10, 0)]), 8);
  assert.equal(shots.length, 8);
  assert.equal(new Set(keys(shots)).size, 8);
  assert.equal(shots[0].key, "1");
  assert.equal(shots[7].key, "20");
  const gaps = keys(shots).map(Number).map((n, i, all) => (i ? n - all[i - 1] : 0)).slice(1);
  assert.ok(gaps.every((gap) => gap >= 2 && gap <= 3), `even spacing: ${gaps}`);
});

test("fewer photos than asked: all of them, none twice", () => {
  assert.equal(pickShots(journey([photo(1, null), photo(2, null)], [])).length, 2);
  assert.deepEqual(pickShots(journey([], [])), []);
});

test("every photo the story shows, not a fixed eight; loose photos outside the modules stay off the table", () => {
  const photos = [photo(1, null), ...Array.from({ length: 14 }, (_, i) => photo(i + 2, 10, i)), photo(99, null)];
  const shots = pickShots(journey(photos, [module_(10, 0)]));
  assert.equal(shots.length, 15);
  assert.ok(!keys(shots).includes("99"));
});
