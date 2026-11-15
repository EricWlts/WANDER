// Pure logic for the single-image module: frame formats, viewport fit and crop focus.
import {
  CENTER,
  clampPercent,
  dragToFocus,
  nudgeFocus,
  type FocusPoint,
} from "./heroFocus.ts";
import type { Layout } from "./types.ts";

export type FrameFormat = "original" | "3:2" | "16:9" | "4:5" | "1:1";

export interface FrameFormatOption {
  id: FrameFormat;
  /** width / height; null = the photograph as taken. */
  ratio: number | null;
  label: readonly [string, string];
}

export const FRAME_FORMATS: readonly FrameFormatOption[] = [
  { id: "original", ratio: null, label: ["Original", "Original"] },
  { id: "3:2", ratio: 3 / 2, label: ["Landscape 3:2", "Quer 3:2"] },
  { id: "16:9", ratio: 16 / 9, label: ["Widescreen 16:9", "Breitbild 16:9"] },
  { id: "4:5", ratio: 4 / 5, label: ["Portrait 4:5", "Hoch 4:5"] },
  { id: "1:1", ratio: 1, label: ["Square 1:1", "Quadrat 1:1"] },
];

/** Compact header height plus breathing room the picture must leave free. */
export const HEADER_HEIGHT = 64;
export const VIEWPORT_MARGIN = 32;

/** Layout.ratio -> offered format; legacy values (4:3, free) are not offered and yield null. */
export function formatFromRatio(ratio: Layout["ratio"] | undefined): FrameFormat | null {
  if (ratio === undefined || ratio === "original") return "original";
  return FRAME_FORMATS.some((f) => f.id === ratio) ? (ratio as FrameFormat) : null;
}

/** Ratio stored in the layout: Original is stored as "no ratio" so old data stays untouched. */
export function ratioForFormat(format: FrameFormat): Layout["ratio"] | undefined {
  return format === "original" ? undefined : format;
}

/** Effective frame ratio (width / height) for a photograph and chosen format. */
export function frameRatio(
  format: FrameFormat,
  photo: { width: number; height: number },
): number {
  const option = FRAME_FORMATS.find((f) => f.id === format);
  if (option?.ratio) return option.ratio;
  return photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1.5;
}

/** Largest picture height that still fits the screen below the header. */
export function maxFrameHeight(viewportHeight: number): number {
  return Math.max(0, viewportHeight - HEADER_HEIGHT - VIEWPORT_MARGIN);
}

/** Widest frame (px) that fits both the container and the screen height; narrows portraits. */
export function fitFrameWidth(
  ratio: number,
  container: number,
  viewportHeight: number,
): number {
  if (!(ratio > 0)) return Math.max(0, container);
  return Math.max(0, Math.min(container, maxFrameHeight(viewportHeight) * ratio));
}

/** Whether the crop can move at all (cover overflow on some axis). */
export function canMoveCrop(
  ratio: number,
  photo: { width: number; height: number },
): boolean {
  if (!(photo.width > 0 && photo.height > 0 && ratio > 0)) return false;
  return Math.abs(photo.width / photo.height - ratio) > 0.001;
}

export function readFocus(edits: { x?: unknown; y?: unknown } | undefined): FocusPoint {
  return { x: clampPercent(edits?.x), y: clampPercent(edits?.y) };
}

export const isCentered = (p: FocusPoint) => p.x === CENTER.x && p.y === CENTER.y;

/** Pointer drag inside the preview frame -> new focus (same maths as the home hero). */
export function dragFrameFocus(
  start: FocusPoint,
  delta: { dx: number; dy: number },
  frame: { width: number; height: number },
  photo: { width: number; height: number },
): FocusPoint {
  return dragToFocus(start, delta, frame, photo);
}

/** Arrow keys move by 2 %, shift by 10 %, Home recentres. */
export function keyFrameFocus(point: FocusPoint, key: string, large = false): FocusPoint {
  return nudgeFocus(point, key, large);
}

/**
 * Layout patch that stores the focus without new backend fields: the first placement's edits
 * when placements exist, otherwise layout.photo_edits (both already validated server side).
 */
export function focusPatch(
  layout: Layout,
  photoId: number,
  point: FocusPoint,
): Partial<Layout> {
  const x = clampPercent(point.x);
  const y = clampPercent(point.y);
  const placements = layout.placements;
  if (placements && placements.length) {
    return {
      placements: placements.map((p, i) =>
        i === 0 ? { ...p, edits: { ...p.edits, x, y } } : p,
      ),
    };
  }
  return {
    photo_edits: {
      ...layout.photo_edits,
      [String(photoId)]: { ...layout.photo_edits?.[String(photoId)], x, y },
    },
  };
}

// ---- Cover title position (anchor point of the title block, in % of the cover) ----

/** Default look (no stored position): bottom left. */
export const TITLE_DEFAULT: FocusPoint = { x: 0, y: 100 };
export const TITLE_GRID: readonly FocusPoint[] = [0, 50, 100].flatMap((y) =>
  [0, 50, 100].map((x) => ({ x, y })),
);

/** Stored layout values -> position; missing/invalid values mean "default look" (null). */
export function readTitlePosition(
  layout: { title_x?: unknown; title_y?: unknown } | undefined,
): FocusPoint | null {
  const x = layout?.title_x;
  const y = layout?.title_y;
  if (typeof x !== "number" || typeof y !== "number") return null;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return { x: clampPercent(x), y: clampPercent(y) };
}

/** Which of the nine quick-pick points is active (null = none, custom drag position). */
export function gridIndex(point: FocusPoint | null): number | null {
  const p = point ?? TITLE_DEFAULT;
  const i = TITLE_GRID.findIndex((g) => g.x === p.x && g.y === p.y);
  return i < 0 ? null : i;
}

/**
 * Dragging the title block inside the preview by (dx, dy) px. The anchor is proportional
 * (0 % = block touches the left/top inset, 100 % = right/bottom inset), so any value in
 * 0..100 keeps the block inside the image; drag distance maps to the free travel range.
 */
export function dragTitlePosition(
  start: FocusPoint,
  delta: { dx: number; dy: number },
  frame: { width: number; height: number },
  block: { width: number; height: number },
): FocusPoint {
  const travelX = frame.width - block.width;
  const travelY = frame.height - block.height;
  return {
    x: travelX > 1 ? clampPercent(start.x + (delta.dx / travelX) * 100, start.x) : start.x,
    y: travelY > 1 ? clampPercent(start.y + (delta.dy / travelY) * 100, start.y) : start.y,
  };
}

/** Arrow keys move by 2 %, shift by 10 %, Home resets to the default. */
export function nudgeTitle(point: FocusPoint | null, key: string, large = false): FocusPoint | null {
  if (key === "Home") return null;
  return nudgeFocus(point ?? TITLE_DEFAULT, key, large);
}

/** Text alignment that suits the horizontal anchor. */
export function titleAlign(x: number): "left" | "center" | "right" {
  return x <= 33 ? "left" : x >= 67 ? "right" : "center";
}

/** Snap to one of the nine quick positions when within `threshold` % on both axes. */
export function snapTitle(
  point: FocusPoint,
  threshold = 6,
): { point: FocusPoint; index: number | null } {
  const index = TITLE_GRID.findIndex(
    (g) => Math.abs(g.x - point.x) <= threshold && Math.abs(g.y - point.y) <= threshold,
  );
  return index < 0 ? { point, index: null } : { point: { ...TITLE_GRID[index] }, index };
}

// ---- Pair stagger and module margins ----

/** Largest vertical shift (px) at stagger = ±100. */
export const STAGGER_MAX_PX = 72;

/**
 * Per-column vertical offsets (px) for a pair: [left, right].
 * Negative stagger = left image lower / right higher. Legacy: only the old "Staggered"
 * tile ([-36, 36]) is mapped (to +50); any other stored column_offsets ("Emphasis left") is ignored.
 */
export function pairOffsets(layout: {
  stagger?: number;
  column_offsets?: number[];
}): number[] | undefined {
  let v = layout.stagger;
  if (v === undefined) {
    const c = layout.column_offsets;
    v = c && c.length === 2 && c[0] === -36 && c[1] === 36 ? 50 : 0;
  }
  if (typeof v !== "number" || !Number.isFinite(v) || v === 0) return undefined;
  const px = Math.round((Math.max(-100, Math.min(100, v)) / 100) * STAGGER_MAX_PX);
  return [-px, px];
}

/** Side margin shown when the author has not chosen one (the theme's own inset). */
export function defaultSideMargin(
  moduleEdition: string,
  canvasEdition: string,
  padding: number | undefined,
): number {
  const dark = moduleEdition === "after-hours";
  const lightOnDark = moduleEdition !== "after-hours" && canvasEdition === "after-hours";
  return dark || lightOnDark ? (padding ?? 36) : 0;
}
