import type { Chapter } from "./types";

/** Reorder only peers; retain every module, placement and parent relationship. */
export function moveModule(
  chapters: Chapter[],
  id: number,
  target: number,
  after = false,
): Chapter[] {
  const source = chapters.find((c) => c.id === id);
  const destination = chapters.find((c) => c.id === target);
  if (
    !source ||
    !destination ||
    id === target ||
    (source.layout?.parent_id || null) !==
      (destination.layout?.parent_id || null)
  )
    return chapters;
  const siblings = chapters.filter(
    (c) => (c.layout?.parent_id || null) === (source.layout?.parent_id || null),
  );
  const ordered = siblings.filter((c) => c.id !== id);
  ordered.splice(
    ordered.findIndex((c) => c.id === target) + Number(after),
    0,
    source,
  );
  if (ordered.every((c, index) => c === siblings[index])) return chapters;
  let index = 0;
  return chapters.map((c) => (siblings.includes(c) ? ordered[index++] : c));
}
