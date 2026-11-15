/** Pure scroll mapping for the home page's "two editions" scene. */
export const editionHold = 0.12;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * Left edge (percent of the stage width) from which the dark page is revealed.
 * 100 = only the light page, 50 = split in the middle, 0 = only the dark page.
 * Holds at both ends, eases in and out in between and crosses 50 at progress 0.5.
 */
export function editionSplit(progress: number): number {
  const t = clamp01((clamp01(progress) - editionHold) / (1 - 2 * editionHold));
  const eased = t * t * (3 - 2 * t);
  return 100 - eased * 100;
}

/** Progress (0..1) through a sticky scene given its wrapper's top offset and scroll length. */
export function sceneProgress(wrapperTop: number, wrapperHeight: number, stickyHeight: number): number {
  const range = wrapperHeight - stickyHeight;
  return range <= 0 ? 0 : clamp01(-wrapperTop / range);
}

/** Hero copy: fully visible until 45 % of the hero has scrolled by, gone at 90 %. */
export function heroCopyOpacity(progress: number): number {
  const t = clamp01((progress - 0.45) / 0.45);
  return 1 - t * t * (3 - 2 * t);
}

/** Hero shade: starts only in the second half of the scroll. */
export function heroDim(progress: number): number {
  return clamp01((progress - 0.5) / 0.5) * 0.9;
}
