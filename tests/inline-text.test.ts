import test from "node:test";
import assert from "node:assert/strict";
import { cleanEditedText } from "../src/inlineTextModel.ts";

test("multiline text keeps inner line breaks, drops the trailing one and outer spaces", () => {
  assert.equal(cleanEditedText("  Erste Zeile\nZweite Zeile\n\n", true), "Erste Zeile\nZweite Zeile");
});
test("single line text turns line breaks into spaces and non-breaking spaces into spaces", () => {
  assert.equal(cleanEditedText("Zwischen Schnee\n und Stille\n", false), "Zwischen Schnee und Stille");
});
