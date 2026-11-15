import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Picture } from "./components";
import { fixedParallax } from "./fixedMotion";
import { t, useLocale } from "./I18n";
import { useMotionOff } from "./Motion";
import {
  railDirection,
  railDragOffset,
  railDuration,
  railEdgeCopies,
  railIndex,
  railKeyAction,
  railPhoto,
  railRelease,
  railVelocity,
  type RailInput,
  type RailSample,
} from "./photoRailModel";
import { viewerStepIdle, viewerStepWheel } from "./photoViewerModel";
import { effectivePhotoRatio } from "./storyLayout";
import type { Layout, Photo } from "./types";

type RailProps = { photos: Photo[]; onPhoto: (photo: Photo) => void; layout?: Layout };
type Navigation = { step: number } | { index: number };
type NavigateOptions = {
  /** What moved the rail; decides the glide time. Defaults to keys, buttons and wheel. */
  input?: RailInput;
  /** Pixel offset the glide starts from (a released drag); otherwise the current position. */
  from?: number;
  /** Release speed in px/ms, shortens a touch glide. */
  speed?: number;
  /** A released drag decelerates from its own speed instead of easing in. */
  release?: boolean;
};
type DragState = {
  id: number;
  x: number;
  y: number;
  type: string;
  axis?: "x" | "y";
  /** The track follows the finger (off when movement is off). */
  follow?: boolean;
  base?: number;
  slot?: number;
  shift?: number;
  samples?: RailSample[];
};

/** Dead zone that decides the axis; the track starts moving after it so it never jumps. */
const dragSlop = 10;
const glideEase = "cubic-bezier(0.45, 0.05, 0.15, 1)";
const releaseEase = "cubic-bezier(0.22, 1, 0.36, 1)";

export function PhotoRail(props: RailProps) {
  const key = props.photos.map((photo) => photo.placement_id || photo.id).join("\0");
  return props.photos.length ? <Carousel key={key} {...props} /> : null;
}

function Carousel({ photos, onPhoto, layout }: RailProps) {
  useLocale();
  const motionOff = useMotionOff();
  const viewport = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const active = useRef(0);
  /** Unwrapped slot currently travelled to; may sit on a seam copy mid-flight. */
  const visual = useRef(0);
  const animation = useRef<Animation | null>(null);
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const drag = useRef<DragState | null>(null);
  const onPhotoRef = useRef(onPhoto);
  onPhotoRef.current = onPhoto;
  const openPhoto = useCallback((photo: Photo) => onPhotoRef.current(photo), []);
  const suppressClick = useRef(false);
  const count = photos.length;
  const copies = count > 1 ? railEdgeCopies : 0;
  const whole = layout?.rail_mode === "single";
  const parallax = fixedParallax("rail").enabled;

  function offset(position: number) {
    const strip = track.current!;
    const frame = strip.children[position + copies] as HTMLElement;
    // Layout offsets ignore transforms, so mid-flight reads stay exact.
    return viewport.current!.clientWidth / 2 - (frame.offsetLeft + frame.offsetWidth / 2);
  }

  /** Rest on the real slide; the brief no-transition flag hides the copy swap. */
  function settle(next: number) {
    const strip = track.current;
    if (!strip) return;
    strip.dataset.settling = "";
    strip.style.transform = `translateX(${offset(next)}px)`;
    visual.current = next;
    setShown(next);
    requestAnimationFrame(() => requestAnimationFrame(() => { delete strip.dataset.settling; }));
  }

  function navigate(action: Navigation, options: NavigateOptions = {}) {
    if (count < 2 || !track.current) return;
    const strip = track.current;
    const from = visual.current;
    const base = railIndex(from, count);
    let goal = "step" in action ? base + action.step : action.index;
    // Direct edge-to-edge selection follows the adjacent copy too.
    if ("index" in action && count > 2) {
      if (base === 0 && goal === count - 1) goal = -1;
      if (base === count - 1 && goal === 0) goal = count;
    }
    let origin = from;
    let target = from + (goal - base);
    if (target === from) return;
    // The newest input wins: continue from wherever the glide currently is.
    let start = options.from ?? currentOffset(from);
    // Chained swipes past the copied seam re-base onto the identical real slides.
    if (target < -copies || target > count - 1 + copies) {
      const shift = target < 0 ? count : -count;
      start += offset(origin + shift) - offset(origin);
      origin += shift;
      target += shift;
    }
    const next = railIndex(target, count);
    if (strip.contains(strip.ownerDocument.activeElement)) {
      viewport.current?.focus({ preventScroll: true });
    }
    animation.current?.cancel();
    animation.current = null;
    visual.current = target;
    active.current = next;
    setIndex(next);
    setShown(target);
    if (motionOff || !strip.animate) {
      settle(next);
      return;
    }
    glide(start, offset(target), next, options);
  }

  /** Where the track is right now: mid-glide it is read from the running animation. */
  function currentOffset(from: number) {
    return animation.current
      ? new DOMMatrixReadOnly(getComputedStyle(track.current!).transform).m41
      : offset(from);
  }

  function glide(startPx: number, endPx: number, next: number, options: NavigateOptions) {
    const strip = track.current!;
    const input = options.input ?? "key";
    const duration = railDuration(input, options.speed);
    // Caption and neighbour fades follow the same clock as the glide.
    strip.style.setProperty("--rail-glide", `${duration}ms`);
    const move = strip.animate(
      [{ transform: `translateX(${startPx}px)` }, { transform: `translateX(${endPx}px)` }],
      { duration, easing: options.release || input === "touch" ? releaseEase : glideEase, fill: "both" },
    );
    animation.current = move;
    move.onfinish = () => {
      if (animation.current !== move) return;
      // The copied slide and its neighbours match the originals at this frame.
      settle(next);
      move.cancel();
      animation.current = null;
    };
  }

  /** Pointer moved the track by hand: take over from a running glide and note the slot width. */
  function beginDrag(state: DragState) {
    const strip = track.current!;
    const here = visual.current;
    const base = currentOffset(here);
    if (animation.current) {
      strip.style.transform = `translateX(${base}px)`;
      animation.current.cancel();
      animation.current = null;
    }
    const real = railIndex(here, count);
    state.base = base;
    state.slot = (Math.abs(offset(real + 1) - offset(real)) + Math.abs(offset(real - 1) - offset(real))) / 2;
    state.shift = 0;
    state.samples = [];
    state.follow = !motionOff && typeof strip.animate === "function";
  }

  function dragTo(state: DragState, shift: number, time: number) {
    state.shift = shift;
    const samples = state.samples!;
    samples.push({ time, shift });
    if (samples.length > 8) samples.shift();
    if (state.follow) {
      track.current!.style.transform = `translateX(${state.base! + railDragOffset(shift, state.slot!, dragSlop)}px)`;
    }
  }

  /** Let go: rest on the nearest photograph by speed or distance, or spring back. */
  function endDrag(state: DragState, time: number, cancelled: boolean) {
    const shift = state.shift ?? 0;
    const speed = cancelled ? 0 : railVelocity(state.samples ?? [], time);
    const step = cancelled ? 0 : railRelease(shift, speed, state.slot ?? 0);
    const input: RailInput = state.type === "mouse" ? "mouse" : "touch";
    const dragged = state.follow ? state.base! + railDragOffset(shift, state.slot!, dragSlop) : undefined;
    if (step) {
      navigate({ step }, { input, speed, from: dragged, release: true });
    } else if (dragged !== undefined) {
      // Spring back to where the track rested before the drag.
      const rest = visual.current;
      glide(dragged, offset(rest), railIndex(rest, count), { input, release: true });
    }
  }

  useLayoutEffect(() => {
    const element = viewport.current!;
    const strip = track.current!;
    let lastWidth = -1;
    let lastTrackWidth = -1;
    const align = () => {
      const width = element.clientWidth;
      const trackWidth = strip.getBoundingClientRect().width;
      if (width === lastWidth && trackWidth === lastTrackWidth) return;
      lastWidth = width;
      lastTrackWidth = trackWidth;
      animation.current?.cancel();
      animation.current = null;
      strip.style.transform = `translateX(${offset(active.current)}px)`;
      visual.current = active.current;
      setShown(active.current);
    };
    const observer = new ResizeObserver(align);
    observer.observe(element);
    observer.observe(strip);
    align();
    let gesture = viewerStepIdle;
    const onWheel = (event: WheelEvent) => {
      if (count < 2 || event.ctrlKey || event.metaKey) return;
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1;
      const shifted = event.shiftKey && !event.deltaX;
      const dx = (shifted ? event.deltaY : event.deltaX) * scale;
      const dy = (shifted ? 0 : event.deltaY) * scale;
      // Exactly one photograph per gesture; the momentum tail is locked out (see viewerStepWheel).
      const result = viewerStepWheel(gesture, performance.now(), dx, dy);
      gesture = result.state;
      // A mainly vertical gesture is never blocked: the page keeps scrolling.
      if (Math.abs(dx) > Math.abs(dy) * 1.2 && event.cancelable) event.preventDefault();
      if (result.direction) navigate({ step: result.direction });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener("wheel", onWheel);
      animation.current?.cancel();
      animation.current = null;
    };
    // Sequence changes remount Carousel. Changes to motion realign the active slide.
  }, [count, copies, motionOff, whole]);

  return (
    <div
      className="photo-rail-shell editorial-carousel"
      data-whole={whole || undefined}
      data-single={count === 1 || undefined}
      onKeyDown={(event) => {
        // Anywhere inside the carousel (photograph, arrows, segments), except form fields.
        const target = event.target instanceof HTMLElement ? event.target : null;
        const action = railKeyAction(event.key, count, {
          editable: !!target?.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])"),
          modified: event.altKey || event.ctrlKey || event.metaKey,
        });
        if (!action) return;
        event.preventDefault();
        if (!event.repeat) navigate(action, { input: "key" });
      }}
    >
      <div className="carousel-stage">
      <div
        className="carousel-viewport"
        ref={viewport}
        tabIndex={count > 1 ? 0 : undefined}
        role={count > 1 ? "region" : undefined}
        aria-roledescription={count > 1 ? t("carousel", "Karussell") : undefined}
        aria-label={count > 1 ? t("Photograph carousel", "Fotokarussell") : undefined}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          if (count > 1) drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, type: event.pointerType };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId || start.axis === "y") return;
          const x = start.x - event.clientX;
          const y = start.y - event.clientY;
          if (!start.axis) {
            if (railDirection(x, y, dragSlop)) {
              start.axis = "x";
              suppressClick.current = true;
              event.currentTarget.setPointerCapture(event.pointerId);
              beginDrag(start);
            } else if (Math.abs(y) >= dragSlop) {
              start.axis = "y";
              return;
            } else return;
          }
          dragTo(start, x, event.timeStamp);
        }}
        onPointerLeave={(event) => {
          if (drag.current?.id === event.pointerId && drag.current.axis !== "x") drag.current = null;
        }}
        onPointerUp={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          drag.current = null;
          if (start.axis === "x") endDrag(start, event.timeStamp, false);
        }}
        onPointerCancel={(event) => {
          const start = drag.current;
          drag.current = null;
          if (start?.axis === "x") endDrag(start, event.timeStamp, true);
        }}
        onLostPointerCapture={(event) => {
          // Touch starts with implicit capture on the image before it moves to the viewport.
          if (event.target === event.currentTarget) drag.current = null;
        }}
        onClickCapture={(event) => {
          if (!event.detail || !suppressClick.current) return;
          suppressClick.current = false;
          event.preventDefault();
          event.stopPropagation();
        }}
        onDragStart={(event) => event.preventDefault()}
      >
        <div className="carousel-track" ref={track}>
          {Array.from({ length: count + copies * 2 }, (_, slot) => {
            const position = slot - copies;
            const logical = railIndex(position, count);
            // Only the active photo and its direct neighbours load eagerly; seam copies and the rest wait.
            const isCopy = position < 0 || position >= count;
            return (
              <RailSlide
                key={position}
                photo={photos[logical]}
                whole={whole}
                current={position === shown}
                near={!isCopy && Math.abs(position - shown) <= 1}
                // Seam copies and their originals must share one parallax visibility phase.
                atSeam={position < copies || position >= count - copies}
                parallax={parallax}
                viewport={viewport}
                label={count > 1 ? t(`Image ${logical + 1} of ${count}`, `Bild ${logical + 1} von ${count}`) : undefined}
                onPhoto={openPhoto}
              />
            );
          })}
        </div>
      </div>
      {count > 1 && (
        <>
          <button type="button" className="rail-arrow rail-arrow-prev"
            aria-label={t("Previous photograph", "Vorheriges Foto")}
            onClick={(event) => { event.stopPropagation(); navigate({ step: -1 }); }}>
            <ChevronLeft size={20} strokeWidth={1.25} />
          </button>
          <button type="button" className="rail-arrow rail-arrow-next"
            aria-label={t("Next photograph", "Nächstes Foto")}
            onClick={(event) => { event.stopPropagation(); navigate({ step: 1 }); }}>
            <ChevronRight size={20} strokeWidth={1.25} />
          </button>
        </>
      )}
      </div>
      <div className="rail-indicators" hidden={count < 2} onClick={(event) => event.stopPropagation()}>
        <div className="rail-segments" style={{ "--rail-count": count } as CSSProperties}
          role="group" aria-label={t("Photograph position", "Bildposition")}>
          {photos.map((_, position) => (
            <button
              key={position}
              type="button"
              aria-label={t(`Show image ${position + 1} of ${count}`, `Bild ${position + 1} von ${count} anzeigen`)}
              aria-current={position === index ? "true" : undefined}
              onClick={() => navigate({ index: position })}
            ><span /></button>
          ))}
        </div>
        {count > 1 && (
          <span className="sr-only" aria-live="polite">
            {t(`Image ${index + 1} of ${count}`, `Bild ${index + 1} von ${count}`)}
          </span>
        )}
      </div>
    </div>
  );
}

type SlideProps = {
  photo: Photo;
  whole: boolean;
  current: boolean;
  near: boolean;
  atSeam: boolean;
  parallax: boolean;
  viewport: RefObject<HTMLDivElement | null>;
  /** "Image n of m"; absent for a single photograph, which is not a carousel. */
  label?: string;
  onPhoto: (photo: Photo) => void;
};

/** One frame of the track. Memoised: a step re-renders only the slides whose state changed. */
const RailSlide = memo(function RailSlide({ photo, whole, current, near, atSeam, parallax, viewport, label, onPhoto }: SlideProps) {
  const framed = useMemo(() => railPhoto(photo, whole), [photo, whole]);
  const style = useMemo(() => ({ "--frame-ratio": effectivePhotoRatio(framed) }) as CSSProperties, [framed]);
  const open = useCallback(() => onPhoto(photo), [onPhoto, photo]);
  return (
    <figure
      role={label ? "group" : undefined}
      aria-label={label}
      inert={!current}
      aria-hidden={!current || undefined}
      data-active={current || undefined}
      onClick={stopClick}
      style={style}
    >
      <Picture
        parallax={parallax}
        parallaxVisibility={atSeam ? viewport : undefined}
        photo={framed}
        eager={near}
        priority={near ? undefined : "low"}
        onClick={open}
        sizes="(max-width: 760px) 90vw, 75vw"
      />
      {photo.edits?.show_title && photo.title?.trim() && <figcaption>{photo.title}</figcaption>}
    </figure>
  );
});

function stopClick(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}
