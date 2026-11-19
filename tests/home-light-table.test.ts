import test from "node:test";
import assert from "node:assert/strict";
import { contactSheet, countWord, flightOf, sheetGrid } from "../src/homeLightTable.ts";

const close = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("contactSheet: one print per photo, every photo exactly once, small tilts", () => {
  for (const n of [1, 2, 6, 8, 9, 12]) {
    const sheet = contactSheet(n);
    assert.equal(sheet.length, n);
    assert.equal(new Set(sheet.map((p) => p.shot)).size, n);
    assert.ok(sheet.every((p) => p.shot >= 0 && p.shot < n));
  }
  const sheet = contactSheet(8);
  assert.deepEqual(contactSheet(8), sheet);
  assert.notDeepEqual(sheet.map((p) => p.shot), [0, 1, 2, 3, 4, 5, 6, 7]);
  for (const p of sheet) {
    assert.ok(Math.abs(p.tilt) <= 2);
    assert.ok(Math.abs(p.dx) <= 3 && Math.abs(p.dy) <= 3);
  }
  assert.deepEqual(contactSheet(0), []);
});

test("sheetGrid: fewer prints, fewer columns – wider than tall", () => {
  assert.deepEqual(sheetGrid(8), { cols: 4, rows: 2 });
  assert.deepEqual(sheetGrid(12), { cols: 6, rows: 2 });
  assert.deepEqual(sheetGrid(3), { cols: 3, rows: 1 });
  assert.deepEqual(sheetGrid(0), { cols: 1, rows: 1 });
});

test("countWord: the real count, in both languages", () => {
  assert.deepEqual(countWord(8), { en: "Eight", de: "Acht" });
  assert.deepEqual(countWord(12), { en: "Twelve", de: "Zwölf" });
  assert.deepEqual(countWord(30), { en: "30", de: "30" });
});

test("flightOf: every print ends in a loose fan around the preview, smaller than it started", () => {
  const to = { x: 700, y: 400 };
  const prints = [
    { x: 100, y: 200, w: 120, h: 80 },
    { x: 500, y: 300, w: 120, h: 80 },
    { x: 900, y: 500, w: 120, h: 80 },
  ];
  const ends = prints.map((from, i) => {
    const flight = flightOf(from, to, i, prints.length, 40, 0.5);
    assert.equal(flight.scale, 0.5);
    return { x: from.x + from.w / 2 + flight.tx, y: from.y + from.h / 2 + flight.ty };
  });
  // Middle print of three: dead centre in x, neighbours one spread to either side.
  close(ends[1].x, 700);
  close(ends[0].x, 660);
  close(ends[2].x, 740);
  assert.ok(ends.every((end) => Math.abs(end.y - 400) <= 20 + 1e-9), "the wave stays small");
  assert.notEqual(ends[0].y, ends[1].y);
});

test("flightOf: a single print flies to the middle", () => {
  const flight = flightOf({ x: 0, y: 0, w: 100, h: 100 }, { x: 300, y: 200 }, 0, 1);
  close(flight.tx, 250);
  close(flight.ty, 150);
});
