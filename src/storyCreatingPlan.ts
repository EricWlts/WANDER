import { cubicBezier } from "./wMark.ts";
export type CreatingLine = { en: string; de: string };

/** Full motion: the W is drawn from the baseline upward, then fills; the last line rests until 7 s, then the W becomes a window. */
export const CREATING_TOTAL_MS = 7000;
/** The growth of the window (same as the studio entrance, see wMark.ts WINDOW.growMs). */
export const CREATING_ZOOM_MS = 1500;
/** Share of the progress in which the outline is drawn; afterwards the letter fills from below. Nothing is visible at 0. */
/* Built like the masthead W on the home page, one after the other and slower: first the ridge is drawn in one stroke
   (time-based), then the letter rises from the baseline – exactly as far as the loading percentage says, which moves
   unevenly (CURVE). The percentage only appears once the rise begins. Arguments are the time fraction 0..1. */
const RIDGE = { from: 0.04, to: 0.44 };
const RISE = { from: 0.46, to: 1 };
const ridgeEase = cubicBezier(0.4, 0, 0.3, 1);
/** Time fraction at which the ridge is complete. */
export const DRAW_SHARE = RIDGE.to;
/** Time fraction at which the letter starts to rise and the percentage appears. */
export const FILL_START = RISE.from;

/** 0..1: how much of the ridge is drawn at time fraction `x`. */
export function drawProgress(x: number): number {
  return ridgeEase(Math.min(Math.max((x - RIDGE.from) / (RIDGE.to - RIDGE.from), 0), 1));
}
/** 0..1: loading percentage = height of the risen letter at time fraction `x` (uneven; holds at 95 % until ready). */
export function fillProgress(x: number, ready = true): number {
  const u = Math.min(Math.max((x - RISE.from) / (RISE.to - RISE.from), 0), 1);
  return progressAt(u, 1, ready);
}
/** Viewbox of the W mark (-20 -20 1035 555) and the width of the soft light edge, in viewbox units. */
export const MARK_TOP = -20;
export const MARK_BOTTOM = 535;
export const EDGE_SOFT = 70;

/** Top of the rising fill's soft edge for a progress 0..1: below the baseline at 0, above the letter at 1. */
export function fillEdgeY(progress: number): number {
  const p = Math.min(Math.max(progress, 0), 1);
  return MARK_BOTTOM - (MARK_BOTTOM - MARK_TOP + EDGE_SOFT) * p;
}
export const CREATING_REDUCED_MS = 1500;
/** While the story is still being saved, the progress waits here. */
export const CREATING_HOLD = 0.95;

/** When each line appears (ms); every line stays readable for at least 1.6 s. */
const LINE_STARTS = [0, 1700, 3500, 5200];

/** Control points (time share, progress): slightly uneven so it feels like real work. */
const CURVE: Array<[number, number]> = [
  [0, 0],
  [0.12, 0.08],
  [0.3, 0.27],
  [0.42, 0.36],
  [0.62, 0.68],
  [0.78, 0.8],
  [0.91, 1],
  [1, 1],
];

/** Sequence and timing of the transition lines; one static line with reduced motion. */
export function storyCreatingPlan(
  reduced: boolean,
  edition: string,
): { lines: CreatingLine[]; starts: number[]; totalMs: number; lineMs: number; zoomMs: number } {
  const lines: CreatingLine[] = [
    { en: "Your photographs are being looked through …", de: "Deine Fotos werden gesichtet …" },
    edition === "after-hours"
      ? { en: "Last light is being set …", de: "Das letzte Licht wird gesetzt …" }
      : { en: "First light is being set …", de: "Das erste Licht wird gesetzt …" },
    { en: "Chapters are being arranged …", de: "Kapitel werden geordnet …" },
    { en: "Your story is ready.", de: "Deine Geschichte ist bereit." },
  ];
  if (reduced) {
    return { lines: [lines[3]], starts: [0], totalMs: CREATING_REDUCED_MS, lineMs: CREATING_REDUCED_MS, zoomMs: 0 };
  }
  return { lines, starts: LINE_STARTS, totalMs: CREATING_TOTAL_MS, lineMs: 1800, zoomMs: CREATING_ZOOM_MS };
}

/** Index of the line shown at `elapsedMs`. */
export function lineIndexAt(starts: number[], elapsedMs: number): number {
  let index = 0;
  for (let i = 0; i < starts.length; i++) if (elapsedMs >= starts[i]) index = i;
  return index;
}

/** Eased, uneven progress 0..1 for a point in time; waits at CREATING_HOLD until `ready`. */
export function progressAt(elapsedMs: number, totalMs: number, ready: boolean): number {
  const x = Math.min(Math.max(elapsedMs / totalMs, 0), 1);
  let value = 1;
  for (let i = 1; i < CURVE.length; i++) {
    const [x1, y1] = CURVE[i];
    if (x <= x1) {
      const [x0, y0] = CURVE[i - 1];
      const k = x1 === x0 ? 1 : (x - x0) / (x1 - x0);
      const eased = k * k * (3 - 2 * k) * 0.5 + k * 0.5;
      value = y0 + (y1 - y0) * eased;
      break;
    }
  }
  return ready ? value : Math.min(value, CREATING_HOLD);
}

/** The overlay may close once the time is up and the story exists. */
export function creatingFinished(elapsedMs: number, totalMs: number, ready: boolean): boolean {
  return ready && elapsedMs >= totalMs;
}

export function prefersReducedMotion(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  if (document.documentElement.dataset.motion === "off") return true;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
