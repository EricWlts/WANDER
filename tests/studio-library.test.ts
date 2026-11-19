import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowEmptyLibrary } from "../src/studioLibraryModel.ts";

test("library empty prompt appears only after a successful empty load", () => {
  assert.equal(shouldShowEmptyLibrary(true, "", 0), false);
  assert.equal(shouldShowEmptyLibrary(false, "Network error", 0), false);
  assert.equal(shouldShowEmptyLibrary(false, "", 0), true);
  assert.equal(shouldShowEmptyLibrary(false, "", 1), false);
});

import { studioStatusLine, studioStoriesLine } from "../src/studioLibraryModel.ts";
test("studio title weaves the count into the second line", () => {
  assert.equal(studioStoriesLine(5).de, "Deine fünf Geschichten.");
  assert.equal(studioStoriesLine(5).en, "Your five stories.");
  assert.equal(studioStoriesLine(1).de, "Deine erste Geschichte.");
  assert.equal(studioStoriesLine(0).de, "Deine Geschichten.");
  assert.equal(studioStoriesLine(24).de, "Deine 24 Geschichten.");
});
test("status line leaves empty parts out", () => {
  assert.equal(studioStatusLine(4, 1).de, "4 veröffentlicht · 1 Entwurf");
  assert.equal(studioStatusLine(0, 2).en, "2 drafts");
});
