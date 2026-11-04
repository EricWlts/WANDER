export type ReadingDirection = { anchor: number; visible: boolean };

/** Measure from the furthest point reached, so small reversals do not flicker. */
export function updateReadingDirection(
  state: ReadingDirection,
  y: number,
): ReadingDirection {
  if (state.visible) {
    if (y - state.anchor >= 16) return { anchor: y, visible: false };
    return { anchor: Math.min(state.anchor, y), visible: true };
  }
  if (state.anchor - y >= 48) return { anchor: y, visible: true };
  return { anchor: Math.max(state.anchor, y), visible: false };
}

/** Recompute from every chapter, including chapters skipped by large scroll jumps. */
export function activeChapterIndex(
  tops: number[],
  readingLine: number,
): number {
  let active = 0;
  tops.forEach((top, index) => {
    if (top <= readingLine) active = index;
  });
  return active;
}
