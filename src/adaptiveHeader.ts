// All distances are CSS px, times are milliseconds, speeds are px/ms.
export const headerScrollThresholds = {
  top: 24,
  collapseAfter: 180,
  downTravel: 72,
  upTravel: 220,
  upSpeed: 1.6,
  upSustain: 80,
  gestureWindow: 260,
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
// Journey / story pages: the journey takes the foreground after a few px of scrolling.
export const storyHeaderThresholds = { collapseAfter: 32, downTravel: 24 } as const;
export function isStoryPath(path: string | undefined | null): boolean {
  return !!path && /^\/(journeys|showcase|inspiration)\/[^/]+\/?$/.test(path);
}
function currentStoryRoute(): boolean {
  return typeof location !== "undefined" && isStoryPath(location.pathname);
}
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
  /** Journey/story route; defaults to the current location. */
  storyRoute?: boolean;
}
export function updateHeaderScroll(
  state: HeaderScrollState,
  scrollY: number,
  { now, upwardIntent = false, protectedInteraction = false, enabled = true, menuOpen = false, storyRoute = currentStoryRoute() }: HeaderScrollInput,
): HeaderScrollState {
  const y = Math.max(0, scrollY);
  const reset = resetHeaderGesture(state, y, now);
  if (!enabled || menuOpen) return reset;
  const t = headerScrollThresholds;
  // Story routes start (and stay) compact, even at the very top of the page.
  if (y <= t.top) return { ...reset, compact: storyRoute };
  if (protectedInteraction) return reset;
  const delta = y - state.lastY;
  if (!delta) return state;
  // Downward collapse remains distance-based, including a direct anchor jump.
  if (!state.compact) {
    const travel = Math.max(0, state.travel + delta);
    const collapseAfter = storyRoute ? storyHeaderThresholds.collapseAfter : t.collapseAfter;
    const downTravel = storyRoute ? storyHeaderThresholds.downTravel : t.downTravel;
    return y >= collapseAfter && travel >= downTravel
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

// ---------- Page transitions (used by viewTransitions.ts) ----------
// Pure route logic for the "Abblende" between pages, kept here so it stays testable
// without a DOM.

/** The longest a page change waits for its destination (data + cover decoded). */
export const PAGE_READY_MAX_MS = 600;

const APP_ROUTE = /^\/(?:$|archive\/?$|about\/?$|journeys\/[^/]+\/?$|showcase\/[^/]+\/?$|inspiration(?:\/[^/]+)?\/?$|studio(?:\/|$))/;
const STUDIO_ROUTE = /^\/studio(?:\/|$)/;

/** Main navigation entry a path belongs to; story pages belong to none. */
export type NavTarget = "home" | "archive" | "editions" | "about" | "studio";
export function navTargetFor(path: string): NavTarget | null {
  if (path === "/" || path === "") return "home";
  if (/^\/archive\/?$/.test(path)) return "archive";
  if (/^\/inspiration(?:\/|$)/.test(path)) return "editions";
  if (/^\/about\/?$/.test(path)) return "about";
  if (STUDIO_ROUTE.test(path)) return "studio";
  return null;
}

/** Public pages and the way into and out of the studio cross-fade; moves inside the studio cut as before. */
export function pageTransitionAllowed(from: string, to: string): boolean {
  if (!APP_ROUTE.test(to)) return false;
  return !(STUDIO_ROUTE.test(from) && STUDIO_ROUTE.test(to));
}

export type PopTransitionInput = {
  fromPath: string;
  fromSearch?: string;
  toPath: string;
  toSearch?: string;
  /** The entry being left was the photo viewer's own history entry (or the viewer is open). */
  fromLightbox?: boolean;
  /** The entry being entered carries history.state.wanderLightbox. */
  toLightbox?: boolean;
};

/** Back/Forward only cross-fades between different pages; the photo viewer's own entries never do. */
export function popTransitionWanted(input: PopTransitionInput): boolean {
  if (input.fromLightbox || input.toLightbox) return false;
  if (input.fromPath === input.toPath && (input.fromSearch ?? "") === (input.toSearch ?? "")) return false;
  return pageTransitionAllowed(input.fromPath, input.toPath);
}

/** Longest a page transition may keep html.vt-active, even if "finished" never settles. */
export const TRANSITION_CLASS_MAX_MS = 1500;

function segment(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

/** Public API requests a destination page starts with; warmed when a link is hovered or focused. */
export function prefetchPathsFor(path: string, locale: string): string[] {
  const lang = locale === "en" ? "en" : "de";
  if (path === "/" || path === "") return [
    "/journeys?public=1",
    `/showcase/after-hours?lang=${lang}`,
    `/showcase/quiet-atlas?lang=${lang}`,
    "/site/hero",
  ];
  if (/^\/archive\/?$/.test(path)) return ["/journeys?public=1"];
  if (/^\/inspiration\/?$/.test(path)) return ["/templates"];
  let match = /^\/journeys\/([^/]+)\/?$/.exec(path);
  if (match) return [`/journeys/${segment(match[1])}?public=1`];
  match = /^\/showcase\/([^/]+)\/?$/.exec(path);
  if (match) return [`/showcase/${encodeURIComponent(segment(match[1]))}?lang=${lang}`];
  match = /^\/inspiration\/([^/]+)\/?$/.exec(path);
  if (match) return [`/templates/${segment(match[1])}/example?lang=${lang}`];
  return [];
}

/** Pages without their own ready signal that open on a photograph. */
export function expectsCoverImage(path: string): boolean {
  return /^\/(?:about|inspiration)\/?$/.test(path) || isStoryPath(path);
}

export interface PageReadiness {
  /** The router has rendered the destination path. */
  rendered: boolean;
  /** A main#main element exists. */
  present: boolean;
  /** Its data-page-ready attribute, if the page sets one. */
  flag: string | null;
  /** Loading placeholder (PageState, aria-busy). */
  busy: boolean;
  expectsImage: boolean;
  hasImage: boolean;
}
/** True once the destination may be shown (its cover image is decoded separately). */
export function pageIsReady(s: PageReadiness): boolean {
  if (!s.rendered || !s.present || s.busy || s.flag === "false") return false;
  if (s.flag === "true") return true;
  return !s.expectsImage || s.hasImage;
}

/** Scroll positions per history entry, so Back/Forward return to the same place. */
export function createScrollMemory(limit = 60) {
  const positions = new Map<string, number>();
  return {
    save(key: string, y: number) {
      positions.delete(key);
      positions.set(key, Math.max(0, Math.round(y)));
      if (positions.size > limit) positions.delete(positions.keys().next().value as string);
    },
    get(key: string): number | undefined {
      return positions.get(key);
    },
    get size() { return positions.size; },
  };
}
