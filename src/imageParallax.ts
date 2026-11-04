import type { Layout, Photo } from "./types";

/** Explicit choices use fixed strength; untouched covers retain legacy motion. */
export function imageParallax(layout: Layout = {}, cover = false) {
  return typeof layout.image_parallax === "boolean"
    ? { enabled: layout.image_parallax, intensity: 140 }
    : {
        enabled: cover && (layout.parallax ?? true),
        intensity: layout.parallax_intensity ?? 90,
      };
}

/** Containment preserves the complete motif, including single-image rail pages. */
export function canPanImage(photo: Photo | null) {
  return !!photo && photo.edits?.fit !== "contain";
}
