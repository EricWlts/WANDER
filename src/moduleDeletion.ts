import type { Selection } from "./JournalCanvas";
import type { Journey } from "./types";

/** Remove exactly one module; preserve its children and source photographs. */
export function removeModuleFromDraft(journey: Journey, id: number): Journey {
  if (!journey.chapters.some((chapter) => chapter.id === id)) return journey;
  return {
    ...journey,
    photos: journey.photos.map((photo) =>
      photo.chapter_id === id ? { ...photo, chapter_id: null } : photo,
    ),
    chapters: journey.chapters.filter((chapter) => chapter.id !== id).map((chapter) =>
      chapter.layout?.parent_id === id
        ? { ...chapter, layout: { ...chapter.layout, parent_id: undefined } }
        : chapter,
    ),
  };
}

export function selectionAfterModuleRemoval(selection: Selection, id: number): Selection {
  return (selection.type === "module" && selection.id === id) ||
    (selection.type === "photo" && selection.moduleId === id)
    ? { type: "hero" }
    : selection;
}
