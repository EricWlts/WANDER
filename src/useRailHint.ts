import { useEffect, type RefObject } from "react";
import { useMotionOff } from "./Motion";
/** A small invitation to scroll. Manual horizontal input always wins. */
export function useRailHint(
  ref: RefObject<HTMLDivElement | null>,
  contentKey: string,
) {
  const off = useMotionOff();
  useEffect(() => {
    const el = ref.current;
    if (!el || off) return;
    const win = el.ownerDocument.defaultView || window;
    let visible = false,
      blocked = false,
      pointerDown = false,
      frame = 0,
      lastManual = 0,
      started = 0,
      previous = 0,
      moved = 0,
      origin = 0;
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };
    const manual = () => {
      el.dataset.hintState = "manual";
      blocked = true;
      lastManual = performance.now();
      stop();
    };
    const draw = (now: number) => {
      frame = 0;
      if (!visible || blocked || pointerDown || el.ownerDocument.hidden) return;
      el.dataset.hintState = "active";
      if (!previous) previous = now;
      const distance = Math.min(24, ((now - previous) / 1000) * 11);
      previous = now;
      if (now - started > 350) {
        moved = Math.min(36, moved + distance);
        el.scrollLeft = origin + moved;
      }
      if (moved < 36 && el.scrollLeft < el.scrollWidth - el.clientWidth - 1)
        frame = requestAnimationFrame(draw);
    };
    const start = () => {
      if (
        !visible ||
        blocked ||
        pointerDown ||
        frame ||
        el.scrollWidth <= el.clientWidth
      )
        return;
      started = performance.now();
      previous = 0;
      moved = 0;
      origin = el.scrollLeft;
      frame = requestAnimationFrame(draw);
    };
    const rearm = () => {
      if (pointerDown || performance.now() - lastManual < 700) return;
      blocked = false;
      start();
    };
    const wheel = (event: WheelEvent) => {
      if (
        el.contains(event.target as Node) &&
        (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey)
      )
        manual();
      else if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) rearm();
    };
    const down = () => {
      pointerDown = true;
      manual();
    };
    const up = () => {
      pointerDown = false;
    };
    const key = (event: KeyboardEvent) => {
      if (
        el.contains(event.target as Node) &&
        ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
      )
        manual();
      else if (
        ["PageUp", "PageDown", "ArrowUp", "ArrowDown", " "].includes(event.key)
      )
        rearm();
    };
    const scroll = () => {
      if (blocked) lastManual = performance.now();
    };
    let touch: { x: number; y: number } | null = null;
    const touchStart = (e: TouchEvent) => {
      touch = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    const touchMove = (e: TouchEvent) => {
      if (!touch || !e.touches[0]) return;
      const dx = e.touches[0].clientX - touch.x,
        dy = e.touches[0].clientY - touch.y;
      if (el.contains(e.target as Node) && Math.abs(dx) > Math.abs(dy))
        manual();
      else if (Math.abs(dy) > 8) rearm();
    };
    const observer = new IntersectionObserver(
      ([entry]) => {
        const entering = !visible && entry.isIntersecting;
        visible = entry.isIntersecting;
        el.dataset.hintState = visible ? "visible" : "offscreen";
        if (!visible) stop();
        else if (entering) start();
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    const windows = win === window ? [win] : [win, window];
    windows.forEach((w) => {
      w.addEventListener("wheel", wheel, { passive: true });
      w.addEventListener("keydown", key);
      w.addEventListener("pointerup", up);
      w.addEventListener("pointercancel", up);
      w.addEventListener("touchstart", touchStart, { passive: true });
      w.addEventListener("touchmove", touchMove, { passive: true });
    });
    el.addEventListener("pointerdown", down);
    el.addEventListener("scroll", scroll, { passive: true });
    return () => {
      stop();
      observer.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("scroll", scroll);
      windows.forEach((w) => {
        w.removeEventListener("wheel", wheel);
        w.removeEventListener("keydown", key);
        w.removeEventListener("pointerup", up);
        w.removeEventListener("pointercancel", up);
        w.removeEventListener("touchstart", touchStart);
        w.removeEventListener("touchmove", touchMove);
      });
    };
  }, [ref, off, contentKey]);
}
