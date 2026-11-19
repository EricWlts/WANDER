// "Vorher · Nachher" on the home page: the light table holds photos of the real example journey in First light
// (/templates/quiet-atlas/example). This file picks the photos the journey really shows: its cover and the photos of its modules (all of them, up to SHOT_COUNT).
// Pure, no DOM.
import type { Chapter, Journey, Photo } from "./types";

export type StoryPhoto = { key: string; src: string; srcSet: string; alt: string };

/** Upper bound of the light table; below it every photo of the story lies there, so the title count is exact. */
export const SHOT_COUNT = 20;

function shotOf(photo: Photo): StoryPhoto {
  return { key: String(photo.id), src: photo.url, srcSet: photo.srcset || "", alt: photo.alt || photo.title || "" };
}

/** Photos one module shows, in the order it shows them (placements, else photo ids, else chapter photos). */
function modulePhotos(chapter: Chapter, journey: Journey): Photo[] {
  const layout = chapter.layout;
  const ids = layout?.placements?.map((frame) => frame.photo_id) ?? layout?.photo_ids;
  if (ids?.length) return ids.flatMap((id) => journey.photos.filter((photo) => photo.id === id));
  return journey.photos
    .filter((photo) => photo.chapter_id === chapter.id)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

/** The same picture can be a different photo row (copy per module); its file tells them apart. */
const fileOf = (photo: Photo) => photo.url.replace(/[?#].*$/, "").replace(/-(640|1280|2200|3840)(?=\.\w+$)/, "");

/**
 * Up to `count` different photographs of the journey: the cover first, then photos from its modules in story order;
 * if there are more than `count`, evenly spread over the whole story so they differ as much as possible.
 */
export function pickShots(journey: Journey, count = SHOT_COUNT): StoryPhoto[] {
  const cover = journey.photos.find((photo) => photo.id === journey.cover_id) ?? journey.cover;
  const modules = journey.chapters
    .slice()
    .sort((a, b) => a.position - b.position || a.id - b.id)
    .flatMap((chapter) => modulePhotos(chapter, journey));
  const seen = new Set<string>();
  const all: Photo[] = [];
  // Only photos the story shows (cover + modules); loose photos only stand in when the story has no module photos at all.
  const shown = modules.length ? modules : journey.photos;
  for (const photo of [...(cover ? [cover] : []), ...shown]) {
    const file = fileOf(photo);
    if (seen.has(file)) continue;
    seen.add(file);
    all.push(photo);
  }
  if (all.length <= count) return all.map(shotOf);
  if (count <= 1) return all.slice(0, count).map(shotOf);
  // Evenly spaced, first and last included; strictly increasing because all.length > count.
  return Array.from({ length: count }, (_, i) => all[Math.round((i * (all.length - 1)) / (count - 1))]).map(shotOf);
}
