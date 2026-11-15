import type { Chapter, Journey } from "../types";
import type { Selection } from "../JournalCanvas";

/** Pure parts of saving a composition: no React, no network, no DOM. */

export const cleanChapter = (c: Chapter) => ({
  id: c.id,
  title: c.title,
  date: c.date || "",
  story: c.story || "",
  quote: c.quote || "",
  kind: c.kind,
  reveal: c.reveal || {},
  gallery_mode: c.gallery_mode || "editorial",
  layout: c.layout || {},
});

/** Body of the PATCH request that saves (and optionally publishes) a draft. */
export function compositionPayload(current: Journey, publish: boolean) {
  return {
    base_version: current.composition_version,
    base_slug: current.slug,
    journey: {
      title: current.title,
      subtitle: current.subtitle,
      location: current.location,
      country: current.country,
      start_date: current.start_date,
      end_date: current.end_date,
      introduction: current.introduction,
      reflection: current.reflection,
      closing: current.closing,
      description: current.description,
      cover_id: current.cover_id,
      cover_focus: current.cover_focus ?? null,
      layout: current.layout || {},
      story_template: current.story_template,
      reveal_settings: current.reveal_settings,
    },
    chapters: current.chapters.map(cleanChapter),
    photo_order: current.photos.map((p) => p.id),
    photos: current.photos.map((p) => ({
      id: p.id,
      edits: p.edits || {},
      title: p.title,
      description: p.description,
      alt: p.alt,
      featured: p.featured,
    })),
    publish,
  };
}

/**
 * New modules carry a temporary negative ID until the first save. The server
 * answers with its chapters in the order they were sent, so the IDs are paired by index.
 */
export function chapterIdMap(sent: Chapter[], saved: Chapter[]): Map<number, number> {
  return new Map(sent.map((c, i) => [c.id, saved[i]?.id ?? c.id]));
}

/** The ID a module has after saving; unknown IDs stay as they are. */
export function mappedId(id: number, idMap: Map<number, number>): number {
  return idMap.get(id) ?? id;
}

/** Follows the selected module (or the module of the selected photo) to its new ID. */
export function remapSelection(active: Selection, idMap: Map<number, number>): Selection {
  return active.type === "module"
    ? idMap.get(active.id) && idMap.get(active.id) !== active.id
      ? { ...active, id: idMap.get(active.id)! }
      : active
    : active.type === "photo" &&
        active.moduleId &&
        idMap.get(active.moduleId) !== active.moduleId &&
        idMap.has(active.moduleId)
      ? {
          ...active,
          moduleId: idMap.get(active.moduleId) ?? active.moduleId,
        }
      : active;
}

/**
 * True when a keyed row is replaced by saving. An ID the map does not know
 * counts as replaced too, so a gesture on it is always cancelled.
 */
export function idReassigned(id: number, idMap: Map<number, number>): boolean {
  return idMap.get(id) !== id;
}

/** The new ID of the module whose control had keyboard focus, or null when focus can stay. */
export function reassignedFocusId(
  focusedId: number | null,
  idMap: Map<number, number>,
): number | null {
  return focusedId !== null && idMap.has(focusedId) && idMap.get(focusedId) !== focusedId
    ? idMap.get(focusedId)!
    : null;
}

/** Server state wins for the photo set; the draft keeps its own edits for photos both share. */
export function reconcileWithServer(mine: Journey, server: Journey): Journey {
  const serverIds = new Set(server.photos.map((p) => p.id));
  const mineIds = new Set(mine.photos.map((p) => p.id));
  const photos = [
    ...mine.photos.filter((p) => serverIds.has(p.id)),
    ...server.photos.filter((p) => !mineIds.has(p.id)),
  ];
  const coverGone = mine.cover_id !== null && !serverIds.has(mine.cover_id);
  return {
    ...mine,
    slug: server.slug,
    composition_version: server.composition_version,
    photos,
    photo_count: photos.length,
    cover_id: coverGone ? null : mine.cover_id,
    cover: coverGone ? null : mine.cover,
  };
}

export type SaveFlags = {
  dirty: boolean;
  busy: boolean;
  backgroundSaving: boolean;
  uploadBusy: boolean;
  autoError: boolean;
  conflicted: boolean;
};

/** The quiet autosave only starts when nothing else is saving, uploading or failing. */
export function canAutosave(f: SaveFlags): boolean {
  return !(f.dirty === false || f.busy || f.backgroundSaving || f.uploadBusy || f.autoError || f.conflicted);
}

/** A failed autosave may be retried by the plan when the editor is otherwise idle. */
export function canRetry(f: SaveFlags): boolean {
  return f.autoError && f.dirty && !f.busy && !f.backgroundSaving && !f.uploadBusy && !f.conflicted;
}
