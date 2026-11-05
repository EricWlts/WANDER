// All distances are CSS px, times are milliseconds, speeds are px/ms.
export const headerScrollThresholds = {
  top: 24,
  collapseAfter: 180,
  downTravel: 72,
  upTravel: 96,
  upSpeed: 0.75,
  upSustain: 64,
  gestureWindow: 220,
  sampleGap: 120,
  jitter: 2,
  reversal: 8,
  maxStep: 480,
  maxSpeed: 8,
  inputWindow: 140,
  layoutCooldown: 180,
  wheelBurst: 220,
  wheelGap: 120,
  wheelDecayRatio: 0.8,
  wheelAccelerationRatio: 1.35,
} as const;
export interface HeaderScrollState {
  compact: boolean;
  lastY: number;
  lastTime: number;
  travel: number;
  upStart: number;
  upTravel: number;
}
export const initialHeaderScroll: HeaderScrollState = {
  compact: false, lastY: 0, lastTime: 0, travel: 0, upStart: 0, upTravel: 0,
};
export function resetHeaderGesture(state: HeaderScrollState, y: number, now: number): HeaderScrollState {
  return { ...state, lastY: Math.max(0, y), lastTime: now, travel: 0, upStart: 0, upTravel: 0 };
}
export interface HeaderScrollInput {
  now: number;
  upwardIntent?: boolean;
  protectedInteraction?: boolean;
  enabled?: boolean;
  menuOpen?: boolean;
}
export function updateHeaderScroll(
  state: HeaderScrollState,
  scrollY: number,
  { now, upwardIntent = false, protectedInteraction = false, enabled = true, menuOpen = false }: HeaderScrollInput,
): HeaderScrollState {
  const y = Math.max(0, scrollY);
  const reset = resetHeaderGesture(state, y, now);
  if (!enabled || menuOpen) return reset;
  const t = headerScrollThresholds;
  if (y <= t.top) return { ...reset, compact: false };
  if (protectedInteraction) return reset;
  const delta = y - state.lastY;
  if (!delta) return state;
  // Downward collapse remains distance-based, including a direct anchor jump.
  if (!state.compact) {
    const travel = Math.max(0, state.travel + delta);
    return y >= t.collapseAfter && travel >= t.downTravel
      ? { ...reset, compact: true }
      : { ...reset, travel };
  }
  const elapsed = now - state.lastTime;
  // No expansion from layout/anchor corrections, idle intervals, or implausible spikes.
  if (!upwardIntent || elapsed <= 0 || elapsed > t.sampleGap ||
      Math.abs(delta) > t.maxStep || Math.abs(delta) / elapsed > t.maxSpeed)
    return reset;
  if (delta >= t.reversal) return reset;
  // Micro-motion neither creates distance nor changes the directional anchor.
  if (Math.abs(delta) <= t.jitter)
    return { ...state, lastTime: now };
  const start = state.upStart || state.lastTime;
  const duration = now - start;
  const travel = Math.max(0, state.upTravel - delta);
  const speed = travel / Math.max(1, duration);
  // Slow motion cannot accumulate into an expansion, even over a long distance.
  if (duration > t.gestureWindow || (duration >= t.upSustain && speed < t.upSpeed))
    return reset;
  if (duration >= t.upSustain && travel >= t.upTravel && speed >= t.upSpeed && delta < -t.jitter)
    return { ...reset, compact: false };
  return { ...reset, upStart: start, upTravel: travel };
}

// Menu captures the rendered state; hover/focus only override scroll intent temporarily.
export function headerIsCompact(scrollCompact: boolean, publicHeader: boolean, hover: boolean, focus: boolean, menuCompact: boolean | null) {
  return menuCompact ?? ((!publicHeader || scrollCompact) && !hover && !focus);
}

// WheelEvent has no portable momentum flag. Bound each input burst and reject a
// materially decaying tail. Ratios compare samples in the same deltaMode only;
// wheel magnitudes are never treated as CSS-px scroll distances or velocities.
export interface HeaderWheelState {
  lastTime: number;
  interval: number;
  start: number;
  direction: number;
  mode: number;
  magnitude: number;
  peak: number;
  tail: boolean;
  upward: boolean;
}
export const initialHeaderWheel: HeaderWheelState = {
  lastTime: 0, interval: 0, start: 0, direction: 0, mode: 0, magnitude: 0, peak: 0, tail: false, upward: false,
};
export function updateHeaderWheel(state: HeaderWheelState, deltaY: number, mode: number, now: number): HeaderWheelState {
  if (!Number.isFinite(deltaY) || !deltaY) return { ...initialHeaderWheel, lastTime: now };
  const t = headerScrollThresholds;
  const direction = Math.sign(deltaY);
  const magnitude = Math.abs(deltaY);
  const newSequence = direction !== state.direction || mode !== state.mode ||
    now - state.lastTime > t.wheelGap || now < state.lastTime;
  const interval = newSequence ? 0 : now - state.lastTime;
  // Equal line/page steps can accelerate through cadence alone. Compare rates
  // using elapsed time, but never let faster delivery of declining samples
  // re-authorize an already decaying momentum tail.
  const rateAcceleration = magnitude >= state.magnitude && interval > 0 && state.interval > 0 &&
    magnitude / interval >= (state.magnitude / state.interval) * t.wheelAccelerationRatio;
  const fresh = newSequence || rateAcceleration ||
    magnitude >= state.magnitude * t.wheelAccelerationRatio;
  const start = fresh ? now : state.start;
  const peak = fresh ? magnitude : Math.max(state.peak, magnitude);
  const tail = !fresh && (state.tail || magnitude <= peak * t.wheelDecayRatio);
  return {
    lastTime: now, interval, start, direction, mode, magnitude, peak, tail,
    upward: direction < 0 && !tail && now - start <= t.wheelBurst,
  };
}
