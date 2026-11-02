import type { CSSProperties } from "react";
import { Picture } from "./components";
import type { Layout, Photo } from "./types";
import { offsetsFor } from "./journalModel";
import { automaticWallSpans } from "./storyLayout";
/** The inspector miniature and published wall share this exact layout. */
export function PhotoWall({
  photos,
  layout,
  onPhoto,
  selectedId,
  mini = false,
  autoComposition = false,
}: {
  photos: Photo[];
  layout: Layout;
  onPhoto?: (p: Photo) => void;
  selectedId?: string;
  mini?: boolean;
  autoComposition?: boolean;
}) {
  const columns = autoComposition ? 12 : layout.columns || 4,
    capacity = autoComposition ? photos.length : columns * (layout.rows || 4),
    offsets = offsetsFor(layout, columns);
  const spans = autoComposition ? automaticWallSpans(photos.length) : null;
  const style = {
    "--wall-columns": columns,
    "--wall-mobile-columns": autoComposition
      ? 12
      : layout.mobile_columns ?? Math.min(columns, 2),
    "--wall-gap": `${layout.gap ?? 18}px`,
    "--wall-mobile-gap": `${layout.mobile_gap ?? layout.gap ?? 18}px`,
    "--wall-top": `${Math.max(0, -Math.min(...offsets))}px`,
    "--wall-bottom": `${Math.max(0, ...offsets)}px`,
  } as CSSProperties;
  return (
    <div
      className={`photo-wall ${mini ? "wall-miniature" : ""}`}
      data-auto-composition={autoComposition || undefined}
      style={style}
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
                      zIndex: i + 1,
                    } as CSSProperties
                  }
                  onClick={(e) => e.stopPropagation()}
                >
                  <Picture
                    photo={
                      layout.ratio && layout.ratio !== "original"
                        ? {
                            ...p,
                            edits: {
                              ...p.edits,
                              ratio: layout.ratio,
                              fit: layout.fit || p.edits?.fit,
                            },
                          }
                        : p
                    }
                    sizes={mini ? "160px" : "(max-width:760px) 95vw, 75vw"}
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
