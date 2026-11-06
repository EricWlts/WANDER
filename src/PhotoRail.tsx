import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Picture } from "./components";
import { imageParallax } from "./imageParallax";
import { t, useLocale } from "./I18n";
import { useMotionOff } from "./Motion";
import { railDirection, railEdgeCopies, railIndex, railPhoto, railWheel, type RailWheelBurst } from "./photoRailModel";
import { effectivePhotoRatio } from "./storyLayout";
import type { Layout, Photo } from "./types";

type RailProps = { photos: Photo[]; onPhoto: (photo: Photo) => void; layout?: Layout };
type Navigation = { step: number } | { index: number };

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
  const animation = useRef<Animation | null>(null);
  const pending = useRef<Navigation[]>([]);
  const [index, setIndex] = useState(0);
  const drag = useRef<{ id: number; x: number; y: number; axis?: "x" | "y" } | null>(null);
  const suppressClick = useRef(false);
  const count = photos.length;
  const copies = count > 1 ? railEdgeCopies : 0;
  const whole = layout?.rail_mode === "single";

  function centered(position: number) {
    const strip = track.current!;
    const frame = strip.children[position + copies].getBoundingClientRect();
    return `translateX(${viewport.current!.getBoundingClientRect().width / 2 - (frame.left - strip.getBoundingClientRect().left + frame.width / 2)}px)`;
  }

  function navigate(action: Navigation) {
    if (count < 2 || !track.current) return;
    if (animation.current) {
      if ("index" in action) pending.current = [action];
      else pending.current.push(action);
      return;
    }
    const from = active.current;
    let target = "step" in action ? from + action.step : action.index;
    // Direct edge-to-edge selection follows the adjacent copy too.
    if ("index" in action && count > 2) {
      if (from === 0 && target === count - 1) target = -1;
      if (from === count - 1 && target === 0) target = count;
    }
    const next = railIndex(target, count);
    if (next === from) return;
    const strip = track.current;
    if (strip.contains(strip.ownerDocument.activeElement)) {
      viewport.current?.focus({ preventScroll: true });
    }
    active.current = next;
    setIndex(next);
    const final = centered(next);
    if (motionOff || !strip.animate) {
      strip.style.transform = final;
      return;
    }
    const move = strip.animate(
      [{ transform: centered(from) }, { transform: centered(target) }],
      { duration: 210, easing: "cubic-bezier(.22,.65,.28,1)", fill: "both" },
    );
    animation.current = move;
    move.onfinish = () => {
      if (animation.current !== move) return;
      // The copied slide and its neighbours match the originals at this frame.
      strip.style.transform = final;
      move.cancel();
      animation.current = null;
      while (!animation.current && pending.current.length) {
        navigate(pending.current.shift()!);
      }
    };
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
      pending.current = [];
      strip.style.transform = centered(active.current);
    };
    const observer = new ResizeObserver(align);
    observer.observe(element);
    observer.observe(strip);
    align();
    let burst: RailWheelBurst = { time: -Infinity, distance: 0, stepped: false };
    const onWheel = (event: WheelEvent) => {
      if (count < 2 || event.ctrlKey || event.metaKey) return;
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1;
      const shifted = event.shiftKey && !event.deltaX;
      const result = railWheel(burst, performance.now(),
        (shifted ? event.deltaY : event.deltaX) * scale, (shifted ? 0 : event.deltaY) * scale);
      burst = result.burst;
      if (result.consume && event.cancelable) event.preventDefault();
      if (result.direction) navigate({ step: result.direction });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      observer.disconnect();
      element.removeEventListener("wheel", onWheel);
      animation.current?.cancel();
      animation.current = null;
      pending.current = [];
    };
    // Sequence changes remount Carousel. Changes to motion realign the active slide.
  }, [count, copies, motionOff, whole]);

  return (
    <div className="photo-rail-shell editorial-carousel" data-whole={whole || undefined}>
      <div
        className="carousel-viewport"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label={t("Photograph carousel", "Fotokarussell")}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget || count < 2) return;
          const keys: Record<string, Navigation> = {
            ArrowLeft: { step: -1 }, ArrowRight: { step: 1 },
            Home: { index: 0 }, End: { index: count - 1 },
          };
          const action = keys[event.key];
          if (!action) return;
          event.preventDefault();
          if (!event.repeat) navigate(action);
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) return;
          suppressClick.current = false;
          if (count > 1) drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId || start.axis) return;
          const x = start.x - event.clientX;
          const y = start.y - event.clientY;
          if (railDirection(x, y, 10)) {
            start.axis = "x";
            suppressClick.current = true;
            event.currentTarget.setPointerCapture(event.pointerId);
          } else if (Math.abs(y) >= 10) start.axis = "y";
        }}
        onPointerLeave={(event) => {
          if (drag.current?.id === event.pointerId && drag.current.axis !== "x") drag.current = null;
        }}
        onPointerUp={(event) => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          drag.current = null;
          if (start.axis !== "x") return;
          const direction = railDirection(start.x - event.clientX, start.y - event.clientY, 36);
          if (direction) navigate({ step: direction });
        }}
        onPointerCancel={() => { drag.current = null; }}
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
            const photo = photos[logical];
            const current = position === index;
            const framed = railPhoto(photo, whole);
            // Seam copies and their originals must share one parallax visibility phase.
            const atSeam = position < copies || position >= count - copies;
            return (
              <figure
                key={position}
                inert={!current}
                aria-hidden={!current || undefined}
                data-active={current || undefined}
                onClick={(event) => event.stopPropagation()}
                style={{ "--frame-ratio": effectivePhotoRatio(framed) } as CSSProperties}
              >
                <Picture
                  parallax={imageParallax(layout).enabled}
                  parallaxVisibility={atSeam ? viewport : undefined}
                  photo={framed}
                  eager
                  onClick={() => onPhoto(photo)}
                  sizes="(max-width: 760px) 80vw, 70vw"
                />
                {photo.edits?.show_title && photo.title?.trim() && <figcaption>{photo.title}</figcaption>}
              </figure>
            );
          })}
        </div>
      </div>
      <div className="rail-indicators" onClick={(event) => event.stopPropagation()}>
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
        <span className="sr-only" aria-live="polite">
          {t(`Image ${index + 1} of ${count}`, `Bild ${index + 1} von ${count}`)}
        </span>
        {count > 1 && (
          <div className="rail-navigation">
            <button type="button" aria-label={t("Previous photograph", "Vorheriges Foto")} onClick={() => navigate({ step: -1 })}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label={t("Next photograph", "Nächstes Foto")} onClick={() => navigate({ step: 1 })}>
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
