import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from "lucide-react";
import { Picture } from "./components";
import { modulePhotos, placementsFor } from "./journalModel";
import { t } from "./I18n";
import type { Chapter, ImagePlacement, Journey, Layout, Photo } from "./types";
export function ModulePhotographs({
  module,
  journey,
  onChange,
  onPhoto,
  onDelete,
  deleteDisabled = false,
}: {
  module: Chapter;
  journey: Journey;
  onChange: (p: Partial<Layout>) => void;
  onPhoto: (p: Photo) => void;
  onDelete: (p: Photo) => void;
  deleteDisabled?: boolean;
}) {
  const frames = placementsFor(module, journey),
    photos = modulePhotos(module, journey),
    single = ["hero", "image"].includes(module.kind);
  const [libraryOpen, setLibraryOpen] = useState(!photos.length);
  function commit(next: ImagePlacement[]) {
    onChange({ placements: next });
  }
  /* Size switch only for balanced photo walls; "Normal" removes the key. */
  const wallBalanced = module.kind === "wall" && module.layout?.wall_mode === "balanced";
  const sizeOf = (id: string | undefined) => frames.find((f) => f.id === id)?.size ?? "m";
  function setSize(placementId: string | undefined, size: "s" | "m" | "l") {
    if (!placementId) return;
    commit(
      frames.map((f) => {
        if (f.id !== placementId) return f;
        const next = { ...f };
        if (size === "m") delete next.size;
        else next.size = size;
        return next;
      }),
    );
  }
  /* Drag to reorder the thumbnails (pointer); the arrows stay for the keyboard. */
  const drag = useRef<{ from: number; x: number; y: number; pointerId: number; active: boolean; touch: boolean; timer: number | null } | null>(null);
  const suppressClick = useRef(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  function nearest(x: number, y: number) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>(":scope > li") ?? []);
    let best = -1, dist = Infinity;
    items.forEach((li, i) => {
      const r = li.getBoundingClientRect();
      const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2));
      if (d < dist) { dist = d; best = i; }
    });
    return best;
  }
  function endDrag() {
    const state = drag.current;
    if (state?.timer != null) window.clearTimeout(state.timer);
    drag.current = null;
    setDragFrom(null);
    setDropAt(null);
  }
  const canDrag = photos.length > 1;
  useEffect(() => {
    // A held thumbnail moves with the finger instead of scrolling the panel.
    const hold = (event: TouchEvent) => { if (drag.current?.active) event.preventDefault(); };
    document.addEventListener("touchmove", hold, { passive: false });
    return () => document.removeEventListener("touchmove", hold);
  }, []);
  function thumbDrag(i: number) {
    if (!canDrag) return {};
    return {
      onPointerDown: (e: ReactPointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0 || !e.isPrimary || drag.current) return;
        suppressClick.current = false;
        const touch = e.pointerType === "touch";
        const state = { from: i, x: e.clientX, y: e.clientY, pointerId: e.pointerId, active: false, touch, timer: null as number | null };
        drag.current = state;
        const el = e.currentTarget;
        if (touch)
          state.timer = window.setTimeout(() => {
            state.timer = null;
            if (drag.current !== state) return;
            state.active = true;
            try { el.setPointerCapture(state.pointerId); } catch { /* gone */ }
            setDragFrom(i);
            setDropAt(i);
          }, 250);
      },
      onPointerMove: (e: ReactPointerEvent<HTMLButtonElement>) => {
        const state = drag.current;
        if (!state || state.pointerId !== e.pointerId) return;
        if (!state.active) {
          if (Math.hypot(e.clientX - state.x, e.clientY - state.y) < 6) return;
          if (state.touch) { endDrag(); return; }
          state.active = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragFrom(state.from);
        }
        e.preventDefault();
        setDropAt(nearest(e.clientX, e.clientY));
      },
      onPointerUp: (e: ReactPointerEvent<HTMLButtonElement>) => {
        const state = drag.current;
        if (!state || state.pointerId !== e.pointerId) return;
        if (state.active) {
          suppressClick.current = true;
          const to = nearest(e.clientX, e.clientY);
          if (to >= 0 && to !== state.from) {
            const next = [...frames];
            const [moved] = next.splice(state.from, 1);
            next.splice(to, 0, moved);
            commit(next);
          }
        }
        endDrag();
      },
      onPointerCancel: endDrag,
      onContextMenu: (e: { preventDefault: () => void }) => {
        if (drag.current?.touch) e.preventDefault();
      },
    };
  }
  return (
    <section
      className="inspector-images"
      aria-label={t("Image content", "Bildinhalt")}
    >
      <h4 className="inspector-images-title">
        {t("In this module", "In diesem Modul")} · {photos.length}
      </h4>
      {!photos.length && (
        <p className="inspector-note">
          {t(
            "Choose a photograph below or upload an image.",
            "Wähle unten ein Foto oder lade ein Bild hoch.",
          )}
        </p>
      )}
      <ol className={`placement-list ${canDrag ? "is-sortable" : ""} ${dragFrom !== null ? "is-sorting" : ""}`} ref={listRef}>
        {photos.map((p, i) => (
          <li
            key={p.placement_id}
            className={`${dragFrom === i ? "is-dragged" : ""} ${dragFrom !== null && dropAt === i && dropAt !== dragFrom ? "is-drop-target" : ""}`}
          >
            <button
              type="button"
              className="placement-image"
              data-placement-id={p.placement_id}
              aria-label={`${t("Edit image placement", "Bildverwendung bearbeiten")} ${i + 1}`}
              title={canDrag ? t("Drag to reorder", "Zum Umsortieren ziehen") : undefined}
              {...thumbDrag(i)}
              onClick={() => {
                if (suppressClick.current) { suppressClick.current = false; return; }
                onPhoto(p);
              }}
            >
              <Picture photo={p} sizes="100px" />
              <span>{i + 1}</span>
            </button>
            <div className="placement-actions">
              <button
                type="button"
                aria-label={
                  t("Move image earlier", "Bild nach vorne") + ` ${i + 1}`
                }
                disabled={!i}
                onClick={() => {
                  const next = [...frames];
                  [next[i - 1], next[i]] = [next[i], next[i - 1]];
                  commit(next);
                }}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                aria-label={
                  t("Move image later", "Bild nach hinten") + ` ${i + 1}`
                }
                disabled={i === frames.length - 1}
                onClick={() => {
                  const next = [...frames];
                  [next[i + 1], next[i]] = [next[i], next[i + 1]];
                  commit(next);
                }}
              >
                <ArrowDown size={14} />
              </button>
              {wallBalanced && (
                <div
                  className="placement-size"
                  role="group"
                  aria-label={t("Size in the wall", "Größe in der Fotowand")}
                >
                  {(["s", "m", "l"] as const).map((size) => (
                    <button
                      key={size}
                      type="button"
                      aria-label={
                        size === "s"
                          ? t("Small", "Klein")
                          : size === "l"
                            ? t("Large", "Groß")
                            : t("Normal", "Normal")
                      }
                      aria-pressed={sizeOf(p.placement_id) === size}
                      onClick={() => setSize(p.placement_id, size)}
                    >
                      {size.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
              {!single && (
                <button
                  type="button"
                  aria-label={
                    t("Reuse this photograph", "Dieses Foto erneut verwenden") +
                    ` ${i + 1}`
                  }
                  onClick={() => {
                    const next = [...frames];
                    next.splice(i + 1, 0, {
                      ...frames[i],
                      id: crypto.randomUUID(),
                    });
                    commit(next);
                  }}
                >
                  <Copy size={14} />
                </button>
              )}
              <button
                type="button"
                aria-label={
                  t(
                    "Remove placement; keep source image",
                    "Verwendung entfernen; Ausgangsfoto behalten",
                  ) + ` ${i + 1}`
                }
                onClick={() =>
                  commit(frames.filter((f) => f.id !== p.placement_id))
                }
              >
                <Trash2 size={15} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      <details
        className="inspector-library"
        open={libraryOpen}
        onToggle={(event) => setLibraryOpen(event.currentTarget.open)}
      >
        <summary>
          {t("Choose from collection", "Aus Fotosammlung wählen")} ·{" "}
          {journey.photos.length}
        </summary>
        <div className="inspector-photo-picker">
          {journey.photos.map((p, i) => {
            const count = frames.filter((f) => f.photo_id === p.id).length;
            return (
              <div className="inspector-source" key={p.id}>
                <button
                  type="button"
                  aria-label={`${t("Add photograph", "Foto hinzufügen")} ${i + 1}`}
                  onClick={() =>
                    commit([
                      ...(single ? [] : frames),
                      { id: crypto.randomUUID(), photo_id: p.id },
                    ])
                  }
                  className={count ? "selected" : ""}
                >
                  <Picture photo={p} sizes="120px" />
                  <span>{count || <Plus size={12} />}</span>
                </button>
                <button
                  className="source-delete danger-action"
                  type="button"
                  disabled={deleteDisabled}
                  aria-label={`${t("Delete photograph", "Foto löschen")} ${i + 1}`}
                  title={t(
                    "Delete from collection",
                    "Aus Fotosammlung löschen",
                  )}
                  onClick={() => onDelete(p)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
        <p className="inspector-note">
          {t(
            "Images can be reused. Each placement has its own crop.",
            "Bilder dürfen mehrfach vorkommen. Jede Verwendung hat einen eigenen Zuschnitt.",
          )}
        </p>
      </details>
    </section>
  );
}
