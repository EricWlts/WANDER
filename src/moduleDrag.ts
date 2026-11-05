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

/** Module transfers use heading bounds; a chapter heading is an explicit inside slot. */
export function moduleTransferTarget(
  rows: (ModuleRowBounds & { chapter: boolean })[], source: number, y: number,
) {
  const peers = rows.filter((row) => row.id !== source);
  const chapter = peers.find((row) => row.chapter && y >= row.top && y <= row.bottom);
  if (chapter) return { id: source, target: chapter.id, after: true, inside: true };
  const next = peers.find((row) => y < (row.top + row.bottom) / 2);
  const target = next || peers[peers.length - 1];
  return target ? { id: source, target: target.id, after: !next, inside: false } : null;
}
