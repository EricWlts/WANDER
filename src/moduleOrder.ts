import type { Chapter } from "./types";

/** Reorder peers, or explicitly transfer a nonchapter while retaining its content. */
export function moveModule(
  chapters: Chapter[],
  id: number,
  target: number,
  after = false,
  placement: "peer" | "transfer" | "inside" = "peer",
): Chapter[] {
  const source = chapters.find((c) => c.id === id);
  const destination = chapters.find((c) => c.id === target);
  if (
    !source ||
    !destination ||
    id === target ||
    (placement === "peer" && (source.layout?.parent_id || null) !==
      (destination.layout?.parent_id || null)) ||
    (placement === "inside" && (source.kind === "chapter" || destination.kind !== "chapter")) ||
    (source.kind === "chapter" && !!destination.layout?.parent_id)
  )
    return chapters;
  if (placement !== "peer" && source.kind !== "chapter") {
    const parent = placement === "inside" ? destination.id : destination.layout?.parent_id;
    const moved = (source.layout?.parent_id || undefined) === (parent || undefined)
      ? source : { ...source, layout: { ...source.layout, parent_id: parent } };
    const remaining = chapters.filter((chapter) => chapter.id !== id);
    const firstChild = placement === "inside"
      ? remaining.findIndex((chapter) => chapter.layout?.parent_id === destination.id) : -1;
    const index = remaining.findIndex((chapter) => chapter.id === target);
    remaining.splice(firstChild >= 0 ? firstChild : index + (placement === "inside" ? 1 : Number(after)), 0, moved);
    return remaining.every((chapter, i) => chapter === chapters[i]) ? chapters : remaining;
  }
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
