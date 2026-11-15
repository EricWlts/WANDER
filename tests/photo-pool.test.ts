import test from "node:test";
import assert from "node:assert/strict";
import { loadPoolGroups, mapLimited, smallestSource } from "../src/photoPool.ts";

test("smallestSource picks the narrowest candidate", () => {
  assert.equal(smallestSource("a.jpg 1280w, b.jpg 640w, c.jpg 1920w", "x"), "b.jpg");
  assert.equal(smallestSource("", "x"), "x");
});

test("mapLimited respects the concurrency limit and keeps order", async () => {
  let active = 0, peak = 0;
  const out = await mapLimited([1, 2, 3, 4, 5, 6, 7, 8, 9], 4, async (n) => {
    active++; peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 5));
    active--;
    return n * 2;
  });
  assert.ok(peak <= 4);
  assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14, 16, 18]);
});

test("loadPoolGroups groups by journey, own uploads first, skips failures", async () => {
  const photo = (id: number) => ({ id, url: `/p${id}.jpg` });
  const fetcher = async (path: string) => {
    if (path === "/journeys") return [{ slug: "a", title: "A" }, { slug: "bad", title: "B" }, { slug: "__site-hero__", title: "H" }];
    if (path === "/journeys/bad") throw new Error("x");
    return { photos: path === "/journeys/a" ? [photo(1), photo(2)] : [photo(3)] };
  };
  const groups = await loadPoolGroups(fetcher as never);
  assert.deepEqual(groups.map((g) => [g.key, g.photos.length, g.own]), [["__site-hero__", 1, true], ["a", 2, false]]);
});
