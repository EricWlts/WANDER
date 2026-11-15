// Pure logic for the home hero's per-device image focus (object-position in percent).
export type HeroDevice = "desktop" | "tablet" | "mobile";
export interface FocusPoint {
  x: number;
  y: number;
}
export type HeroFocus = Record<HeroDevice, FocusPoint>;

export const HERO_DEVICES: readonly HeroDevice[] = ["desktop", "tablet", "mobile"];
/** Preview frame ratios (width / height). */
export const HERO_RATIOS: Record<HeroDevice, number> = {
  desktop: 16 / 10,
  tablet: 4 / 5,
  mobile: 9 / 19.5,
};
/** Same breakpoints as the home hero stylesheet. */
export const HERO_BREAKPOINTS = { mobile: 760, tablet: 1100 } as const;

export const CENTER: FocusPoint = { x: 50, y: 50 };

export function defaultFocus(): HeroFocus {
  return {
    desktop: { ...CENTER },
    tablet: { ...CENTER },
    mobile: { ...CENTER },
  };
}

/** Clamp to 0..100, rounded to one decimal; anything that is not a finite number becomes `fallback`. */
export function clampPercent(value: unknown, fallback = 50): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
}

export function normalizeFocus(value: unknown): HeroFocus {
  const source = (value && typeof value === "object" ? value : {}) as Record<
    string,
    { x?: unknown; y?: unknown } | undefined
  >;
  const result = defaultFocus();
  for (const device of HERO_DEVICES) {
    const point = source[device];
    result[device] = {
      x: clampPercent(point?.x),
      y: clampPercent(point?.y),
    };
  }
  return result;
}

export function deviceForWidth(width: number): HeroDevice {
  if (width <= HERO_BREAKPOINTS.mobile) return "mobile";
  if (width <= HERO_BREAKPOINTS.tablet) return "tablet";
  return "desktop";
}

/** Pixels by which an `object-fit: cover` image overflows its frame, per axis. */
export function coverOverflow(
  frame: { width: number; height: number },
  image: { width: number; height: number },
): { x: number; y: number } {
  if (!(frame.width > 0 && frame.height > 0 && image.width > 0 && image.height > 0))
    return { x: 0, y: 0 };
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  return {
    x: Math.max(0, image.width * scale - frame.width),
    y: Math.max(0, image.height * scale - frame.height),
  };
}

/**
 * Dragging the picture by (dx, dy) pixels moves it with the pointer, which lowers
 * object-position by the same pixel amount relative to the overflow. Axes
 * without overflow cannot move.
 */
export function dragToFocus(
  start: FocusPoint,
  delta: { dx: number; dy: number },
  frame: { width: number; height: number },
  image: { width: number; height: number },
): FocusPoint {
  const overflow = coverOverflow(frame, image);
  return {
    x: overflow.x > 0 ? clampPercent(start.x - (delta.dx / overflow.x) * 100, start.x) : clampPercent(start.x),
    y: overflow.y > 0 ? clampPercent(start.y - (delta.dy / overflow.y) * 100, start.y) : clampPercent(start.y),
  };
}

/** Arrow key → focus nudge. Arrow right shows more of the right side. */
export function nudgeFocus(point: FocusPoint, key: string, large = false): FocusPoint {
  const step = large ? 10 : 2;
  const next = { ...point };
  if (key === "ArrowLeft") next.x -= step;
  else if (key === "ArrowRight") next.x += step;
  else if (key === "ArrowUp") next.y -= step;
  else if (key === "ArrowDown") next.y += step;
  else if (key === "Home") return { ...CENTER };
  return { x: clampPercent(next.x), y: clampPercent(next.y) };
}

export function focusToPosition(point: FocusPoint): string {
  return `${clampPercent(point.x)}% ${clampPercent(point.y)}%`;
}

export function sameFocus(a: HeroFocus, b: HeroFocus): boolean {
  return HERO_DEVICES.every(
    (device) => a[device].x === b[device].x && a[device].y === b[device].y,
  );
}

/** One focus point for all three screen sizes (the single tap on the preview picture). */
export function sharedFocus(point: FocusPoint): HeroFocus {
  const clean = { x: clampPercent(point.x), y: clampPercent(point.y) };
  return { desktop: { ...clean }, tablet: { ...clean }, mobile: { ...clean } };
}

/**
 * The shared point of a stored focus, or null when no focus is stored or the three
 * crops differ (they were fine-tuned one by one).
 */
export function sharedPoint(value: unknown): FocusPoint | null {
  if (!value || typeof value !== "object") return null;
  const focus = normalizeFocus(value);
  const first = focus.desktop;
  const same = HERO_DEVICES.every((device) => focus[device].x === first.x && focus[device].y === first.y);
  return same ? { ...first } : null;
}

/** A tap at client coordinates inside a picture box, as percent of that box. */
export function tapToPoint(
  box: { left: number; top: number; width: number; height: number },
  client: { x: number; y: number },
): FocusPoint | null {
  if (!(box.width > 0 && box.height > 0)) return null;
  return {
    x: clampPercent(((client.x - box.left) / box.width) * 100),
    y: clampPercent(((client.y - box.top) / box.height) * 100),
  };
}
