import test from "node:test";
import assert from "node:assert/strict";
import { balancedWallRows, wallBox } from "../src/storyLayout.ts";

const L = 1.5, P = 2 / 3, S = 1;
const close = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);
const widths = (row: { items: { box: number }[]; height: number }) => row.items.map((i) => i.box * row.height);

test("one photo: capped height, centred short row", () => {
  const [row] = balancedWallRows({ ratios: [P] });
  close(row.height, 0.5);
  assert.ok(row.scale < 0.5);
});

test("two photos fill the width; landscape wider than portrait", () => {
  const rows = balancedWallRows({ ratios: [L, P] });
  assert.equal(rows.length, 1);
  close(rows[0].scale, 1);
  const [wl, wp] = widths(rows[0]);
  assert.ok(wl > wp);
  close(wl + wp, 1);
});

test("three photos in four per row: centred, not taller than a full row", () => {
  const [row] = balancedWallRows({ ratios: [L, L, L], perRow: 4 });
  assert.equal(row.items.length, 3);
  close(row.height, 1 / (L * 4));
  close(row.scale, 0.75);
});

test("five photos automatic: every row shares one height, full rows fill", () => {
  const rows = balancedWallRows({ ratios: [L, P, L, L, P] });
  assert.ok(rows.length >= 2);
  rows.slice(0, -1).forEach((row) => close(row.scale, 1));
  rows.forEach((row) => assert.ok(widths(row).every((w) => w > 0)));
});

test("seven photos, three per row: incomplete last row not taller than the one above", () => {
  const rows = balancedWallRows({ ratios: [L, L, P, L, P, L, L], perRow: 3 });
  assert.deepEqual(rows.map((r) => r.items.length), [3, 3, 1]);
  const last = rows[2];
  assert.ok(last.height <= rows[1].height + 1e-12);
  assert.ok(last.scale < 1);
  assert.deepEqual(rows.flatMap((r) => r.items.map((i) => i.index)), [0, 1, 2, 3, 4, 5, 6]);
});

test("automatic rows avoid a lone last photo", () => {
  const rows = balancedWallRows({ ratios: [L, L, L, L, L, L, L] });
  assert.notEqual(rows[rows.length - 1].items.length, 1);
});

test("size weights: large is wider than normal in the same row", () => {
  const [row] = balancedWallRows({ ratios: [L, L, L], sizes: ["l", "m", "s"], perRow: 3 });
  const [big, normal, small] = widths(row);
  assert.ok(big > normal && normal > small);
  close(wallBox(L, "l"), 2.25);
});

test("phone: at most two per row", () => {
  const rows = balancedWallRows({ ratios: [L, P, L, P, L], perRow: 4, maxPerRow: 2 });
  assert.ok(rows.every((r) => r.items.length <= 2));
});
