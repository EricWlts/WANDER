/** Pure scroll-coupled maths for the title "docking" into the running line and the chapter bar. */
export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a || 1));
  return t * t * (3 - 2 * t);
};

/** 0 while the title top is further than `range` below `edge`, 1 once it reaches `edge`. */
export function dockProgress(top: number, edge: number, range = 120): number {
  return clamp01((edge + range - top) / range);
}

/** Opacity of the flying clone: solid, then handing over to the running line. */
export function cloneOpacity(p: number): number {
  return 1 - smoothstep(0.62, 0.95, p);
}

/** Opacity of the running-line text (starts a little later than the line itself). */
export function lineTextOpacity(p: number): number {
  return clamp01((p - 0.4) / 0.6);
}

export type Pose = { x: number; y: number; s: number };

/** Clone pose between the live title (`from`) and the running line (`to`). */
export function flightPose(from: Pose, to: Pose, p: number): Pose {
  const e = smoothstep(0, 1, p);
  return { x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e), s: lerp(from.s, to.s, e) };
}

/** Chapter hand-over: 0 while the heading is `range` or more below the edge, 1 at the edge. */
export function chapterBlend(top: number, edge: number, range = 80): number {
  return clamp01((edge + range - top) / range);
}

const LANDED_REACH = 110;

/**
 * Active chapter: the last whose heading has reached `edge`. A chapter reached by a
 * jump (`landed`) counts as active while its heading rests just below the edge.
 */
export function resolveActiveChapter(
  tops: number[],
  edge: number,
  landed: number | null = null,
): number {
  if (landed !== null && tops[landed] !== undefined) {
    const top = tops[landed];
    if (top > edge && top <= edge + LANDED_REACH) return landed;
  }
  let active = 0;
  tops.forEach((top, index) => {
    if (top <= edge) active = index;
  });
  return active;
}

/** Distance (px of scroll) over which the title flies into the running line. */
export const dockRange = 168;

/**
 * Critically damped spring (Unity-style SmoothDamp): follows `target` with momentum,
 * arrives without overshoot. Units: progress per second; `dt` in seconds.
 */
export function smoothDamp(
  current: number,
  target: number,
  velocity: number,
  smoothTime: number,
  dt: number,
  maxSpeed = Infinity,
): { value: number; velocity: number } {
  const st = Math.max(0.0001, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const maxChange = maxSpeed * st;
  let change = current - target;
  change = Math.max(-maxChange, Math.min(maxChange, change));
  const goal = current - change;
  const temp = (velocity + omega * change) * dt;
  let v = (velocity - omega * temp) * exp;
  let value = goal + (change + temp) * exp;
  // Never overshoot the target.
  if (target - current > 0 === value > target) {
    value = target;
    v = dt > 0 ? (value - target) / dt : 0;
  }
  return { value, velocity: v };
}
