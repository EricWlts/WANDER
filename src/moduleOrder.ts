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

/**
 * Keyboard move (Up/Down at the grip). Inside a day the module steps among its peers and,
 * at the day's first or last place, out onto the story level before or after the day.
 * On the story level it steps into a neighbouring day: below into the top of the next
 * day, above onto the end of the previous one. Days themselves only move among days.
 */
export function stepModule(chapters: Chapter[], id: number, dir: -1 | 1): Chapter[] {
  const source = chapters.find((c) => c.id === id);
  if (!source) return chapters;
  const parent = source.layout?.parent_id || null;
  const peers = chapters.filter((c) => (c.layout?.parent_id || null) === parent);
  const neighbour = peers[peers.indexOf(source) + dir];
  if (source.kind === "chapter")
    return neighbour ? moveModule(chapters, id, neighbour.id, dir > 0) : chapters;
  if (parent) {
    if (neighbour) return moveModule(chapters, id, neighbour.id, dir > 0);
    return moveModule(chapters, id, parent, dir > 0, "transfer");
  }
  if (!neighbour) return chapters;
  if (neighbour.kind !== "chapter") return moveModule(chapters, id, neighbour.id, dir > 0);
  const children = chapters.filter((c) => c.layout?.parent_id === neighbour.id);
  if (dir > 0 || !children.length) return moveModule(chapters, id, neighbour.id, true, "inside");
  return moveModule(chapters, id, children[children.length - 1].id, true, "transfer");
}
