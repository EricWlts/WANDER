import assert from "node:assert/strict";
import test from "node:test";
import { applyStoryWords } from "../src/storyDraftApply.ts";
import type { Chapter } from "../src/types";

const titleFor = (kind: Chapter["kind"]) => ({ text: "Text", chapter: "Kapitel" } as Record<string, string>)[kind] ?? kind;
const mk = (id: number, kind: Chapter["kind"], extra: Partial<Chapter> = {}): Chapter =>
  ({ id, kind, title: kind, date: "", story: "", quote: "", position: 0, reveal: { effect: "fade", duration: 1000 }, gallery_mode: "editorial", layout: {}, ...extra }) as Chapter;

test("day words land in the chapter of that day, others stay", () => {
  const chapters = [
    mk(-1, "hero"),
    mk(-2, "chapter", { title: "Tag 1", date: "2025-08-09" }),
    mk(-3, "image", { layout: { parent_id: -2 } }),
    mk(-4, "chapter", { title: "Tag 2", date: "2025-08-10" }),
  ];
  const out = applyStoryWords(chapters, { title: "", intro: "", days: { "2025-08-09": { title: "Ankunft", text: "Regen." }, "2025-08-10": { title: "", text: "Sonne." } } }, () => -99, titleFor);
  assert.equal(out[1].title, "Ankunft");
  assert.equal(out[1].story, "Regen.");
  assert.equal(out[3].title, "Tag 2");
  assert.equal(out[3].story, "Sonne.");
  assert.equal(out[2].id, -3);
  assert.deepEqual(out.map((c) => c.position), [0, 1, 2, 3]);
});

test("the intro becomes a text module after the hero when there is no chapter", () => {
  const out = applyStoryWords([mk(-1, "hero"), mk(-2, "pair")], { title: "", intro: "Ein Satz.", days: {} }, () => -50, titleFor);
  assert.deepEqual(out.map((c) => c.kind), ["hero", "text", "pair"]);
  assert.equal(out[1].story, "Ein Satz.");
  assert.equal(out[1].id, -50);
  const bare = applyStoryWords([mk(-2, "pair")], { title: "", intro: "Hallo", days: {} }, () => -7, titleFor);
  assert.deepEqual(bare.map((c) => c.kind), ["text", "pair"]);
});

test("the intro goes into the first chapter module when one exists", () => {
  const out = applyStoryWords([mk(-2, "chapter", { title: "Kapitel" })], { title: "", intro: "Hallo", days: {} }, () => -7, titleFor);
  assert.equal(out.length, 1);
  assert.equal(out[0].story, "Hallo");
});

test("the new text module for the intro gets the usual default title, never an empty one", () => {
  // Regression: an empty title made the backend reject the whole draft ("valid title ... 160").
  for (const first of [[mk(-1, "hero"), mk(-2, "pair")], [mk(-2, "pair")]]) {
    const out = applyStoryWords(first, { title: "Sonnenuntergänge", intro: "Ein Satz.", days: {} }, () => -50, titleFor);
    const text = out.find((c) => c.kind === "text")!;
    assert.equal(text.title, "Text");
    assert.equal(text.story, "Ein Satz.");
    assert.ok(out.every((c) => c.title.trim() !== ""));
  }
});
