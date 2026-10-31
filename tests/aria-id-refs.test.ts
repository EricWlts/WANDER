import test from "node:test";
import assert from "node:assert/strict";
import { mergeIdRefs } from "../src/ariaIdRefs.ts";

test("generated and existing label references are combined without duplicates", () => {
  assert.equal(
    mergeIdRefs("custom-label shared", "field-label shared"),
    "custom-label shared field-label",
  );
});

test("existing descriptions survive with or without a generated hint", () => {
  assert.equal(mergeIdRefs("help error", "field-hint"), "help error field-hint");
  assert.equal(mergeIdRefs("help error", undefined), "help error");
});

test("missing references produce an empty string without undefined tokens", () => {
  assert.equal(mergeIdRefs(undefined, "field-label"), "field-label");
  assert.equal(mergeIdRefs(undefined, undefined), "");
});
