// Swipeable story strip on the home page ("Vorher · Nachher"): which view is current, and where to go next.

/** Index of the view whose left edge is closest to the scroll position; at the very end the last view counts. */
export function stripIndex(offsets: readonly number[], scrollLeft: number, maxScroll: number): number {
  if (offsets.length === 0) return 0;
  if (maxScroll > 0 && scrollLeft >= maxScroll - 2) return offsets.length - 1;
  let best = 0;
  let distance = Infinity;
  offsets.forEach((offset, i) => {
    const d = Math.abs(offset - scrollLeft);
    if (d < distance) {
      distance = d;
      best = i;
    }
  });
  return best;
}

/** Target view for a step (−1 back, +1 forward), kept inside the strip; no wrap-around. */
export function stripStep(index: number, step: number, count: number): number {
  if (count <= 0) return 0;
  return Math.min(count - 1, Math.max(0, index + step));
}

/** "2 / 5": one-based position, never beyond the count. */
export function stripLabel(index: number, count: number): string {
  if (count <= 0) return "0 / 0";
  return `${stripStep(index, 0, count) + 1} / ${count}`;
}
