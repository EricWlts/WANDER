#!/usr/bin/env node
// Liest test-results/axe/<slug>-<breite>.json (vom Sicherheitsnetz geschrieben)
// und gibt eine Tabelle mit einer Zeile je axe-Verstoß aus.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const dir = path.join(process.cwd(), "test-results", "axe");
if (!existsSync(dir)) {
  console.log(`Keine Ergebnisse in ${dir}. Zuerst "npm run e2e" ausführen.`);
  process.exit(0);
}

const IMPACT_ORDER = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const rows = new Map(); // id -> { id, impact, pages, widths, nodes }
let resultFiles = 0;

for (const file of readdirSync(dir).filter((f) => f.endsWith(".json")).sort()) {
  const match = /^(.+)-(\d+)\.json$/.exec(file);
  if (!match) continue;
  const [, slug, width] = match;
  resultFiles += 1;
  const violations = JSON.parse(readFileSync(path.join(dir, file), "utf8"));
  for (const v of violations) {
    const row = rows.get(v.id) ?? {
      id: v.id,
      impact: v.impact ?? "unbekannt",
      pages: new Set(),
      widths: new Set(),
      nodes: 0,
    };
    row.pages.add(slug);
    row.widths.add(Number(width));
    row.nodes += v.nodes;
    rows.set(v.id, row);
  }
}

if (rows.size === 0) {
  console.log(`axe: keine Verstöße in ${resultFiles} Ergebnisdateien.`);
  process.exit(0);
}

const sorted = [...rows.values()].sort(
  (a, b) => (IMPACT_ORDER[a.impact] ?? 9) - (IMPACT_ORDER[b.impact] ?? 9) || b.nodes - a.nodes,
);

const header = ["Verstoß", "Schwere", "Seiten", "Breiten", "Knoten"];
const body = sorted.map((r) => [
  r.id,
  r.impact,
  [...r.pages].sort().join(", "),
  [...r.widths].sort((a, b) => a - b).join(", "),
  String(r.nodes),
]);
const cols = header.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
const fmt = (cells) => cells.map((c, i) => c.padEnd(cols[i])).join("  ");

console.log(fmt(header));
console.log(cols.map((w) => "-".repeat(w)).join("  "));
for (const row of body) console.log(fmt(row));

const totalNodes = sorted.reduce((sum, r) => sum + r.nodes, 0);
console.log(`\n${sorted.length} Verstoß-Arten in ${resultFiles} Ergebnisdateien, ${totalNodes} Knoten gesamt.`);
