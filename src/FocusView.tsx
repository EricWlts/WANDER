import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { ChevronLeft, ChevronRight, X, ZoomOut } from "lucide-react";
import { t, useLocale } from "./I18n";
import { useMotionOff } from "./Motion";
import {
  PhotoViewerModel,
  colorIsDark,
  decodedImageRequest,
  focusFlip,
  focusOffsets,
  viewerDrag,
  viewerIndex,
  viewerIsDoubleTap,
  viewerIsTap,
  viewerIsZoomed,
  viewerPan,
  viewerPinch,
  viewerToggleZoom,
  viewerTouch,
  viewerWheel,
  viewerWheelZoom,
  viewerZoomAt,
  viewerZoomIdle,
  type Rect,
  type ViewerState,
  type ViewerWheel,
  viewerStepWheel,
  viewerStepIdle,
  type ViewerStepGesture,
  type ViewerZoom,
} from "./photoViewerModel";
import {
  railFollows,
  railRestRect,
} from "./photoRailModel";
import type { Photo } from "./types";
import { SignatureWordmark } from "./SignatureBrand";
import "./focus-view.css";

/** The element that was activated just before the view opened (Safari does not focus buttons). */
let lastClick: { element: Element; time: number } | null = null;
if (typeof document !== "undefined")
  document.addEventListener(
    "click",
    (event) => {
      if (event.target instanceof Element)
        lastClick = { element: event.target, time: performance.now() };
    },
    true,
  );

type Origin = {
  picture: HTMLElement | null;
  trigger: HTMLElement | null;
  rail: HTMLElement | null;
  dark: boolean;
};

function surfaceIsDark(from: Element | null) {
  for (let element = from; element; element = element.parentElement) {
    const dark = colorIsDark(getComputedStyle(element).backgroundColor);
    if (dark !== null) return dark;
  }
  return false;
}

function captureOrigin(): Origin {
  const fresh =
    lastClick && performance.now() - lastClick.time < 1500
      ? lastClick.element
      : null;
  const picture = fresh?.closest<HTMLElement>(".picture") ?? null;
  const trigger =
    fresh?.closest<HTMLElement>("button, a, [tabindex]") ??
    (document.activeElement instanceof HTMLElement &&
    document.activeElement !== document.body
      ? document.activeElement
      : null);
  const scope = picture ?? trigger ?? document.body;
  // The edition decides the tone; the surface behind is only a fallback.
  const edition = scope.closest(".edition-after-hours, .template-after-hours")
    ? true
    : scope.closest(".edition-quiet-atlas, .template-quiet-atlas")
      ? false
      : null;
  return {
    picture,
    trigger,
    rail: picture?.closest<HTMLElement>(".photo-rail-shell") ?? null,
    dark: edition ?? surfaceIsDark(scope),
  };
}

const inViewport = (rect: Rect) =>
  rect.width > 0 &&
  rect.height > 0 &&
  rect.left < window.innerWidth &&
  rect.left + rect.width > 0 &&
  rect.top < window.innerHeight &&
  rect.top + rect.height > 0;

function overlapsForegroundPlate(picture: HTMLElement, rest: Rect) {
  const nextPlate = picture.closest(".home-showcase-figure")?.nextElementSibling;
  if (!nextPlate?.matches(".home-showcase-figure")) return false;
  const front = nextPlate.getBoundingClientRect();
  return inViewport(front) &&
    rest.left < front.right &&
    rest.left + rest.width > front.left &&
    rest.top < front.bottom &&
    rest.top + rest.height > front.top;
}

const enterEase = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const exitEase = "cubic-bezier(0.2, 0.7, 0.2, 1)";
const flightMs = 620;
const openShadow = "0 0 0 0 rgba(0, 0, 0, 0)";
/** Extends the clip past the box at rest so the shadow is not cut off. */
const clipRest = "inset(-140px -140px)";

type MountShadow = { color: string; lens: number[] };

/** Splits a computed box-shadow into colour + lengths (x, y, blur, spread). Inset shadows are ignored. */
function parseShadows(value: string): MountShadow[] {
  if (!value || value === "none") return [];
  const parts: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < value.length; i += 1) {
    const char = value[i];
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    else if (char === "," && depth === 0) {
      parts.push(value.slice(from, i));
      from = i + 1;
    }
  }
  parts.push(value.slice(from));
  const shadows: MountShadow[] = [];
  for (const part of parts) {
    if (/\binset\b/.test(part)) continue;
    const lens = [...part.matchAll(/(-?[\d.]+(?:e-?\d+)?)px/g)].map((m) => Number(m[1]));
    const color = part.replace(/(-?[\d.]+(?:e-?\d+)?)px/g, "").trim();
    if (lens.length < 2 || !color) continue;
    while (lens.length < 4) lens.push(0);
    shadows.push({ color, lens: lens.slice(0, 4) });
  }
  return shadows;
}

/** The shadow list scaled to `k` (0 = nothing yet); lengths are divided by `unit` because the flight scales the box. */
function mountShadow(shadows: MountShadow[], k: number, unit: number) {
  return shadows
    .map(
      ({ color, lens }) =>
        `${color} ${lens.map((n) => `${(n * k) / unit}px`).join(" ")}`,
    )
    .join(", ");
}

/** The page picture that shows this photograph (same file), preferring one that is on screen. */
function findOriginal(photo: Photo | undefined): HTMLElement | null {
  if (!photo) return null;
  let found: HTMLElement | null = null;
  for (const image of document.querySelectorAll<HTMLImageElement>(".picture img")) {
    if (image.closest("dialog.focus-view")) continue;
    if (image.getAttribute("src") !== photo.url) continue;
    const picture = image.closest<HTMLElement>(".picture");
    if (!picture) continue;
    if (inViewport(picture.getBoundingClientRect())) return picture;
    found ??= picture;
  }
  return found;
}

export function FocusView({
  photos,
  initial,
  onClose,
}: {
  photos: Photo[];
  initial: number;
  onClose: () => void;
}) {
  useLocale();
  const motionOff = useMotionOff();
  const count = photos.length;
  const [origin] = useState(captureOrigin);
  const [startIndex] = useState(() => viewerIndex(initial, count));
  /** Unwrapped position: neighbours keep their identity across the seam. */
  const [pos, setPos] = useState(startIndex);
  const index = viewerIndex(pos, count);
  const [view, setView] = useState<ViewerState>({
    target: startIndex,
    visible: null,
    status: "loading",
  });
  const [leaving, setLeaving] = useState(false);

  const dialog = useRef<HTMLDialogElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const model = useRef<PhotoViewerModel | null>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const id = useId();
  const closing = useRef(false);
  const finished = useRef(false);
  const waitingPop = useRef(false);
  const indexRef = useRef(index);
  indexRef.current = index;
  const motionRef = useRef(motionOff);
  motionRef.current = motionOff;
  const hidden = useRef<HTMLElement[]>([]);
  const animations = useRef<Animation[]>([]);
  const focusTarget = useRef<HTMLElement | null>(null);
  const touch = useRef<{ x: number; y: number; time: number } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  /** Enlargement of the centre photograph; lives in a ref so gestures never re-render per frame. */
  const zoom = useRef<ViewerZoom>(viewerZoomIdle);
  const [zoomed, setZoomed] = useState(false);
  const pinch = useRef<{ zoom: ViewerZoom; distance: number; mid: { x: number; y: number } } | null>(null);
  /** One finger (touch) or the mouse moving an enlarged photograph instead of paging. */
  const pan = useRef<{ x: number; y: number; zoom: ViewerZoom; mouse?: number } | null>(null);
  const lastTap = useRef<{ time: number; x: number; y: number } | null>(null);
  const lastTouchZoom = useRef(-Infinity);
  const justPanned = useRef(false);

  /** Sizes and position the zoom maths needs: layout sizes, so they ignore the zoom itself. */
  const geometry = useCallback(() => {
    const media = dialog.current?.querySelector<HTMLElement>("[data-center] .focus-media");
    const area = stage.current;
    if (!media || !area) return null;
    const rect = area.getBoundingClientRect();
    return {
      media: { width: media.offsetWidth, height: media.offsetHeight },
      stage: { width: area.clientWidth, height: area.clientHeight },
      /** Client point -> offset from the centre of the photograph's resting box. */
      focal: (x: number, y: number) => ({
        x: x - (rect.left + rect.width / 2),
        y: y - (rect.top + rect.height / 2),
      }),
    };
  }, []);
  /** `live` while a finger or the mouse drives it (no easing); otherwise the change glides. */
  const applyZoom = useCallback((next: ViewerZoom, live: boolean) => {
    zoom.current = next;
    const element = stage.current;
    if (!element) return;
    if (live) element.setAttribute("data-gesture", "");
    else element.removeAttribute("data-gesture");
    element.style.setProperty("--fv-zoom", String(next.scale));
    element.style.setProperty("--fv-zx", `${next.x}px`);
    element.style.setProperty("--fv-zy", `${next.y}px`);
    const on = viewerIsZoomed(next);
    if (on) element.setAttribute("data-zoomed", "");
    else element.removeAttribute("data-zoomed");
    setZoomed(on);
  }, []);
  const resetZoom = useCallback((live = false) => {
    pinch.current = null;
    pan.current = null;
    if (viewerIsZoomed(zoom.current)) applyZoom(viewerZoomIdle, live);
  }, [applyZoom]);
  const toggleZoomAt = (x: number, y: number) => {
    const g = geometry();
    if (!g || closing.current) return;
    applyZoom(viewerToggleZoom(zoom.current, g.focal(x, y), g.media, g.stage), false);
  };
  /** Drop the finger-follow offset; with `settle` the band glides back/forward softly. */
  const releaseDrag = () => {
    const element = stage.current;
    if (!element) return;
    element.removeAttribute("data-dragging");
    element.style.removeProperty("--fv-drag");
  };

  const hide = (element: HTMLElement) => {
    element.style.visibility = "hidden";
    if (!hidden.current.includes(element)) hidden.current.push(element);
  };
  const run = (
    element: Element | null | undefined,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
  ) => {
    if (!element || typeof element.animate !== "function") return null;
    const animation = element.animate(keyframes, options);
    animations.current.push(animation);
    return animation;
  };
  const centerMedia = () =>
    dialog.current?.querySelector<HTMLElement>("[data-center] .focus-media") ??
    null;
  /**
   * The paper mount of a framed original (Erstes Licht) travels with the flight: a separate
   * frame box sits on the visible part of the photograph and its box-shadow grows from nothing
   * to exactly the original's computed value (or melts away when opening). Clip and frame are
   * different boxes, so the clipped overhang never shows and the frame is never cut.
   */
  const flightFrame = (
    media: HTMLElement,
    source: HTMLElement | null,
    flip: ReturnType<typeof focusFlip>,
    closingFlight: boolean,
  ) => {
    if (!source) return null;
    const style = getComputedStyle(source);
    const shadows = parseShadows(style.boxShadow);
    if (!shadows.length) return null;
    const unit = flip.scale > 0 ? flip.scale : 1;
    const frame = document.createElement("div");
    frame.setAttribute("aria-hidden", "true");
    frame.className = "focus-flight-frame";
    const radius = parseFloat(style.borderTopLeftRadius) || 0;
    const full = {
      top: `${flip.clip}px`,
      bottom: `${flip.clip}px`,
      left: `${flip.clipX}px`,
      right: `${flip.clipX}px`,
      borderRadius: `${radius / unit}px`,
      boxShadow: mountShadow(shadows, 1, unit),
    };
    const none = {
      top: "0px",
      bottom: "0px",
      left: "0px",
      right: "0px",
      borderRadius: "0px",
      boxShadow: mountShadow(shadows, 0, unit),
    };
    for (const stale of media.querySelectorAll(".focus-flight-frame")) stale.remove();
    media.appendChild(frame);
    const animation = run(
      frame,
      closingFlight ? [none, full] : [full, none],
      {
        duration: flightMs,
        easing: closingFlight ? exitEase : enterEase,
        fill: "both",
      },
    );
    if (!closingFlight && animation) {
      const drop = () => frame.remove();
      animation.finished.then(drop, drop);
    }
    return animation;
  };

  // Open: the photograph grows out of its place; the page behind stays visible under a veil.
  useLayoutEffect(() => {
    const element = dialog.current!;
    const scroll = { x: window.scrollX, y: window.scrollY };
    // The wordmark stays exactly where the slim masthead shows it: measure the page's own glyphs.
    const header = document.querySelector<HTMLElement>("header.site-header.is-compact");
    const mono = header?.querySelector<SVGElement>(".editorial-brand .header-monogram");
    const rest = header?.querySelector<SVGElement>(".editorial-brand .header-remainder");
    if (mono && rest) {
      const a = mono.getBoundingClientRect();
      const b = rest.getBoundingClientRect();
      const width = b.right - a.left;
      const height = (width * 84) / 736;
      const centre = (Math.min(a.top, b.top) + Math.max(a.bottom, b.bottom)) / 2;
      if (width > 80 && width < 400 && centre > 0 && centre < 120) {
        element.style.setProperty("--fv-mark-w", `${width.toFixed(2)}px`);
        element.style.setProperty("--fv-mark-x", `${((a.left + b.right) / 2).toFixed(2)}px`);
        element.style.setProperty("--fv-mark-top", `${(centre - height / 2).toFixed(2)}px`);
      }
    }
    if (!element.open) element.showModal();
    finished.current = false;
    closing.current = false;
    waitingPop.current = false;
    if (!motionRef.current) {
      run(scrim.current, [{ opacity: 0 }, { opacity: 1 }], {
        duration: flightMs,
        easing: enterEase,
      });
      const media = centerMedia();
      const to = media?.getBoundingClientRect();
      const from = origin.picture?.isConnected
        ? origin.picture.getBoundingClientRect()
        : null;
      if (media && to && from && inViewport(from)) {
        const flip = focusFlip(from, to);
        const shadow = getComputedStyle(media).boxShadow;
        const tint = getComputedStyle(media).backgroundColor;
        run(
          media,
          [
            {
              transform: `translate(${flip.x}px, ${flip.y}px) scale(${flip.scale})`,
              boxShadow: openShadow,
              backgroundColor: "transparent",
            },
            { transform: "none", boxShadow: shadow, backgroundColor: tint },
          ],
          { duration: flightMs, easing: enterEase },
        );
        run(
          media.querySelector(".focus-zoom"),
          [{ clipPath: `inset(${flip.clip}px ${flip.clipX}px)` }, { clipPath: clipRest }],
          { duration: flightMs, easing: enterEase },
        );
        flightFrame(media, origin.picture, flip, false);
        if (origin.picture) hide(origin.picture);
      } else
        run(
          media,
          [
            { opacity: 0, transform: "scale(0.96)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 460, easing: enterEase },
        );
    } else if (origin.picture?.isConnected) hide(origin.picture);
    return () => {
      for (const animation of animations.current) animation.cancel();
      animations.current = [];
      for (const item of hidden.current) item.style.visibility = "";
      hidden.current = [];
      if (element.open) element.close();
      // The page never scrolls while open; this only guards against stray movement.
      if (window.scrollX !== scroll.x || window.scrollY !== scroll.y)
        window.scrollTo({ left: scroll.x, top: scroll.y, behavior: "instant" });
      const target = focusTarget.current ?? origin.trigger;
      if (target?.isConnected) target.focus({ preventScroll: true });
    };
    // Mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function complete() {
    if (finished.current) return;
    finished.current = true;
    closeRef.current();
  }

  const beginClose = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    resetZoom(true);
    setLeaving(true);
    const settle = () => {
      if (finished.current) return;
      // Our own history entry is on top: pop it, the popstate handler completes.
      if (history.state?.wanderLightbox === id) {
        waitingPop.current = true;
        history.back();
        window.setTimeout(complete, 500);
      } else complete();
    };
    if (motionRef.current) {
      settle();
      return;
    }
    // Find where the photograph belongs now: the rail follows the viewer.
    let rest: Rect | null = null;
    let landing: HTMLElement | null = null;
    const rail = origin.rail;
    if (rail?.isConnected) {
      const segments = [...rail.querySelectorAll(".rail-segments button")];
      const current = segments.findIndex(
        (item) => item.getAttribute("aria-current") === "true",
      );
      const picture = rail.querySelector<HTMLElement>(
        "figure[data-active] .picture",
      );
      const viewport = rail.querySelector(".carousel-viewport");
      if (
        picture &&
        viewport &&
        railFollows(segments.length, count, current, indexRef.current)
      ) {
        const frame = picture.getBoundingClientRect();
        const port = viewport.getBoundingClientRect();
        landing = picture;
        rest = railRestRect(port, {
          top: frame.top,
          width: picture.offsetWidth,
          height: picture.offsetHeight,
        });
      }
    }
    if (!landing || !rest) {
      // The photograph on screen now (maybe not the one that was clicked): its own original.
      const own =
        indexRef.current === startIndex && origin.picture?.isConnected
          ? origin.picture
          : findOriginal(photos[indexRef.current]);
      landing = own;
      rest = own ? own.getBoundingClientRect() : null;
    }
    // Another original than the clicked one: the clicked one is already back.
    if (landing !== origin.picture && origin.picture?.isConnected)
      origin.picture.style.visibility = "";
    const media = centerMedia();
    const here = media?.getBoundingClientRect();
    const behindPlate = landing && rest && here && media && inViewport(rest) &&
      overlapsForegroundPlate(landing, rest);
    const pending: Animation[] = [];
    const add = (animation: Animation | null) => {
      if (animation) pending.push(animation);
    };
    add(
      run(scrim.current, [{ opacity: 1 }, { opacity: 0 }], {
        duration: flightMs,
        easing: exitEase,
        fill: "forwards",
      }),
    );
    if (media && here && rest && inViewport(rest) && landing) {
      const flip = focusFlip(rest, here);
      // The modal is above the page. Hand off to the real plate near the end
      // so its foreground neighbour naturally covers the overlapping edge.
      if (behindPlate) {
        landing.style.visibility = "";
        add(run(media, [{ opacity: 1 }, { opacity: 0 }], {
          delay: flightMs - 200,
          duration: 200,
          easing: exitEase,
          fill: "both",
        }));
      } else hide(landing);
      focusTarget.current = landing;
      const shadow = getComputedStyle(media).boxShadow;
      const tint = getComputedStyle(media).backgroundColor;
      add(
        run(
          media,
          [
            { transform: "none", boxShadow: shadow, backgroundColor: tint },
            {
              transform: `translate(${flip.x}px, ${flip.y}px) scale(${flip.scale})`,
              boxShadow: openShadow,
              backgroundColor: "transparent",
            },
          ],
          { duration: flightMs, easing: exitEase, fill: "forwards" },
        ),
      );
      add(
        run(
          media.querySelector(".focus-zoom"),
          [{ clipPath: clipRest }, { clipPath: `inset(${flip.clip}px ${flip.clipX}px)` }],
          { duration: flightMs, easing: exitEase, fill: "forwards" },
        ),
      );
      add(flightFrame(media, landing, flip, true));
    } else
      add(
        run(
          media,
          [
            { opacity: 1, transform: "none" },
            { opacity: 0, transform: "scale(0.97)" },
          ],
          { duration: 360, easing: exitEase, fill: "forwards" },
        ),
      );
    if (!pending.length) {
      settle();
      return;
    }
    void Promise.all(pending.map((animation) => animation.finished)).then(
      settle,
      settle,
    );
    window.setTimeout(settle, flightMs + 400);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count, origin, startIndex, resetZoom]);

  const go = useCallback(
    (direction: number) => {
      if (closing.current || count < 2) return;
      resetZoom();
      setPos((value) => value + direction);
    },
    [count, resetZoom],
  );

  // The caption sits right under the photograph: the photograph gets what is left (never shrinks back).
  const captionRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const caption = captionRef.current;
    const host = dialog.current;
    if (!caption || !host || typeof ResizeObserver === "undefined") return;
    let tallest = 0;
    const measure = () => {
      // Only the text block: the transient loading line must not shrink the photograph.
      const body = caption.querySelector<HTMLElement>(".focus-caption-body");
      const next = Math.ceil(body?.offsetHeight ?? caption.offsetHeight);
      if (next <= tallest) return;
      tallest = next;
      host.style.setProperty("--fv-cap", `${next + 22}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(caption);
    const body = caption.querySelector(".focus-caption-body");
    if (body) observer.observe(body);
    return () => observer.disconnect();
  }, []);

  // Decoded full-size loading for the current photograph and its neighbours.
  useEffect(() => {
    const session = new PhotoViewerModel(
      photos.map((photo) => photo.large_url),
      startIndex,
      decodedImageRequest,
      setView,
    );
    model.current = session;
    session.select(indexRef.current);
    return () => {
      session.dispose();
      model.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    model.current?.select(index);
    // The row behind the veil follows, so closing lands on the last viewed image.
    const segments = origin.rail?.querySelectorAll<HTMLElement>(
      ".rail-segments button",
    );
    if (segments && segments.length === count) segments[index]?.click();
  }, [index, count, origin]);

  // History, keyboard and wheel.
  useEffect(() => {
    const el = dialog.current!;
    if (history.state?.wanderLightbox !== id)
      history.pushState(
        {
          ...history.state,
          idx: (history.state?.idx || 0) + 1,
          wanderLightbox: id,
        },
        "",
      );
    const pop = () => {
      if (history.state?.wanderLightbox === id) return;
      if (waitingPop.current) complete();
      else beginClose();
    };
    const key = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey && !event.altKey) {
        const factor = event.key === "+" || event.key === "=" ? 1.5 : event.key === "-" || event.key === "_" ? 1 / 1.5 : 0;
        if (factor || event.key === "0") {
          event.preventDefault();
          const g = geometry();
          if (!g || closing.current) return;
          applyZoom(
            event.key === "0"
              ? viewerZoomIdle
              : viewerZoomAt(zoom.current, { x: 0, y: 0 }, zoom.current.scale * factor, g.media, g.stage),
            false,
          );
          return;
        }
      }
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();
        go(event.key === "ArrowRight" ? 1 : -1);
        return;
      }
      const onControl =
        event.target instanceof HTMLElement &&
        event.target.closest("button, a") !== null;
      if (
        ["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(
          event.key,
        ) ||
        (event.key === " " && !onControl)
      )
        event.preventDefault();
    };
    let step: ViewerStepGesture = viewerStepIdle;
    let vertical: ViewerWheel = { time: -Infinity, total: 0 };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      if (closing.current) return;
      const scale =
        event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      const g = geometry();
      if (event.ctrlKey) {
        // Trackpad pinch arrives as ctrl + wheel.
        if (g)
          applyZoom(
            viewerWheelZoom(zoom.current, event.deltaY * scale, g.focal(event.clientX, event.clientY), g.media, g.stage),
            true,
          );
        return;
      }
      if (g && viewerIsZoomed(zoom.current)) {
        // Enlarged: scrolling moves the photograph; it neither pages nor closes.
        applyZoom(
          viewerPan(zoom.current, -event.deltaX * scale, -event.deltaY * scale, g.media, g.stage),
          true,
        );
        return;
      }
      const shifted = event.shiftKey && !event.deltaX;
      const dx = (shifted ? event.deltaY : event.deltaX) * scale;
      const dy = (shifted ? 0 : event.deltaY) * scale;
      const now = performance.now();
      const horizontal = viewerStepWheel(step, now, dx, dy);
      step = horizontal.state;
      if (horizontal.direction) go(horizontal.direction);
      const down = viewerWheel(vertical, now, dx, dy);
      vertical = down.state;
      if (down.close) beginClose();
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("keydown", key);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("keydown", key);
      el.removeEventListener("wheel", wheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [go, beginClose, geometry, applyZoom]);

  if (!count) return null;
  const detail = photos[view.visible ?? index];

  return (
    <dialog
      ref={dialog}
      className="focus-view"
      role="dialog"
      aria-modal="true"
      aria-label={t("Photograph viewer", "Fotoansicht")}
      data-tone={origin.dark ? "dark" : "light"}
      data-leaving={leaving || undefined}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        beginClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) beginClose();
      }}
    >
      <div ref={scrim} className="focus-scrim" aria-hidden="true" />
      <SignatureWordmark
        tone={origin.dark ? "light" : "dark"}
        className="focus-wordmark"
      />
      <button
        type="button"
        className="focus-close"
        aria-label={t("Close photograph viewer", "Fotoansicht schließen")}
        onClick={beginClose}
      >
        <X size={20} strokeWidth={1.25} />
      </button>
      <div
        ref={stage}
        className="focus-stage"
        onClick={(event) => {
          if (justPanned.current) {
            justPanned.current = false;
            return;
          }
          if (event.target === event.currentTarget) beginClose();
        }}
        onPointerDown={(event) => {
          justPanned.current = false;
          if (event.pointerType !== "mouse" || event.button !== 0 || !viewerIsZoomed(zoom.current)) return;
          if (!(event.target instanceof Element) || !event.target.closest("[data-center] .focus-media")) return;
          pan.current = { x: event.clientX, y: event.clientY, zoom: zoom.current, mouse: event.pointerId };
        }}
        onPointerMove={(event) => {
          const start = pan.current;
          if (!start || start.mouse !== event.pointerId) return;
          const g = geometry();
          if (!g) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (Math.hypot(dx, dy) > 3) justPanned.current = true;
          applyZoom(viewerPan(start.zoom, dx, dy, g.media, g.stage), true);
        }}
        onPointerUp={(event) => {
          if (pan.current?.mouse !== event.pointerId) return;
          pan.current = null;
          applyZoom(zoom.current, false);
        }}
        onPointerCancel={(event) => {
          if (pan.current?.mouse !== event.pointerId) return;
          pan.current = null;
          applyZoom(zoom.current, false);
        }}
        onTouchStart={(event) => {
          if (closing.current) return;
          const g = geometry();
          if (event.touches.length === 2 && g) {
            // Two fingers: pinch. Any swipe in progress is dropped.
            touch.current = null;
            pan.current = null;
            releaseDrag();
            const [a, b] = [event.touches[0], event.touches[1]];
            pinch.current = {
              zoom: zoom.current,
              distance: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
              mid: g.focal((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2),
            };
            applyZoom(zoom.current, true);
            return;
          }
          const first = event.touches[0];
          touch.current =
            event.touches.length === 1
              ? { x: first.clientX, y: first.clientY, time: event.timeStamp }
              : null;
          // Enlarged: a single finger moves the photograph.
          pan.current =
            first && event.touches.length === 1 && viewerIsZoomed(zoom.current)
              ? { x: first.clientX, y: first.clientY, zoom: zoom.current }
              : null;
        }}
        onTouchMove={(event) => {
          const g = geometry();
          if (pinch.current && event.touches.length >= 2 && g) {
            const [a, b] = [event.touches[0], event.touches[1]];
            applyZoom(
              viewerPinch(
                pinch.current,
                g.focal((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2),
                Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
                g.media,
                g.stage,
              ),
              true,
            );
            return;
          }
          if (pan.current && event.touches[0] && g) {
            applyZoom(
              viewerPan(
                pan.current.zoom,
                event.touches[0].clientX - pan.current.x,
                event.touches[0].clientY - pan.current.y,
                g.media,
                g.stage,
              ),
              true,
            );
            return;
          }
          const start = touch.current;
          if (!start || !event.touches[0]) return;
          const gesture = viewerTouch(
            event.touches[0].clientX - start.x,
            event.touches[0].clientY - start.y,
          );
          if (gesture.close) {
            touch.current = null;
            releaseDrag();
            beginClose();
            return;
          }
          const dx = event.touches[0].clientX - start.x;
          const dy = event.touches[0].clientY - start.y;
          const element = stage.current;
          if (
            element &&
            !motionRef.current &&
            Math.abs(dx) > 6 &&
            Math.abs(dx) > Math.abs(dy)
          ) {
            element.setAttribute("data-dragging", "");
            element.style.setProperty(
              "--fv-drag",
              `${viewerDrag(dx, element.clientWidth * 0.5, count > 1)}px`,
            );
          }
        }}
        onTouchEnd={(event) => {
          const start = touch.current;
          touch.current = null;
          releaseDrag();
          if (pinch.current) {
            // Pinch ends; a finger that stays down carries on as a pan, otherwise settle.
            pinch.current = null;
            const rest = event.touches[0];
            pan.current =
              rest && event.touches.length === 1 && viewerIsZoomed(zoom.current)
                ? { x: rest.clientX, y: rest.clientY, zoom: zoom.current }
                : null;
            if (!rest) applyZoom(zoom.current, false);
            return;
          }
          const wasPanning = pan.current !== null;
          pan.current = null;
          if (wasPanning) applyZoom(zoom.current, false);
          const end = event.changedTouches[0];
          if (!start || !end) return;
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          if (
            viewerIsTap(dx, dy, event.timeStamp - start.time) &&
            event.target instanceof Element &&
            event.target.closest("[data-center] .focus-media")
          ) {
            const tap = { time: event.timeStamp, x: end.clientX, y: end.clientY };
            if (viewerIsDoubleTap(lastTap.current, tap)) {
              lastTap.current = null;
              lastTouchZoom.current = performance.now();
              toggleZoomAt(tap.x, tap.y);
            } else lastTap.current = tap;
            return;
          }
          if (wasPanning) return;
          const gesture = viewerTouch(dx, dy);
          if (gesture.step) go(gesture.step);
        }}
        onTouchCancel={() => {
          touch.current = null;
          pinch.current = null;
          if (pan.current) applyZoom(zoom.current, false);
          pan.current = null;
          releaseDrag();
        }}
      >
        {focusOffsets(count).map((offset) => {
          const position = pos + offset;
          const slide = photos[viewerIndex(position, count)];
          const center = offset === 0;
          const ratio =
            slide.width > 0 && slide.height > 0 ? slide.width / slide.height : 1.5;
          return (
            <div
              key={position}
              className="focus-slide"
              data-offset={offset}
              data-center={center || undefined}
              aria-hidden={center ? undefined : true}
              style={{ "--o": offset, "--ar": ratio } as CSSProperties}
            >
              <div
                className="focus-media"
                onClick={center ? undefined : () => go(offset)}
                onDoubleClick={
                  center
                    ? (event) => {
                        // A touch double tap already toggled on touch end.
                        if (performance.now() - lastTouchZoom.current < 800) return;
                        toggleZoomAt(event.clientX, event.clientY);
                      }
                    : undefined
                }
              >
                <div className="focus-zoom">
                <img
                  src={slide.url}
                  srcSet={slide.srcset || undefined}
                  sizes="(max-width: 760px) 100vw, 94vw"
                  alt={center ? slide.alt || slide.description || slide.title || "" : ""}
                  width={slide.width}
                  height={slide.height}
                  decoding="async"
                  draggable={false}
                />
                {center && view.visible === index && (
                  <img
                    className="focus-large"
                    src={slide.large_url}
                    alt=""
                    aria-hidden="true"
                    width={slide.width}
                    height={slide.height}
                    decoding="async"
                    draggable={false}
                  />
                )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {zoomed && (
        <button
          type="button"
          className="focus-zoom-reset"
          aria-label={t("Reset zoom", "Zoom zurücksetzen")}
          title={t("Reset zoom", "Zoom zurücksetzen")}
          onClick={() => applyZoom(viewerZoomIdle, false)}
        >
          <ZoomOut size={20} strokeWidth={1.25} />
        </button>
      )}
      {count > 1 && (
        <>
          <button
            type="button"
            className="focus-arrow focus-arrow-prev"
            aria-label={t("Previous photograph", "Vorheriges Foto")}
            onClick={() => go(-1)}
          >
            <ChevronLeft size={20} strokeWidth={1.25} />
          </button>
          <button
            type="button"
            className="focus-arrow focus-arrow-next"
            aria-label={t("Next photograph", "Nächstes Foto")}
            onClick={() => go(1)}
          >
            <ChevronRight size={20} strokeWidth={1.25} />
          </button>
        </>
      )}
      <div ref={captionRef} className="focus-caption" aria-busy={view.status === "loading"}>
        <div key={view.visible ?? index} className="focus-caption-body">
        {detail?.edits?.show_title && detail.title?.trim() && (
          <p className="focus-title">{detail.title}</p>
        )}
        {detail?.description && (
          <p className="focus-text">{detail.description}</p>
        )}
        <p className="focus-meta">
          <span className="focus-count" aria-live="polite">
            {(view.visible ?? index) + 1} / {count}
          </span>
        </p>
        </div>
        {view.status !== "ready" && (
          <p className="focus-status" role="status" aria-live="polite">
            {view.status === "error"
              ? t(
                  "Could not load photograph",
                  "Foto konnte nicht geladen werden",
                )
              : t("Loading photograph", "Foto wird geladen")}{" "}
            {view.target + 1} / {count}
            {view.status === "error" && (
              <>
                {" "}
                <button
                  type="button"
                  className="focus-retry"
                  onClick={() => model.current?.retry()}
                >
                  {t("Try again", "Erneut versuchen")}
                </button>
              </>
            )}
          </p>
        )}
      </div>
    </dialog>
  );
}
