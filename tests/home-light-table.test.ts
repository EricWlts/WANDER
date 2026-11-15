import test from "node:test";
import assert from "node:assert/strict";
import { contactSheet, countWord, coverOf, sheetGrid, insetOf, pairPrints, planFlight, startPoint } from "../src/homeLightTable.ts";

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

test("coverOf: fills the box and overflows on one axis, following object-position", () => {
  const box = { x: 10, y: 20, w: 100, h: 100 };
  const centred = coverOf(box, 1.5);
  assert.deepEqual([centred.w, centred.h], [150, 100]);
  close(centred.x, -15);
  close(coverOf(box, 1.5, 0, 0.5).x, 10);
  close(coverOf(box, 1.5, 1, 0.5).x, -40);
  const wide = coverOf({ x: 0, y: 0, w: 300, h: 100 }, 1.5);
  assert.deepEqual([wide.w, wide.h, wide.y], [300, 200, -50]);
});

test("insetOf: crop back to the box, scaled into local units, never negative", () => {
  const box = { x: 10, y: 20, w: 100, h: 100 };
  const photo = coverOf(box, 1.5);
  assert.deepEqual(insetOf(box, photo), [0, 25, 0, 25]);
  assert.deepEqual(insetOf(box, photo, 2), [0, 12.5, 0, 12.5]);
  assert.deepEqual(insetOf(box, { x: 11, y: 20, w: 98, h: 100 }), [0, 0, 0, 0]);
});

test("planFlight: at the start the visible crop sits exactly on the print", () => {
  const from = { x: 100, y: 400, w: 100, h: 100 };
  const to = { x: 600, y: 100, w: 300, h: 400 };
  const flight = planFlight(from, to, 1.5, 0, [0.18, 0.5]);
  const [top, right, bottom, left] = flight.startInset;
  const p = flight.photo;
  // Corners of the start clip window (local), mapped through the start transform.
  const tl = startPoint(flight, { x: p.x + left, y: p.y + top });
  const br = startPoint(flight, { x: p.x + p.w - right, y: p.y + p.h - bottom });
  close(tl.x, from.x, 1e-6);
  close(tl.y, from.y, 1e-6);
  close(br.x, from.x + from.w, 1e-6);
  close(br.y, from.y + from.h, 1e-6);
  // At the end the clip is the frame itself.
  assert.deepEqual(flight.endInset.map((n) => Math.round(n * 1000) / 1000), insetOf(to, coverOf(to, 1.5)).map((n) => Math.round(n * 1000) / 1000));
});

test("planFlight: with a tilt the print's centre stays put", () => {
  const from = { x: 50, y: 60, w: 80, h: 80 };
  const flight = planFlight(from, { x: 400, y: 300, w: 240, h: 160 }, 1.5, 1.4, [0.82, 0.5]);
  const [top, right, bottom, left] = flight.startInset;
  const p = flight.photo;
  const centre = startPoint(flight, {
    x: p.x + left + (p.w - left - right) / 2,
    y: p.y + top + (p.h - top - bottom) / 2,
  });
  close(centre.x, 90, 1e-6);
  close(centre.y, 100, 1e-6);
  close(flight.scale * (p.w - left - right), 80, 1e-6);
});

test("pairPrints: nearest print of the same photo, each print once, in print order", () => {
  const prints = [
    { shot: "a", at: { x: 0, y: 0 } },
    { shot: "b", at: { x: 10, y: 0 } },
    { shot: "a", at: { x: 100, y: 0 } },
    { shot: "c", at: { x: 0, y: 50 } },
  ];
  const targets = [
    { shot: "a", at: { x: 90, y: 0 } },
    { shot: "a", at: { x: 95, y: 0 } },
    { shot: "b", at: { x: 0, y: 0 } },
    { shot: "z", at: { x: 0, y: 0 } },
  ];
  assert.deepEqual(pairPrints(prints, targets), [
    { print: 0, target: 1 },
    { print: 1, target: 2 },
    { print: 2, target: 0 },
  ]);
});
