import type { Layout, Photo } from "./types";

export interface AutomaticWallSpans {
  desktop: number[];
  tablet: number[];
  mobile: number[];
}

function rowSizes(count: number, columns: number, rebalanceSingle: boolean) {
  if (count <= columns) return count ? [count] : [];

  const rows: number[] = [];
  let remaining = count;
  while (remaining > columns) {
    if (rebalanceSingle && remaining === columns + 1 && columns === 4) {
      rows.push(3, 2);
      return rows;
    }
    rows.push(columns);
    remaining -= columns;
  }
  if (remaining) rows.push(remaining);
  return rows;
}

function spansForRows(rows: number[]) {
  return rows.flatMap((size) => Array.from({ length: size }, () => 12 / size));
}

/** Equal-width CSS grid spans for the documented desktop, tablet and mobile defaults. */
export function automaticWallSpans(count: number): AutomaticWallSpans {
  return {
    desktop: spansForRows(rowSizes(count, 4, true)),
    tablet: spansForRows(rowSizes(count, 2, false)),
    mobile: spansForRows(count <= 3 ? Array(count).fill(1) : rowSizes(count, 2, false)),
  };
}

export function usesAutomaticWallComposition(layout: Layout) {
  return (
    layout.columns === undefined &&
    layout.rows === undefined &&
    layout.mobile_columns === undefined &&
    layout.column_offsets === undefined &&
    layout.align !== "staggered"
  );
}

/** Preserve the pair module's desktop default without deriving it from mobile settings. */
export function desktopWallColumns(
  layout: Layout,
  kind: string,
  photoCount: number,
) {
  return layout.columns ?? (kind === "pair" && photoCount === 2 ? 2 : undefined);
}

/** Mirrors Picture's frame ratio precedence without changing its crop or fit behavior. */
export function effectivePhotoRatio(photo: Photo) {
  const ratio = photo.edits?.ratio;
  if (ratio === "free") {
    const freeRatio = photo.edits?.free_ratio;
    return freeRatio && Number.isFinite(freeRatio) && freeRatio > 0
      ? freeRatio
      : 1.5;
  }
  if (ratio && ratio !== "original") {
    const [width, height] = ratio.split(":").map(Number);
    if (width > 0 && height > 0) return width / height;
  }
  return photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1;
}

/* ── Fotowand „Ausgewogen“ (wall_mode: "balanced") ───────────────────────────
 * Rows of one shared height; widths follow the aspect ratios, so a landscape is
 * wider than a portrait instead of smaller. Units are gap-free: 1 = the row's
 * content width. The renderer turns a row into a flex line whose width is
 *   calc(scale * (100% - gaps * gap) + gaps * gap)
 * with each item `flex: <box> 1 0; aspect-ratio: <box>` – that keeps the
 * height exactly shared within the row. */

export type WallSize = "s" | "m" | "l";
export const WALL_SIZE_WEIGHT: Record<WallSize, number> = { s: 0.7, m: 1, l: 1.5 };

export interface BalancedWallInput {
  /** Natural width / height of each photograph, in order. */
  ratios: number[];
  /** Size per photograph (unset = "m"). */
  sizes?: (WallSize | undefined)[];
  /** Photos per row; null/undefined = automatic. */
  perRow?: number | null;
  /** Upper bound for photos per row (phone: 2). */
  maxPerRow?: number;
  /** Highest row height as a fraction of the content width (keeps a lone portrait sane). */
  maxRowHeight?: number;
}

export interface BalancedWallRow {
  /** Photograph indexes with their box ratio (natural ratio × size weight, clamped). */
  items: { index: number; box: number }[];
  /** Share of the content width the row occupies (1 = fills it; < 1 = short row). */
  scale: number;
  /** Row height as a fraction of the content width. */
  height: number;
}

const BOX_MIN = 0.45;
const BOX_MAX = 2.8;
/** Automatic rows aim at this sum of box ratios (≈ two landscapes and a portrait). */
const AUTO_TARGET = 3.4;
const AUTO_TARGET_NARROW = 2;

export function wallBox(ratio: number, size: WallSize | undefined): number {
  const natural = Number.isFinite(ratio) && ratio > 0 ? ratio : 1;
  const box = natural * WALL_SIZE_WEIGHT[size ?? "m"];
  return Math.min(BOX_MAX, Math.max(BOX_MIN, box));
}

function automaticRows(boxes: number[], target: number, max: number): number[][] {
  const rows: number[][] = [];
  let row: number[] = [];
  let sum = 0;
  boxes.forEach((box, index) => {
    // Close the row when adding this photo would move the sum further from the target.
    if (row.length && (row.length >= max || Math.abs(sum + box - target) > Math.abs(sum - target))) {
      rows.push(row);
      row = [];
      sum = 0;
    }
    row.push(index);
    sum += box;
  });
  if (row.length) rows.push(row);
  // A lone last photo borrows one from the row above, or joins it if that row is short.
  if (rows.length > 1 && rows[rows.length - 1].length === 1) {
    const before = rows[rows.length - 2];
    if (before.length > 2) rows[rows.length - 1].unshift(before.pop()!);
    else if (before.length < max) before.push(rows.pop()![0]);
  }
  return rows;
}

export function balancedWallRows(input: BalancedWallInput): BalancedWallRow[] {
  const { ratios, sizes = [], maxRowHeight = 0.5 } = input;
  if (!ratios.length) return [];
  const max = Math.max(1, Math.min(6, input.maxPerRow ?? 6));
  const boxes = ratios.map((ratio, index) => wallBox(ratio, sizes[index]));
  const perRow = input.perRow ? Math.max(1, Math.min(max, Math.round(input.perRow))) : null;
  const groups = perRow
    ? Array.from({ length: Math.ceil(boxes.length / perRow) }, (_, row) =>
        boxes.slice(row * perRow, row * perRow + perRow).map((_, i) => row * perRow + i))
    : automaticRows(boxes, max <= 2 ? AUTO_TARGET_NARROW : AUTO_TARGET, max);
  const average = boxes.reduce((a, b) => a + b, 0) / boxes.length;
  const rows: BalancedWallRow[] = [];
  groups.forEach((group, rowIndex) => {
    const sum = group.reduce((total, index) => total + boxes[index], 0);
    let height = Math.min(1 / sum, maxRowHeight);
    // A row with fewer photos than chosen is as tall as a full row would be, not taller.
    if (perRow && group.length < perRow) height = Math.min(height, 1 / (average * perRow));
    // The last row never grows above the row before it.
    if (rowIndex > 0 && rowIndex === groups.length - 1) height = Math.min(height, rows[rowIndex - 1].height);
    rows.push({
      items: group.map((index) => ({ index, box: boxes[index] })),
      scale: Math.min(1, sum * height),
      height,
    });
  });
  return rows;
}
