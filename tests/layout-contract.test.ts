import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LAYOUT_KEYS } from "../src/recoveryModel.ts";

// Guard: a Layout key that the editor writes but the backend or the recovery check
// does not know makes every save fail ("Choose valid layout settings."). Keep all three in sync.
const root = new URL("../", import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), "utf8");

function typeKeys(): string[] {
  const source = read("src/types.ts");
  const body = source.slice(source.indexOf("export interface Layout {"));
  const block = body.slice(0, body.indexOf("\n}\n"));
  return [...block.matchAll(/^\s{2}(\w+)\?:/gm)].map((m) => m[1]).sort();
}

function backendKeys(): string[] {
  const source = read("backend/app.py");
  const fn = source.slice(source.indexOf("def validate_layout("), source.indexOf("def validate_edits("));
  const keys = new Set<string>();
  const dictKeys = (line: string) => [...line.matchAll(/"(\w+)":/g)].forEach((m) => keys.add(m[1]));
  dictKeys(fn.match(/choices = \{.*\}/)![0]);
  dictKeys(fn.match(/ranges = \{.*\}/)![0]);
  const flags = source.match(/LAYOUT_FLAGS = \{(.*)\}/)![1];
  [...flags.matchAll(/"(\w+)"/g)].forEach((m) => keys.add(m[1]));
  const extra = fn.match(/unknown = .*?- LAYOUT_FLAGS - \{(.*)\}/)![1];
  [...extra.matchAll(/"(\w+)"/g)].forEach((m) => keys.add(m[1]));
  return [...keys].sort();
}

test("Layout keys match between types.ts and backend validate_layout", () => {
  assert.deepEqual(backendKeys(), typeKeys());
});

test("Layout keys match between types.ts and the recovery check", () => {
  assert.deepEqual([...LAYOUT_KEYS].sort(), typeKeys());
});

test("placement size is known to the backend", () => {
  assert.match(read("backend/app.py"), /\{"id", "photo_id", "edits", "size"\}/);
  assert.match(read("src/types.ts"), /size\?: "s" \| "m" \| "l";/);
});
