import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { centerRevealEnterOpacity, centerRevealOpacity, maxRevealDuration, revealDistance, revealIsInZone } from "./revealMath";
import { viewportRect } from "./viewport";
import { isMotionOff, reducedMotionQuery } from "./motionState";
import type { RevealConfig } from "./types";
export const textMotion: RevealConfig = { effect: "none", duration: 1000 };
export const imageMotion: RevealConfig = { effect: "fade", duration: 2000 };
export function resolveReveal(
  config?: RevealConfig,
  fallback = textMotion,
): Required<RevealConfig> {
  return {
    delay: config?.delay ?? fallback.delay ?? 0,
    intensity: config?.intensity ?? fallback.intensity ?? 30,
    effect:
      !config?.effect || config.effect === "inherit"
        ? fallback.effect || "up"
        : config.effect,
    duration:
      config?.effect === "inherit"
        ? fallback.duration || 1800
        : config?.duration || fallback.duration || 1800,
  };
}
// One shared observer and animation frame for the page. Progress follows the
// viewport in both directions, with a generous, completely readable plateau.
type Target = {
  element: HTMLElement;
  effect: string;
  ready: boolean;
  intensity: number;
  textEffect: boolean;
};
const targets = new Map<HTMLElement, Target>();
const visible = new Set<HTMLElement>();
const frameWindows = new Map<Window, number>();
let observer: IntersectionObserver | undefined;
let resize: ResizeObserver | undefined;
let frame = 0;
type Painted = {
  element: HTMLElement;
  opacity: number;
  x: number;
  y: number;
  scale: number;
  inZone: boolean;
};
// Chapter headings (h2 as a direct or one-level-nested child) never fade out on exit.
function holdsHeading(element: HTMLElement) {
  return !!element.querySelector(":scope > h2, :scope > * > h2");
}
// Read phase only: no style writes, so many targets never thrash layout.
function measure(target: Target, reduced = isMotionOff()): Painted {
  const { element, effect, ready, intensity } = target;
  const rect = viewportRect(element);
  // Measure the layout position, without feeding the eased transform back
  // into the next scroll calculation (which would make a slow scroll wobble).
  const transform = getComputedStyle(element).transform;
  const matrix = transform === "none" ? null : new DOMMatrixReadOnly(transform);
  const naturalHeight = rect.height / (matrix?.m22 || 1);
  const top =
    rect.top -
    (matrix?.m42 || 0) * rect.scale -
    (naturalHeight - rect.height) / 2;
  const bottom = top + naturalHeight;
  const height = window.innerHeight;
  const iframe = element.ownerDocument.defaultView
    ?.frameElement as HTMLIFrameElement | null;
  const frameRect = iframe?.getBoundingClientRect();
  const zoneTop = frameRect ? Math.max(0, frameRect.top) : 0;
  const zoneBottom = frameRect ? Math.min(height, frameRect.bottom) : height;
  const opacity =
    reduced || effect === "none"
      ? 1
      : ready
        ? holdsHeading(element)
          ? centerRevealEnterOpacity(top, zoneTop, zoneBottom)
          : centerRevealOpacity(top, bottom, zoneTop, zoneBottom)
        : 0;
  const remaining = 1 - opacity;
  const distance = revealDistance(intensity);
  const direction = bottom < height * 0.3 ? -1 : 1;
  const x =
    effect === "left"
      ? -distance * remaining
      : effect === "right"
        ? distance * remaining
        : 0;
  const y =
    effect === "up"
      ? distance * remaining * direction
      : effect === "down"
        ? -distance * remaining * direction
        : 0;
  return {
    element,
    opacity,
    x,
    y,
    scale: effect === "zoom" ? 1 - (distance / 1500) * remaining : 1,
    inZone: revealIsInZone(top, bottom, zoneTop, zoneBottom),
  };
}
function apply({ element, opacity, x, y, scale }: Painted) {
  element.style.setProperty("--scroll-opacity", String(opacity));
  element.style.setProperty("--scroll-x", `${x}px`);
  element.style.setProperty("--scroll-y", `${y}px`);
  element.style.setProperty("--scroll-scale", String(scale));
}
function paint(target: Target) {
  apply(measure(target));
}
// Elements already in (or touching) the viewport are placed at their final
// value without a transition: no fade-in from 0 after load, route change,
// layout, font or image changes.
function settleNow() {
  const painted: Painted[] = [];
  const reduced = isMotionOff();
  targets.forEach((target) => painted.push(measure(target, reduced)));
  const instant = painted.filter((item) => item.inZone);
  instant.forEach((item) => item.element.style.setProperty("transition", "none"));
  painted.forEach(apply);
  if (instant.length) {
    void instant[0].element.offsetWidth;
    requestAnimationFrame(() =>
      instant.forEach((item) => item.element.style.removeProperty("transition")),
    );
  }
}
let settleFrame = 0;
function scheduleSettle() {
  if (settleFrame) return;
  settleFrame = requestAnimationFrame(() => {
    settleFrame = 0;
    settleNow();
  });
}
let settleListening = false;
let lastScrollY = 0;
let jumpFrame = 0;
function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    // An anchor jump or restored scroll position lands without a fade.
    const y = window.scrollY;
    const jumped = Math.abs(y - lastScrollY) > window.innerHeight * 1.2;
    lastScrollY = y;
    const painted: Painted[] = [];
    const reduced = isMotionOff();
    visible.forEach((element) => {
      const target = targets.get(element);
      if (target) painted.push(measure(target, reduced));
    });
    if (jumped) {
      document.documentElement.dataset.revealJump = "";
      cancelAnimationFrame(jumpFrame);
      jumpFrame = requestAnimationFrame(() => {
        jumpFrame = requestAnimationFrame(() => {
          delete document.documentElement.dataset.revealJump;
        });
      });
    }
    painted.forEach(apply);
  });
}
function register(target: Target) {
  if (!targets.size) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotionQuery()?.addEventListener("change", schedule);
    window.addEventListener("wander-motion", schedule);
    // Page change: reveals hold still during the cut and continue once it has ended.
    window.addEventListener("wander-page-transition-end", schedule);
    if ("IntersectionObserver" in window)
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) visible.add(entry.target as HTMLElement);
            else {
              const value = targets.get(entry.target as HTMLElement);
              if (value) paint(value);
              visible.delete(entry.target as HTMLElement);
            }
          });
          schedule();
        },
        { rootMargin: "50% 0px 50% 0px" },
      );
    if ("ResizeObserver" in window) {
      resize = new ResizeObserver(scheduleSettle);
      resize.observe(document.documentElement);
    }
    if (!settleListening) {
      settleListening = true;
      if (document.readyState !== "complete")
        window.addEventListener("load", scheduleSettle, { once: true });
      void document.fonts?.ready.then(scheduleSettle);
    }
  }
  const ownerWindow = target.element.ownerDocument.defaultView;
  if (ownerWindow && ownerWindow !== window) {
    const count = frameWindows.get(ownerWindow) || 0;
    if (!count)
      ownerWindow.addEventListener("scroll", schedule, { passive: true });
    frameWindows.set(ownerWindow, count + 1);
  }
  targets.set(target.element, target);
  visible.add(target.element);
  observer?.observe(target.element);
  resize?.observe(target.element);
  // Final value immediately, then once more after layout has settled.
  const element = target.element;
  const painted = measure(target);
  if (painted.inZone) element.style.transition = "none";
  apply(painted);
  if (painted.inZone) {
    void element.offsetWidth;
    requestAnimationFrame(() => element.style.removeProperty("transition"));
  }
  scheduleSettle();
  return () => {
    if (ownerWindow && ownerWindow !== window) {
      const count = (frameWindows.get(ownerWindow) || 1) - 1;
      if (count) frameWindows.set(ownerWindow, count);
      else {
        ownerWindow.removeEventListener("scroll", schedule);
        frameWindows.delete(ownerWindow);
      }
    }
    observer?.unobserve(target.element);
    resize?.unobserve(target.element);
    targets.delete(target.element);
    visible.delete(target.element);
    if (!targets.size) {
      observer?.disconnect();
      resize?.disconnect();
      settleListening = false;
      cancelAnimationFrame(settleFrame);
      settleFrame = 0;
      observer = undefined;
      resize = undefined;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("wander-motion", schedule);
      window.removeEventListener("wander-page-transition-end", schedule);
      window.removeEventListener("resize", schedule);
      // Same cached MediaQueryList as in register: the listener really goes away.
      reducedMotionQuery()?.removeEventListener("change", schedule);
      cancelAnimationFrame(frame);
      frame = 0;
    }
  };
}
export function useReveal(
  ref: RefObject<HTMLElement | null>,
  config?: RevealConfig,
  enabled = true,
  ready = true,
  playback: "scroll" | "preview" = "scroll",
  textEffect = false,
) {
  const { effect, duration, delay, intensity } = resolveReveal(config);
  const [entered, setEntered] = useState(false);
  // Safety net: a photograph that never reports "ready" must not leave a hole.
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (ready || !enabled) return;
    const timer = window.setTimeout(() => setLate(true), 2500);
    return () => window.clearTimeout(timer);
  }, [ready, enabled]);
  const settled = ready || late;
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    if (playback === "scroll")
      return register({ element, effect, ready: settled, intensity, textEffect });
    const timer = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(timer);
  }, [ref, enabled, effect, settled, playback, intensity, textEffect]);
  return {
    "data-reveal": enabled ? effect : undefined,
    "data-motion": enabled ? playback : undefined,
    "data-revealed":
      !enabled || effect === "none" || (entered && settled) ? "true" : "false",
    style: {
      "--reveal-delay": `${delay}ms`,
      "--reveal-distance": `${revealDistance(intensity)}px`,
      "--reveal-duration": `${Math.min(duration, maxRevealDuration)}ms`,
      "--scroll-smoothing": `${textEffect ? 220 : 280}ms`,
    } as CSSProperties,
  };
}
export function Reveal({
  children,
  config,
  className = "",
  as: Tag = "div",
  playback = "scroll",
  textEffect = true,
}: {
  children: ReactNode;
  config?: RevealConfig;
  className?: string;
  as?: "div" | "span";
  playback?: "scroll" | "preview";
  textEffect?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <Tag
      ref={ref}
      className={`reveal ${className}`}
      {...useReveal(ref, config, true, true, playback, textEffect)}
    >
      {children}
    </Tag>
  );
}
