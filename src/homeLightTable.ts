// "Vorher · Nachher" on the home page: the light table and the flight of its prints towards the story preview.
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

export type Flight = { tx: number; ty: number; scale: number };

/**
 * Flight of one print: `from` is its layout box, `to` the middle of the story preview. The prints do not pile up on
 * one spot; they settle in a loose fan (`spread` px between neighbours, a gentle wave in height) and shrink.
 */
export function flightOf(from: Box, to: Point, index: number, count: number, spread = 36, scale = 0.46): Flight {
  const centre = (count - 1) / 2;
  const offset = index - centre;
  return {
    tx: to.x + offset * spread - (from.x + from.w / 2),
    ty: to.y + Math.sin(index * 1.7) * spread * 0.5 - (from.y + from.h / 2),
    scale,
  };
}
