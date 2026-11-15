// "Vorher · Nachher" on the home page: the light table and the FLIP flight of a print into its frame.
// Pure geometry, no DOM – HomeTransformation.tsx measures, this file computes.

export type Box = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

/** Fixed print layout (no randomness): which photo, how it lies on the table. Every photo lies there once, whole. */
export type PrintSpec = { shot: number; tilt: number; dx: number; dy: number };
export const PRINT_TILTS: readonly number[] = [
  -1.4, 0.8, -0.5, 1.2, -0.9, 0.4, 1.6, -1.1, 0.6, -0.3,
  1.0, -1.5, 0.2, 0.9, -0.7, 1.3, -0.4, 0.7, -1.2, 0.3,
];

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

/** One print per photo, in a fixed "unsorted" order (a stride through the story that visits every photo once). */
export function contactSheet(photos: number, tilts: readonly number[] = PRINT_TILTS): PrintSpec[] {
  if (photos <= 0) return [];
  let stride = 3;
  while (photos > 1 && gcd(stride, photos) !== 1) stride += 1;
  return Array.from({ length: photos }, (_, i) => ({
    shot: (i * stride) % photos,
    tilt: tilts[i % tilts.length],
    dx: ((i * 5) % 7) - 3,
    dy: ((i * 3) % 5) - 2,
  }));
}

/** Columns and rows of the table: two rows from five prints on, wider than tall. */
export function sheetGrid(prints: number): { cols: number; rows: number } {
  if (prints <= 0) return { cols: 1, rows: 1 };
  const rows = prints <= 4 ? 1 : prints <= 12 ? 2 : 3;
  return { cols: Math.ceil(prints / rows), rows };
}

const WORDS_EN = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];
const WORDS_DE = ["Null", "Ein", "Zwei", "Drei", "Vier", "Fünf", "Sechs", "Sieben", "Acht", "Neun", "Zehn", "Elf", "Zwölf", "Dreizehn", "Vierzehn", "Fünfzehn", "Sechzehn", "Siebzehn", "Achtzehn", "Neunzehn", "Zwanzig"];

/** The count as a capitalised word ("Eight" / "Acht"), digits from 21 on. */
export function countWord(n: number): { en: string; de: string } {
  if (Number.isInteger(n) && n >= 0 && n < WORDS_EN.length) return { en: WORDS_EN[n], de: WORDS_DE[n] };
  return { en: String(n), de: String(n) };
}

/** The whole photo as object-fit: cover lays it into `box` (it overflows on one axis); f = object-position. */
export function coverOf(box: Box, ratio: number, fx = 0.5, fy = 0.5): Box {
  const w = box.w / box.h > ratio ? box.w : box.h * ratio;
  const h = w / ratio;
  return { x: box.x + (box.w - w) * fx, y: box.y + (box.h - h) * fy, w, h };
}

/** clip-path inset (top, right, bottom, left) that cuts `photo` down to `box`, in local units of a scale k. */
export function insetOf(box: Box, photo: Box, k = 1): [number, number, number, number] {
  const v = (n: number) => Math.max(0, n / k);
  return [
    v(box.y - photo.y),
    v(photo.x + photo.w - box.x - box.w),
    v(photo.y + photo.h - box.y - box.h),
    v(box.x - photo.x),
  ];
}
export function insetCss(inset: readonly number[]): string {
  return `inset(${inset.map((n) => `${n.toFixed(2)}px`).join(" ")})`;
}

export type Flight = {
  /** Where the clone sits for good: the whole photo behind the target frame. */
  photo: Box;
  /** Start transform (translate, then tilt, then uniform scale – origin at the photo's centre). */
  tx: number;
  ty: number;
  scale: number;
  tilt: number;
  startInset: [number, number, number, number];
  endInset: [number, number, number, number];
};

/**
 * FLIP for one print: `from` is the print's unrotated box (its centre is where it lies, tilt included),
 * `to` the target frame. Both show the same photo (aspect `ratio`) with object-fit: cover, so working
 * with the whole photo keeps the scale uniform; the crop travels in the clip-path.
 */
export function planFlight(
  from: Box,
  to: Box,
  ratio: number,
  tilt: number,
  focusFrom: [number, number] = [0.5, 0.5],
  focusTo: [number, number] = [0.5, 0.5],
): Flight {
  const a = coverOf(from, ratio, ...focusFrom);
  const b = coverOf(to, ratio, ...focusTo);
  const scale = a.w / b.w;
  const angle = (tilt * Math.PI) / 180;
  // Offset of the print's centre from the photo's centre, before tilting.
  const vx = from.x + from.w / 2 - (a.x + a.w / 2);
  const vy = from.y + from.h / 2 - (a.y + a.h / 2);
  // The tilt turns around the print's centre, so the photo's centre lands here.
  const cx = from.x + from.w / 2 - (vx * Math.cos(angle) - vy * Math.sin(angle));
  const cy = from.y + from.h / 2 - (vx * Math.sin(angle) + vy * Math.cos(angle));
  return {
    photo: b,
    tx: cx - (b.x + b.w / 2),
    ty: cy - (b.y + b.h / 2),
    scale,
    tilt,
    startInset: insetOf(from, a, scale),
    endInset: insetOf(to, b, 1),
  };
}

/** Maps a point of the clone (page coordinates of its final layout) through the start transform. */
export function startPoint(flight: Flight, p: Point): Point {
  const c = { x: flight.photo.x + flight.photo.w / 2, y: flight.photo.y + flight.photo.h / 2 };
  const angle = (flight.tilt * Math.PI) / 180;
  const x = (p.x - c.x) * flight.scale;
  const y = (p.y - c.y) * flight.scale;
  return {
    x: c.x + flight.tx + x * Math.cos(angle) - y * Math.sin(angle),
    y: c.y + flight.ty + x * Math.sin(angle) + y * Math.cos(angle),
  };
}

/** For each target, the nearest unused print of the same photo; result in print order (for the stagger). */
export function pairPrints<T extends { shot: string; at: Point }>(
  prints: readonly T[],
  targets: readonly T[],
): { print: number; target: number }[] {
  const used = new Set<number>();
  const pairs: { print: number; target: number }[] = [];
  targets.forEach((target, ti) => {
    let best = -1;
    let distance = Infinity;
    prints.forEach((print, pi) => {
      if (used.has(pi) || print.shot !== target.shot) return;
      const d = Math.hypot(print.at.x - target.at.x, print.at.y - target.at.y);
      if (d < distance) {
        distance = d;
        best = pi;
      }
    });
    if (best >= 0) {
      used.add(best);
      pairs.push({ print: best, target: ti });
    }
  });
  return pairs.sort((p, q) => p.print - q.print);
}
