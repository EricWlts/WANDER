import type { CSSProperties } from "react";
import { Picture } from "./components";
import type { Layout, Photo } from "./types";
import { offsetsFor } from "./journalModel";
/** The inspector miniature and published wall share this exact layout. */
export function PhotoWall({
  photos,
  layout,
  onPhoto,
  selectedId,
  mini = false,
}: {
  photos: Photo[];
  layout: Layout;
  onPhoto?: (p: Photo) => void;
  selectedId?: string;
  mini?: boolean;
}) {
  const columns = layout.columns || 4,
    capacity = columns * (layout.rows || 4),
    offsets = offsetsFor(layout, columns);
  const style = {
    "--wall-columns": columns,
    "--wall-mobile-columns": layout.mobile_columns ?? Math.min(columns, 2),
    "--wall-gap": `${layout.gap ?? 18}px`,
    "--wall-mobile-gap": `${layout.mobile_gap ?? layout.gap ?? 18}px`,
    "--wall-top": `${Math.max(0, -Math.min(...offsets))}px`,
    "--wall-bottom": `${Math.max(0, ...offsets)}px`,
  } as CSSProperties;
  return (
    <div className={`photo-wall ${mini ? "wall-miniature" : ""}`} style={style}>
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
                  {p.edits?.show_title && p.title && !mini && (
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
