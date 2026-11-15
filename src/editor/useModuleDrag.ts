import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { t } from "../I18n";
import { moveModule, stepModule } from "../moduleOrder";
import { moduleDropTarget, moduleScrollSpeed, moduleTransferTarget } from "../moduleDrag";
import { idReassigned, reassignedFocusId } from "./compositionModel";
import type { Chapter, Journey } from "../types";

/** The slot the dragged module would land in; `inside` puts it into a chapter. */
export type DragTarget = {
  id: number;
  target: number;
  after: boolean;
  inside?: boolean;
} | null;

export type ModuleDragOptions = {
  draftRef: MutableRefObject<Journey | null>;
  change: (patch: Partial<Journey>) => void;
  /** An ongoing drag is cancelled whenever this changes (view, tab or journey). */
  resetKey: string;
};

/**
 * Reordering modules in the navigator: pointer drag with edge scrolling,
 * keyboard moves and the screen-reader announcement. The geometry lives in moduleDrag.ts.
 */
export function useModuleDrag({ draftRef, change, resetKey }: ModuleDragOptions) {
  const [drag, setDrag] = useState<DragTarget>(null);
  const dragStart = useRef<{
    id: number;
    y: number;
    active: boolean;
    pointerId: number;
    clientX: number;
    clientY: number;
    /** The row (or grip) that owns the gesture; it takes the pointer capture once dragging. */
    handle: HTMLElement;
    /** Touch: dragging needs a 250 ms hold so the list stays scrollable. */
    timer: number | null;
    touch: boolean;
  } | null>(null);
  /** The click that ends a drag must not also select the row. */
  const suppressClick = useRef(false);
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const dragTarget = useRef<typeof drag>(null);
  const dragFrame = useRef<number | null>(null);
  const [moveAnnouncement, setMoveAnnouncement] = useState("");
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancelDrag();
    };
    const hidden = () => { if (document.hidden) cancelDrag(); };
    // Once a touch drag is armed, the finger moves the module instead of scrolling the list.
    const holdScroll = (event: TouchEvent) => {
      if (dragStart.current?.active) event.preventDefault();
    };
    document.addEventListener("keydown", escape);
    document.addEventListener("touchmove", holdScroll, { passive: false });
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("blur", cancelDrag);
    return () => {
      cancelDrag();
      document.removeEventListener("keydown", escape);
      document.removeEventListener("touchmove", holdScroll);
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("blur", cancelDrag);
    };
  }, [resetKey]);
  function focusMoveHandle(id: number, reveal = false) {
    requestAnimationFrame(() => {
      const handle = document.querySelector<HTMLButtonElement>(
        `.module-navigator [data-module-id="${id}"] > .module-drag-handle`,
      );
      handle?.focus({ preventScroll: true });
      if (reveal) handle?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  }
  function announceMove(chapters: Chapter[], id: number) {
    const source = chapters.find((c) => c.id === id);
    if (!source) return;
    const peers = chapters.filter(
      (c) => (c.layout?.parent_id || null) === (source.layout?.parent_id || null),
    );
    setMoveAnnouncement(`${source.title}: ${t("Position", "Position")} ${peers.indexOf(source) + 1} ${t("of", "von")} ${peers.length}`);
  }
  function reorder(id: number, dir: number, fromHandle = false) {
    cancelDrag();
    const current = draftRef.current;
    if (!current) return;
    const source = current.chapters.find((c) => c.id === id);
    if (!source) return;
    // At the edge of a day the module steps out of it, next to a day it steps in.
    const chapters = stepModule(current.chapters, id, dir > 0 ? 1 : -1);
    if (chapters !== current.chapters) {
      change({ chapters });
      announceMove(chapters, id);
      if (fromHandle) focusMoveHandle(id, true);
    }
  }

  function cancelDrag() {
    const start = dragStart.current;
    dragStart.current = null;
    if (start?.timer != null) window.clearTimeout(start.timer);
    dragTarget.current = null;
    setDraggingId(null);
    if (start?.active)
      setMoveAnnouncement(t("Move cancelled.", "Verschieben abgebrochen."));
    if (dragFrame.current !== null) cancelAnimationFrame(dragFrame.current);
    dragFrame.current = null;
    setDrag(null);
    if (start?.handle.hasPointerCapture(start.pointerId))
      start.handle.releasePointerCapture(start.pointerId);
  }
  function updateDragTarget() {
    const start = dragStart.current;
    const current = draftRef.current;
    if (!start?.active || !current) return;
    const source = current.chapters.find((c) => c.id === start.id);
    const panel = start.handle.closest<HTMLElement>(".module-navigator");
    if (!source || !panel) return;
    const bounds = panel.getBoundingClientRect();
    const inside = start.clientX >= bounds.left && start.clientX <= bounds.right &&
      start.clientY >= Math.max(0, bounds.top) &&
      start.clientY <= Math.min(window.innerHeight, bounds.bottom);
    const peers = new Set(current.chapters.filter((c) =>
      source.kind !== "chapter" || !c.layout?.parent_id,
    ).map((c) => c.id));
    const rows = Array.from(panel.querySelectorAll<HTMLElement>("[data-module-id]"))
      .filter((row) => peers.has(Number(row.dataset.moduleId)))
      .map((row) => {
        const chapter = current.chapters.find((c) => c.id === Number(row.dataset.moduleId));
        const rect = (source.kind === "chapter" ? row : row.querySelector(".module-nav-select") || row).getBoundingClientRect();
        return {
          id: Number(row.dataset.moduleId), top: rect.top, bottom: rect.bottom, left: rect.left,
          chapter: chapter?.kind === "chapter", parent: chapter?.layout?.parent_id || null,
        };
      });
    const target: typeof drag = inside ? (source.kind === "chapter"
      ? moduleDropTarget(rows, start.id, start.clientY)
      : moduleTransferTarget(rows, start.id, start.clientY, start.clientX)) : null;
    const old = dragTarget.current;
    dragTarget.current = target;
    if (old?.id !== target?.id || old?.target !== target?.target || old?.after !== target?.after || old?.inside !== target?.inside)
      setDrag(target);
  }
  function startDragScroll() {
    let previous = performance.now();
    const frame = (now: number) => {
      const start = dragStart.current;
      if (!start?.active) return;
      const panel = start.handle.closest<HTMLElement>(".module-navigator");
      if (!panel) { cancelDrag(); return; }
      const bounds = panel.getBoundingClientRect();
      // On mobile the navigator grows with the document; desktop owns its scroll.
      const ownScroll = panel.scrollHeight > panel.clientHeight + 1;
      const scroller = ownScroll ? panel : document.scrollingElement;
      const insideX = start.clientX >= bounds.left && start.clientX <= bounds.right;
      const speed = insideX ? moduleScrollSpeed(start.clientY,
        Math.max(0, bounds.top), Math.min(window.innerHeight, bounds.bottom)) : 0;
      if (scroller && speed) {
        scroller.scrollTo({
          top: scroller.scrollTop + speed * Math.min(32, now - previous) / 1000,
          behavior: "instant",
        });
      }
      previous = now;
      updateDragTarget();
      dragFrame.current = requestAnimationFrame(frame);
    };
    dragFrame.current = requestAnimationFrame(frame);
  }
  /**
   * Saving gives a new module its real ID, which replaces its keyed row. Cancel an
   * in-flight gesture before that and return keyboard focus to the same module.
   */
  function settleAfterIdChange(idMap: Map<number, number>) {
    const focusedHandle = document.activeElement;
    const focusedControl = focusedHandle?.classList.contains("module-delete-button") ? "module-delete-button" : "module-drag-handle";
    const focusedId = focusedHandle?.classList.contains(focusedControl)
      ? Number(
          (focusedHandle.closest("[data-module-id]") as HTMLElement)?.dataset
            .moduleId,
        )
      : null;
    if (dragStart.current && idReassigned(dragStart.current.id, idMap)) {
      cancelDrag();
    }
    const focusId = reassignedFocusId(focusedId, idMap);
    if (focusId !== null)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLButtonElement>(
            `[data-module-id="${focusId}"] > .${focusedControl}`,
          )
          ?.focus({ preventScroll: true }),
      );
  }
  function activate(start: NonNullable<typeof dragStart.current>) {
    start.active = true;
    try {
      if (!start.handle.hasPointerCapture(start.pointerId))
        start.handle.setPointerCapture(start.pointerId);
    } catch { /* the pointer is already gone */ }
    setDraggingId(start.id);
    setMoveAnnouncement(t("Moving module. Escape to cancel.", "Modul wird verschoben. Escape zum Abbrechen."));
    startDragScroll();
  }
  /** Keyboard handlers for the grip button: Up/Down moves the module. */
  function dragHandleProps(id: number) {
    return {
      onClick: (e: ReactMouseEvent<HTMLButtonElement>) => e.stopPropagation(),
      onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          reorder(id, e.key === "ArrowUp" ? -1 : 1, true);
        }
        if (e.key === "Escape") cancelDrag();
      },
    };
  }
  /**
   * Pointer handlers for a whole module row: thumbnail, name and grip all pick it up.
   * A short click still selects; other buttons (delete) never start a drag.
   */
  function rowDragProps(id: number) {
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button !== 0 || !e.isPrimary || dragStart.current) return;
        const target = e.target as Element;
        // Nested rows and the gaps between a day's children belong to the inner list.
        if (target.closest(".module-nav-children, [data-module-id]") !== e.currentTarget) return;
        const control = target.closest("button, input, select, textarea, a");
        if (control && !control.matches(".module-drag-handle, .module-nav-select")) return;
        suppressClick.current = false;
        const touch = e.pointerType === "touch";
        const start = {
          id, y: e.clientY, active: false, pointerId: e.pointerId,
          clientX: e.clientX, clientY: e.clientY, handle: e.currentTarget,
          timer: null as number | null, touch,
        };
        dragStart.current = start;
        if (touch)
          start.timer = window.setTimeout(() => {
            start.timer = null;
            if (dragStart.current !== start) return;
            activate(start);
            updateDragTarget();
          }, 250);
      },
      onPointerMove: (e: ReactPointerEvent<HTMLElement>) => {
        const start = dragStart.current;
        if (!start || start.id !== id || start.pointerId !== e.pointerId) return;
        const moved = Math.hypot(e.clientX - start.clientX, e.clientY - start.y);
        start.clientX = e.clientX;
        start.clientY = e.clientY;
        if (!start.active) {
          // Touch: moving before the hold ends means scrolling, not dragging.
          if (start.touch) {
            if (moved >= 6) cancelDrag();
            return;
          }
          if (Math.abs(e.clientY - start.y) < 6) return;
          activate(start);
        }
        updateDragTarget();
      },
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => {
        const start = dragStart.current;
        if (!start || start.id !== id || start.pointerId !== e.pointerId) return;
        const target = dragTarget.current;
        const current = draftRef.current;
        if (start.active) suppressClick.current = true;
        cancelDrag();
        // Commit exactly the previewed slot; a release alone never starts a drag.
        if (start.active && target && current) {
          const panel = start.handle.closest<HTMLElement>(".module-navigator");
          const bounds = panel?.getBoundingClientRect();
          if (bounds && e.clientX >= bounds.left && e.clientX <= bounds.right &&
              e.clientY >= Math.max(0, bounds.top) &&
              e.clientY <= Math.min(window.innerHeight, bounds.bottom)) {
            const chapters = moveModule(current.chapters, target.id, target.target, target.after, target.inside ? "inside" : "transfer");
            if (chapters !== current.chapters) {
              change({ chapters });
              announceMove(chapters, start.id);
              focusMoveHandle(start.id);
            }
          }
        }
      },
      onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => {
        if (dragStart.current?.pointerId === e.pointerId) cancelDrag();
      },
      onLostPointerCapture: (e: ReactPointerEvent<HTMLElement>) => {
        if (dragStart.current?.id === id && dragStart.current.pointerId === e.pointerId) cancelDrag();
      },
      onClickCapture: (e: ReactMouseEvent<HTMLElement>) => {
        if (!suppressClick.current) return;
        suppressClick.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
      onContextMenu: (e: ReactMouseEvent<HTMLElement>) => {
        // A long press on touch opens no menu while a module is held.
        if (dragStart.current?.touch) e.preventDefault();
      },
    };
  }
  return {
    drag,
    draggingId,
    moveAnnouncement,
    cancelDrag,
    reorder,
    dragHandleProps,
    rowDragProps,
    settleAfterIdChange,
  };
}
