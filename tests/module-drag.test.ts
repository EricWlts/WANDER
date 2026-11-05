import test from "node:test";
import assert from "node:assert/strict";
import { moduleDropTarget, moduleScrollSpeed } from "../src/moduleDrag.ts";
import { moveModule } from "../src/moduleOrder.ts";
import type { Chapter } from "../src/types.ts";

const rows = [
  { id: 1, top: 10, bottom: 90 },
  { id: 2, top: 96, bottom: 396 },
  { id: 3, top: 402, bottom: 482 },
];
const chapters = rows.map(({ id }) => ({ id, kind: "text", layout: {} })) as Chapter[];
const result = (source: number, y: number) => {
  const slot = moduleDropTarget(rows, source, y)!;
  return moveModule(chapters, source, slot.target, slot.after).map((c) => c.id);
};

test("variable-height peers switch at the full row midpoint and commit the indicated slot", () => {
  assert.deepEqual(moduleDropTarget(rows, 1, 245), { id: 1, target: 2, after: false });
  assert.deepEqual(result(1, 245), [1, 2, 3]);
  assert.deepEqual(moduleDropTarget(rows, 1, 246), { id: 1, target: 3, after: false });
  assert.deepEqual(result(1, 246), [2, 1, 3]);
  assert.deepEqual(result(1, 500), [2, 3, 1]);
  assert.deepEqual(result(3, 0), [3, 1, 2]);
});

test("chapter insertion uses the complete nested block rather than its heading height", () => {
  const groups = [
    { id: 10, top: 0, bottom: 80 },
    { id: 20, top: 86, bottom: 986 }, // heading + its nested rows
    { id: 30, top: 992, bottom: 1072 },
  ];
  assert.deepEqual(moduleDropTarget(groups, 10, 200), { id: 10, target: 20, after: false });
  assert.deepEqual(moduleDropTarget(groups, 10, 700), { id: 10, target: 30, after: false });
});

test("the source cannot collide with itself and empty/single groups offer no slot", () => {
  assert.equal(moduleDropTarget([], 1, 0), null);
  assert.equal(moduleDropTarget([rows[0]], 1, 50), null);
  for (const y of [10, 50, 89]) assert.notEqual(moduleDropTarget(rows, 1, y)?.target, 1);
});

test("scroll offsets change geometry without changing the slot at the same content position", () => {
  const before = moduleDropTarget(rows, 1, 300);
  const shifted = rows.map((row) => ({ ...row, top: row.top - 140, bottom: row.bottom - 140 }));
  assert.deepEqual(moduleDropTarget(shifted, 1, 160), before);
});

test("edge scrolling is gradual, bounded and neutral in the center or an empty viewport", () => {
  assert.equal(moduleScrollSpeed(0, 0, 600), -240);
  assert.equal(moduleScrollSpeed(24, 0, 600), -120);
  assert.equal(moduleScrollSpeed(48, 0, 600), 0);
  assert.equal(moduleScrollSpeed(300, 0, 600), 0);
  assert.equal(moduleScrollSpeed(576, 0, 600), 120);
  assert.equal(moduleScrollSpeed(600, 0, 600), 240);
  assert.equal(moduleScrollSpeed(900, 0, 600), 240);
  assert.equal(moduleScrollSpeed(-100, 0, 600), -240);
  assert.equal(moduleScrollSpeed(0, 0, 0), 0);
  assert.equal(moduleScrollSpeed(10, 0, 40), 0);
});

test("pointer transfers use child before/after slots and explicit chapter heading slots", async () => {
  const { moduleTransferTarget } = await import("../src/moduleDrag.ts");
  const groups = [
    { id: 10, top: 0, bottom: 60, chapter: true },
    { id: 11, top: 65, bottom: 125, chapter: false },
    { id: 20, top: 130, bottom: 190, chapter: true },
  ];
  assert.deepEqual(moduleTransferTarget(groups, 11, 150), { id: 11, target: 20, after: true, inside: true });
  assert.deepEqual(moduleTransferTarget(groups, 99, 70), { id: 99, target: 11, after: false, inside: false });
  assert.equal(moduleTransferTarget([], 99, 70), null);
});

test("cross-chapter transfers preserve content and allow empty chapters and return to root", () => {
  const group = (id: number, kind: string, parent_id?: number) => ({
    id, kind, title: `Title ${id}`, story: "kept", layout: { parent_id, placements: [{ id: `f-${id}`, photo_id: 99 }] },
  }) as Chapter;
  const initial = [group(1, "chapter"), group(11, "image", 1), group(12, "text", 1), group(2, "chapter"), group(3, "text")];
  const into = moveModule(initial, 11, 2, true, "inside");
  assert.equal(into.find((c) => c.id === 11)?.layout.parent_id, 2);
  assert.equal(into.find((c) => c.id === 11)?.layout.placements, initial[1].layout.placements);
  assert.equal(into.find((c) => c.id === 11)?.story, "kept");
  const across = moveModule(into, 12, 11, false, "transfer");
  assert.equal(across.find((c) => c.id === 12)?.layout.parent_id, 2);
  assert.ok(across.findIndex((c) => c.id === 12) < across.findIndex((c) => c.id === 11));
  const root = moveModule(across, 11, 3, true, "transfer");
  assert.equal(root.find((c) => c.id === 11)?.layout.parent_id, undefined);
  assert.deepEqual(new Set(root.map((c) => c.id)), new Set(initial.map((c) => c.id)));
  assert.equal(moveModule(initial, 1, 2, true, "inside"), initial);
  assert.equal(moveModule(initial, 1, 11, true, "transfer"), initial);
});

test("inside marker inserts before the first visible child even after root reorder", () => {
  const initial = [
    { id: 11, kind: "image", layout: { parent_id: 1 } },
    { id: 2, kind: "chapter", layout: {} },
    { id: 1, kind: "chapter", layout: {} },
    { id: 21, kind: "image", layout: { parent_id: 2 } },
  ] as Chapter[];
  const next = moveModule(initial, 21, 1, true, "inside");
  assert.deepEqual(next.filter((c) => c.layout.parent_id === 1).map((c) => c.id), [21, 11]);
});
