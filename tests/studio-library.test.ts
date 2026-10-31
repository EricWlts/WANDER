import test from "node:test";
import assert from "node:assert/strict";
import { shouldShowEmptyLibrary } from "../src/studioLibraryModel.ts";

test("library empty prompt appears only after a successful empty load", () => {
  assert.equal(shouldShowEmptyLibrary(true, "", 0), false);
  assert.equal(shouldShowEmptyLibrary(false, "Network error", 0), false);
  assert.equal(shouldShowEmptyLibrary(false, "", 0), true);
  assert.equal(shouldShowEmptyLibrary(false, "", 1), false);
});
