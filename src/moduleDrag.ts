/** Bounds include a chapter's children: a chapter moves as one visible group. */
export type ModuleRowBounds = { id: number; top: number; bottom: number };

export function moduleDropTarget(rows: ModuleRowBounds[], source: number, y: number) {
  const peers = rows.filter((row) => row.id !== source);
  if (!peers.length) return null;
  const next = peers.find((row) => y < (row.top + row.bottom) / 2);
  return { id: source, target: (next || peers[peers.length - 1]).id, after: !next };
}

/** Pixels per second, independent of pointer-event frequency. */
export function moduleScrollSpeed(y: number, top: number, bottom: number) {
  if (bottom <= top) return 0;
  const edge = Math.min(48, (bottom - top) / 4);
  if (y < top + edge)
    return -240 * Math.min(1, Math.max(0, (top + edge - y) / edge));
  if (y > bottom - edge)
    return 240 * Math.min(1, Math.max(0, (y - bottom + edge) / edge));
  return 0;
}

/**
 * Module transfers use heading bounds; a chapter heading is an explicit inside slot.
 * Below the last module of a day the pointer's x decides the level: left of the day's
 * indentation (`parent` and `left` known) the module lands after the day, on the story level.
 */
export function moduleTransferTarget(
  rows: (ModuleRowBounds & { chapter: boolean; parent?: number | null; left?: number })[],
  source: number,
  y: number,
  x?: number,
) {
  const peers = rows.filter((row) => row.id !== source);
  const chapter = peers.find((row) => row.chapter && y >= row.top && y <= row.bottom);
  if (chapter) return { id: source, target: chapter.id, after: true, inside: true };
  const next = peers.find((row) => y < (row.top + row.bottom) / 2);
  const target = next || peers[peers.length - 1];
  if (!target) return null;
  const previous = next ? peers[peers.indexOf(next) - 1] : target;
  // The slot sits between the last child of a day and whatever follows outside that day.
  if (previous?.parent && x !== undefined && previous.left !== undefined &&
      (!next || next.parent !== previous.parent)) {
    return x < previous.left
      ? { id: source, target: previous.parent, after: true, inside: false }
      : { id: source, target: previous.id, after: true, inside: false };
  }
  return { id: source, target: target.id, after: !next, inside: false };
}
