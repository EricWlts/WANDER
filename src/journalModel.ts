import type { Chapter, ImagePlacement, Journey, Layout, Photo } from "./types";
export const editionColors = {
  "quiet-atlas": "#EEECE6",
  "after-hours": "#1C1B19",
};
export const typePresets = {
  small: 17,
  medium: 22,
  large: 30,
  display: 44,
} as const;
function linearRgb(hexColor: string) {
  let hex = hexColor.slice(1);
  if (hex.length === 3)
    hex = hex
      .split("")
      .map((channel) => channel + channel)
      .join("");
  return [0, 2, 4]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
}
function relativeLuminance(hexColor: string) {
  const rgb = linearRgb(hexColor);
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}
export function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}
export function surfaceColors(background: string) {
  const darkBrand = "#312D2A";
  const lightBrand = "#F2F1F0";
  const firstChoice = relativeLuminance(background) > 0.3 ? darkBrand : lightBrand;
  const otherBrand = firstChoice === darkBrand ? lightBrand : darkBrand;
  const ink = [firstChoice, otherBrand].find(
    (candidate) => contrastRatio(candidate, background) >= 4.5,
  );
  if (ink) return { background, ink };

  const blackRatio = contrastRatio("#000000", background);
  const whiteRatio = contrastRatio("#FFFFFF", background);
  return { background, ink: blackRatio >= whiteRatio ? "#000000" : "#FFFFFF" };
}
export function placementsFor(
  module: Chapter,
  journey: Journey,
): ImagePlacement[] {
  return (
    module.layout?.placements ||
    (
      module.layout?.photo_ids ??
      journey.photos.filter((p) => p.chapter_id === module.id).map((p) => p.id)
    ).map((id, i) => ({ id: `legacy:${module.id}:${i}:${id}`, photo_id: id }))
  );
}
function withoutHoverZoom<T extends { hover_zoom?: number }>(edits: T): T {
  if (edits.hover_zoom === undefined) return edits;
  const { hover_zoom: _ignored, ...rest } = edits;
  return rest as T;
}
export function modulePhotos(module: Chapter, journey: Journey): Photo[] {
  /* "Show all photos": the whole collection in its order; own placements stay stored untouched. */
  if (module.kind === "filmstrip" && module.layout?.all_photos === true)
    return [...journey.photos]
      .sort((a, b) => a.position - b.position || a.id - b.id)
      .map((p) => ({
        ...p,
        placement_id: `all:${p.id}`,
        edits: withoutHoverZoom({ ...p.edits, ...module.layout?.photo_edits?.[p.id] }),
      }));
  return placementsFor(module, journey).flatMap((frame) => {
    const p = journey.photos.find((p) => p.id === frame.photo_id);
    return p
      ? [
          {
            ...p,
            placement_id: frame.id,
            // Hover zoom is no longer an author setting: stored values are ignored.
            edits: withoutHoverZoom({
              ...p.edits,
              ...module.layout?.photo_edits?.[p.id],
              ...frame.edits,
            }),
          },
        ]
      : [];
  });
}
export function rootPhotos(
  journey: Journey,
  context: "loose" | "filmstrip",
): Photo[] {
  const configured =
    context === "loose"
      ? journey.layout?.placements
      : journey.layout?.filmstrip_placements;
  const used = new Set(
    journey.chapters.flatMap((c) => modulePhotos(c, journey).map((p) => p.id)),
  );
  const ids =
    context === "loose"
      ? journey.photos
          .filter((p) => p.chapter_id === null && !used.has(p.id))
          .map((p) => p.id)
      : journey.filmstrip_ids || [];
  return modulePhotos(
    {
      id: context === "loose" ? 0 : -1,
      layout: {
        placements:
          configured ||
          ids.map((photo_id, i) => ({
            id: `${context}:${i}:${photo_id}`,
            photo_id,
          })),
      },
    } as Chapter,
    journey,
  );
}
/** Replace references, never copy media files or change the source photograph. */
export function replaceSourceReferences(
  journey: Journey,
  source: number,
  replacement: number,
): Journey {
  const replace = (photos: Photo[]) =>
    photos.map((p) => ({
      id: p.placement_id!,
      photo_id: p.id === source ? replacement : p.id,
      edits: p.edits,
    }));
  return {
    ...journey,
    cover_id:
      journey.cover_id === source || journey.cover?.id === source
        ? replacement
        : journey.cover_id,
    cover:
      journey.cover?.id === source
        ? journey.photos.find((p) => p.id === replacement) || null
        : journey.cover,
    layout: {
      ...journey.layout,
      placements: replace(rootPhotos(journey, "loose")),
      filmstrip_placements: replace(rootPhotos(journey, "filmstrip")),
    },
    chapters: journey.chapters.map((c) => ({
      ...c,
      layout: { ...c.layout, placements: replace(modulePhotos(c, journey)) },
    })),
  };
}
export function offsetsFor(layout: Layout, columns: number) {
  return Array.from(
    { length: columns },
    (_, i) =>
      layout.column_offsets?.[i] ??
      (layout.align === "staggered" && i > 0 && i < columns - 1
        ? -(layout.offset ?? 50)
        : 0),
  );
}
export function sequenceIndex(photos: Photo[], photo: Photo) {
  return Math.max(
    0,
    photos.findIndex((p) =>
      photo.placement_id
        ? p.placement_id === photo.placement_id
        : p.id === photo.id,
    ),
  );
}
/** Keep edits made while a save was in flight; remap only newly assigned module IDs. */
export function mergeSavedJourney(
  current: Journey,
  submitted: Journey,
  saved: Journey,
): Journey {
  const ids = new Map(
    submitted.chapters.map((c, i) => [c.id, saved.chapters[i]?.id ?? c.id]),
  );
  return {
    ...current,
    composition_version: saved.composition_version,
    has_unpublished_changes: saved.has_unpublished_changes,
    chapters: current.chapters.map((c) => ({
      ...c,
      id: ids.get(c.id) ?? c.id,
      layout: c.layout?.parent_id
        ? {
            ...c.layout,
            parent_id: ids.get(c.layout.parent_id) ?? c.layout.parent_id,
          }
        : c.layout,
    })),
  };
}
