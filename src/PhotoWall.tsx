import { useSyncExternalStore, type CSSProperties } from "react";
import { Picture } from "./components";
import type { Layout, Photo } from "./types";
import { offsetsFor } from "./journalModel";
import { fixedParallax } from "./fixedMotion";
import { edgeColumns } from "./edgeMedia";
import { automaticWallSpans, balancedWallRows, effectivePhotoRatio } from "./storyLayout";

/** Phone width: balanced rows hold at most two photos. */
function subscribeCompact(notify: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const query = window.matchMedia("(max-width: 760px)");
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
}
const isCompact = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(max-width: 760px)").matches;
function useCompactWall() {
  return useSyncExternalStore(subscribeCompact, isCompact, () => false);
}
/** The inspector miniature and published wall share this exact layout. */
export function PhotoWall({
  photos,
  layout,
  onPhoto,
  selectedId,
  mini = false,
  autoComposition = false,
  edge = false,
}: {
  photos: Photo[];
  layout: Layout;
  onPhoto?: (p: Photo) => void;
  selectedId?: string;
  mini?: boolean;
  autoComposition?: boolean;
  /** „Bis zum Rand“: one format, full viewport width (see edgeMedia.ts, edge-media.css). */
  edge?: boolean;
}) {
  const compact = useCompactWall();
  const columns = autoComposition ? 12 : layout.columns || 4,
    capacity = autoComposition ? photos.length : columns * (layout.rows || 4),
    offsets = offsetsFor(layout, columns);
  const spans = autoComposition ? automaticWallSpans(photos.length) : null;
  const framed = (p: Photo) =>
    layout.ratio && layout.ratio !== "original"
      ? { ...p, edits: { ...p.edits, ratio: layout.ratio, fit: layout.fit || p.edits?.fit } }
      : p;
  // Two automatic photos share one row height: widths follow their frame ratios.
  // Authored pairs (columns: 2) qualify too; staggered/offset/multi-row walls and overlaps do not.
  const weighted =
    !mini &&
    photos.length === 2 &&
    (autoComposition || layout.columns === 2) &&
    layout.align !== "staggered" &&
    layout.column_offsets === undefined &&
    layout.rows === undefined &&
    (layout.gap ?? 18) >= 0;
  // Mobile tile width follows the real column count (page gutter 44px); desktop keeps the wide frame.
  const mobileColumns = autoComposition ? 12 : layout.mobile_columns ?? Math.min(columns, 2);
  const wallSizes = autoComposition
    ? "(max-width:760px) 100vw, 80vw"
    : `(max-width:760px) calc((100vw - 44px) / ${Math.max(1, mobileColumns)}), 80vw`;
  const ratios = weighted ? photos.map((p) => effectivePhotoRatio(framed(p))) : [];
  const style = {
    "--wall-columns": columns,
    "--wall-mobile-columns": autoComposition
      ? 12
      : layout.mobile_columns ?? Math.min(columns, 2),
    // Unset gaps fall back to the story-polish.css defaults.
    "--wall-gap": layout.gap === undefined ? undefined : `${layout.gap}px`,
    "--wall-mobile-gap":
      (layout.mobile_gap ?? layout.gap) === undefined
        ? undefined
        : `${layout.mobile_gap ?? layout.gap}px`,
    "--wall-top": `${Math.max(0, -Math.min(...offsets))}px`,
    "--wall-bottom": `${Math.max(0, ...offsets)}px`,
  } as CSSProperties;
  if (edge && !mini && photos.length > 1) {
    const cols = edgeColumns(photos.length, effectivePhotoRatio(framed(photos[0])));
    return (
      <div
        className="photo-wall wall-edge"
        data-wall-mode="edge"
        style={{ "--edge-cols": cols.desktop, "--edge-mobile-cols": cols.mobile } as CSSProperties}
      >
        {photos.map((p, i) => (
          <figure
            key={p.placement_id || `${p.id}:${i}`}
            className={p.placement_id === selectedId ? "photo-selected" : ""}
            onClick={(e) => e.stopPropagation()}
          >
            <Picture
              parallax={false}
              photo={framed(p)}
              sizes="(max-width:760px) 100vw, 50vw"
              onClick={onPhoto ? () => onPhoto(p) : undefined}
            />
            {p.edits?.show_title && p.title?.trim() && <figcaption>{p.title}</figcaption>}
          </figure>
        ))}
      </div>
    );
  }
  if (layout.wall_mode === "balanced") {
    const sizes = photos.map((p) => layout.placements?.find((f) => f.id === p.placement_id)?.size);
    const rows = balancedWallRows({
      ratios: photos.map((p) => effectivePhotoRatio(framed(p))),
      sizes,
      perRow: layout.wall_row ?? null,
      maxPerRow: compact ? 2 : undefined,
    });
    const centered = layout.wall_center !== false;
    return (
      <div
        className={`photo-wall wall-balanced ${mini ? "wall-miniature" : ""}`}
        data-wall-mode="balanced"
        style={style}
      >
        {rows.map((row, r) => {
          const n = row.items.length;
          return (
            <div
              key={r}
              className="wall-row"
              data-centered={centered || undefined}
              style={
                {
                  width: `calc(${row.scale} * (100% - ${n - 1} * var(--gap)) + ${n - 1} * var(--gap))`,
                } as CSSProperties
              }
            >
              {row.items.map(({ index, box }) => {
                const p = photos[index];
                return (
                  <figure
                    key={p.placement_id || `${p.id}:${index}`}
                    className={p.placement_id === selectedId ? "photo-selected" : ""}
                    style={{ flex: `${box} 1 0`, aspectRatio: String(box) } as CSSProperties}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Picture
                      parallax={!mini && fixedParallax("wall").enabled}
                      photo={framed(p)}
                      sizes={mini ? "160px" : wallSizes}
                      onClick={onPhoto ? () => onPhoto(p) : undefined}
                    />
                    {p.edits?.show_title && p.title?.trim() && !mini && (
                      <figcaption>{p.title}</figcaption>
                    )}
                  </figure>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div
      className={`photo-wall ${mini ? "wall-miniature" : ""}`}
      data-auto-composition={autoComposition || undefined}
      data-weighted={weighted || undefined}
      style={
        weighted
          ? ({ ...style, "--wall-ratio-sum": ratios[0] + ratios[1] } as CSSProperties)
          : style
      }
    >
      {Array.from(
        { length: Math.ceil(photos.length / capacity) },
        (_, group) => (
          <div key={group} className="wall-group">
            {photos
              .slice(group * capacity, (group + 1) * capacity)
              .map((p, i) => (
                <figure
                  key={p.placement_id || `${p.id}:${i}`}
                  className={
                    p.placement_id === selectedId ? "photo-selected" : ""
                  }
                  style={
                    {
                      "--wall-shift": `${offsets[i % columns]}px`,
                      ...(spans
                        ? {
                            "--wall-desktop-span": spans.desktop[group * capacity + i],
                            "--wall-tablet-span": spans.tablet[group * capacity + i],
                            "--wall-mobile-span": spans.mobile[group * capacity + i],
                          }
                        : {}),
                      ...(weighted ? { "--wall-ratio": ratios[group * capacity + i] } : {}),
                      zIndex: i + 1,
                    } as CSSProperties
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  <Picture
                    parallax={!mini && fixedParallax("wall").enabled}
                    photo={framed(p)}
                    sizes={mini ? "160px" : wallSizes}
                    onClick={onPhoto ? () => onPhoto(p) : undefined}
                  />
                  {p.edits?.show_title && p.title?.trim() && !mini && (
                    <figcaption>{p.title}</figcaption>
                  )}
                </figure>
              ))}
          </div>
        ),
      )}
    </div>
  );
}
