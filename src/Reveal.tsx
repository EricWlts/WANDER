import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { centerRevealOpacity } from "./revealMath";
import { viewportRect } from "./viewport";
import type { RevealConfig, RevealEffect, RevealSettings } from "./types";
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
export function journeyReveal(
  settings: RevealSettings,
  key: keyof RevealSettings = "default",
) {
  return resolveReveal(
    settings?.[key],
    key === "images" ? imageMotion : resolveReveal(settings?.default),
  );
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
const clamp = (value: number) => Math.max(0, Math.min(1, value));
function paint(target: Target) {
  const { element, effect, ready, intensity, textEffect } = target;
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
  const reduced =
    document.documentElement.dataset.motion === "off" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const entry = clamp((height * 0.98 - top) / (height * 0.23));
  const exit = clamp((bottom - height * 0.02) / (height * 0.17));
  const iframe = element.ownerDocument.defaultView
    ?.frameElement as HTMLIFrameElement | null;
  const frameRect = iframe?.getBoundingClientRect();
  const zoneTop = frameRect ? Math.max(0, frameRect.top) : 0;
  const zoneBottom = frameRect ? Math.min(height, frameRect.bottom) : height;
  const centered = centerRevealOpacity(top, bottom, zoneTop, zoneBottom);
  const opacity =
    reduced || effect === "none"
      ? 1
      : ready
        ? textEffect
          ? centered
          : Math.min(entry, exit)
        : 0;
  const remaining = 1 - opacity;
  const direction = bottom < height * 0.3 ? -1 : 1;
  const x =
    effect === "left"
      ? -intensity * remaining
      : effect === "right"
        ? intensity * remaining
        : 0;
  const y =
    effect === "up"
      ? intensity * remaining * direction
      : effect === "down"
        ? -intensity * remaining * direction
        : 0;
  element.style.setProperty("--scroll-opacity", String(opacity));
  element.style.setProperty("--scroll-x", `${x}px`);
  element.style.setProperty("--scroll-y", `${y}px`);
  element.style.setProperty(
    "--scroll-scale",
    String(effect === "zoom" ? 1 - (intensity / 1500) * remaining : 1),
  );
}
function schedule() {
  if (frame) return;
  frame = requestAnimationFrame(() => {
    frame = 0;
    visible.forEach((element) => {
      const target = targets.get(element);
      if (target) paint(target);
    });
  });
}
function register(target: Target) {
  if (!targets.size) {
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .addEventListener("change", schedule);
    window.addEventListener("wander-motion", schedule);
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
        { rootMargin: "20% 0px" },
      );
    if ("ResizeObserver" in window) resize = new ResizeObserver(schedule);
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
  paint(target);
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
      observer = undefined;
      resize = undefined;
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("wander-motion", schedule);
      window.removeEventListener("resize", schedule);
      window
        .matchMedia("(prefers-reduced-motion: reduce)")
        .removeEventListener("change", schedule);
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
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    if (playback === "scroll")
      return register({ element, effect, ready, intensity, textEffect });
    const timer = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(timer);
  }, [ref, enabled, effect, ready, playback, intensity, textEffect]);
  return {
    "data-reveal": enabled ? effect : undefined,
    "data-motion": enabled ? playback : undefined,
    "data-revealed":
      !enabled || effect === "none" || (entered && ready) ? "true" : "false",
    style: {
      "--reveal-delay": `${delay}ms`,
      "--reveal-distance": `${intensity}px`,
      "--reveal-duration": `${duration}ms`,
      "--scroll-smoothing": `${textEffect ? Math.round(duration * 0.12) : Math.round(duration * 0.2)}ms`,
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
export const revealOptions: {
  value: RevealEffect | "inherit";
  label: string;
}[] = [
  { value: "inherit", label: "Journey default" },
  { value: "fade", label: "Soft fade" },
  { value: "up", label: "From below ↑" },
  { value: "down", label: "From above ↓" },
  { value: "left", label: "From the left →" },
  { value: "right", label: "From the right ←" },
  { value: "zoom", label: "Gentle zoom" },
  { value: "parallax", label: "Parallax" },
  { value: "none", label: "No animation" },
];
