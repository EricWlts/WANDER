// Travel is measured from a directional extremum. Small reversals do not reset
// deliberate motion or accumulate repeated trackpad jitter into a toggle.
export interface HeaderScrollState {
  compact: boolean;
  lastY: number;
  travel: number;
}
export const initialHeaderScroll: HeaderScrollState = {
  compact: false,
  lastY: 0,
  travel: 0,
};
export function updateHeaderScroll(
  state: HeaderScrollState,
  scrollY: number,
  protectedInteraction = false,
  enabled = true,
  menuOpen = false,
): HeaderScrollState {
  const y = Math.max(0, scrollY);
  // Menu interaction freezes the current masthead, including near the page top.
  // Keep its travel anchor current so closing never replays background scrolling.
  if (enabled && menuOpen) return { ...state, lastY: y, travel: 0 };
  if (!enabled || protectedInteraction || y <= 24)
    return { compact: false, lastY: y, travel: 0 };
  const delta = y - state.lastY;
  if (!delta) return state;
  const travel =
    state.compact
      ? Math.min(0, state.travel + delta)
      : Math.max(0, state.travel + delta);
  if (!state.compact && y >= 180 && travel >= 72)
    return { compact: true, lastY: y, travel: 0 };
  if (state.compact && travel <= -96)
    return { compact: false, lastY: y, travel: 0 };
  return { ...state, lastY: y, travel };
}
