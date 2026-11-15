/**
 * Pure helpers that turn a story draft (see storyDraft.ts) into editor module
 * state and back. They only produce new `chapters` / `photos` arrays; the editor
 * applies them through its normal `change` updater, so autosave, merge and
 * recovery treat the result like any other manual edit.
 */
import { applyPreset, initialLayoutFor, presetsFor } from "./editorPresets.ts";
import { placementsFor } from "./journalModel.ts";
import type { DraftModule } from "./storyDraft.ts";
import type { StoryWords } from "./newStoryFlow.ts";
import type { Chapter, Journey, Photo } from "./types";

export const MAX_MODULES = 300;
const IMAGE_KINDS: readonly Chapter["kind"][] = [
  "hero", "image", "pair", "rail", "wall", "gallery", "filmstrip",
];
const GENERATED_CHAPTER = /^(?:(?:Tag|Day) \d+|Weitere Momente|More moments)$/;

export interface ApplyDeps {
  /** First temporary module id; following ones count downwards. */
  firstId: number;
  newPlacementId: () => string;
  titleFor: (kind: Chapter["kind"]) => string;
}
export interface ApplyResult {
  chapters: Chapter[];
  photos: Photo[];
  createdIds: number[];
  removedIds: number[];
}

function hasOwnText(c: Chapter): boolean {
  return Boolean((c.story || "").trim() || (c.quote || "").trim());
}

/** Which existing modules the draft replaces. Pure: no mutation. */
export function replaceableIds(journey: Journey): Set<number> {
  const removable = new Set<number>();
  for (const c of journey.chapters)
    if (IMAGE_KINDS.includes(c.kind) && !hasOwnText(c)) removable.add(c.id);
  // Chapters created by an earlier draft (generated title, no text) may go,
  // but only if every child goes with them.
  for (const c of journey.chapters) {
    if (c.kind !== "chapter" || c.layout?.parent_id) continue;
    if (hasOwnText(c) || !GENERATED_CHAPTER.test((c.title || "").trim())) continue;
    const children = journey.chapters.filter((m) => m.layout?.parent_id === c.id);
    if (children.every((m) => removable.has(m.id))) removable.add(c.id);
  }
  return removable;
}

function newModule(
  draft: DraftModule,
  id: number,
  parentId: number | undefined,
  index: number,
  deps: ApplyDeps,
  imageCounter: { value: number },
): Chapter {
  const kind = draft.kind;
  let layout: Chapter["layout"] = {
    edition: "inherit",
    ...initialLayoutFor(kind),
    ...(parentId ? { parent_id: parentId } : {}),
    show_title: false,
  };
  if (kind === "pair") layout = { ...layout, columns: 2 };
  if (kind === "wall") {
    layout = { ...layout, wall_mode: "balanced", gap: 12 };
  }
  if (kind === "hero") layout = { ...layout, parallax: true, title_style: "overlay" };
  if (kind === "image") {
    // Alternate generous white space and full-bleed for landscape singles.
    const bleed = presetsFor("image").find((p) => p.id === "bleed");
    imageCounter.value++;
    if (!draft.spacious && bleed && imageCounter.value % 2 === 1)
      layout = applyPreset(layout, bleed);
  }
  if (kind !== "chapter")
    layout = {
      ...layout,
      placements: draft.photoIds.map((photo_id) => ({
        id: deps.newPlacementId(),
        photo_id,
      })),
    };
  return {
    id,
    kind,
    title: kind === "chapter" ? draft.title || deps.titleFor(kind) : deps.titleFor(kind),
    date: kind === "chapter" ? draft.date || "" : "",
    story: "",
    quote: "",
    position: index,
    reveal: { effect: "fade", duration: 1000 },
    gallery_mode: "editorial",
    layout,
  };
}

/**
 * Replace all image-only modules by the draft. Text modules, quotes and chapters
 * with text are kept in place. Returns null when the result would exceed the
 * server limit of modules.
 */
export function applyStoryDraft(
  journey: Journey,
  draft: readonly DraftModule[],
  deps: ApplyDeps,
): ApplyResult | null {
  const removable = replaceableIds(journey);
  const kept = journey.chapters.filter((c) => !removable.has(c.id));
  // Kept modules that still display photographs lose them: the draft owns all photographs.
  const keptCleared = kept.map((c) => {
    const holdsImages =
      !IMAGE_KINDS.includes(c.kind) && placementsFor(c, journey).length > 0;
    return holdsImages ? { ...c, layout: { ...c.layout, placements: [] } } : c;
  });

  let next = deps.firstId;
  const createdIds: number[] = [];
  const imageCounter = { value: 0 };
  const make = (item: DraftModule, parentId: number | undefined) => {
    const id = next--;
    createdIds.push(id);
    return newModule(item, id, parentId, 0, deps, imageCounter);
  };

  const roots = keptCleared.filter((c) => !c.layout?.parent_id);
  const childrenOf = new Map<number, Chapter[]>(
    roots.map((r) => [r.id, keptCleared.filter((c) => c.layout?.parent_id === r.id)]),
  );
  const rootList: Chapter[] = roots.slice();
  const additions = new Map<number, Chapter[]>();
  const leading: Chapter[] = [];
  const trailing: Chapter[] = [];

  const hasChapters = draft.some((m) => m.kind === "chapter");
  const draftChapterIds = new Map<number, number>();
  for (let i = 0; i < draft.length; i++) {
    const item = draft[i];
    if (item.kind === "hero" && item.parentIndex === undefined) {
      leading.push(make(item, undefined));
    } else if (item.kind === "chapter") {
      const existing = item.date
        ? roots.find((r) => r.kind === "chapter" && r.date === item.date)
        : undefined;
      if (existing) {
        draftChapterIds.set(i, existing.id);
        continue;
      }
      const chapter = make(item, undefined);
      draftChapterIds.set(i, chapter.id);
      const at = item.date
        ? rootList.findIndex((r) => r.kind === "chapter" && r.date && r.date > item.date!)
        : -1;
      if (at >= 0) rootList.splice(at, 0, chapter);
      else rootList.push(chapter);
      childrenOf.set(chapter.id, []);
    } else {
      const parentId =
        item.parentIndex !== undefined ? draftChapterIds.get(item.parentIndex) : undefined;
      const module = make(item, hasChapters ? parentId : undefined);
      if (parentId) additions.set(parentId, [...(additions.get(parentId) || []), module]);
      else trailing.push(module);
    }
  }

  const flat: Chapter[] = [];
  for (const root of [...leading, ...rootList]) {
    flat.push(root);
    flat.push(...(childrenOf.get(root.id) || []), ...(additions.get(root.id) || []));
  }
  // Keep orphans (children whose parent vanished) and trailing modules at the end.
  const placed = new Set(flat.map((c) => c.id));
  for (const c of keptCleared) if (!placed.has(c.id)) flat.push(c);
  flat.push(...trailing);
  if (flat.length > MAX_MODULES) return null;

  const removedIds = journey.chapters.filter((c) => removable.has(c.id)).map((c) => c.id);
  const detach = new Set<number>([
    ...removedIds,
    ...kept.filter((c, i) => keptCleared[i] !== c).map((c) => c.id),
  ]);
  return {
    chapters: flat.map((c, index) => ({ ...c, position: index })),
    photos: journey.photos.map((p) =>
      p.chapter_id !== null && detach.has(p.chapter_id) ? { ...p, chapter_id: null } : p,
    ),
    createdIds,
    removedIds,
  };
}

export interface DraftSnapshot {
  chapters: Chapter[];
  photos: Photo[];
}

/**
 * Rebuild the pre-draft state. Modules that the draft deleted are re-created with
 * fresh temporary ids (the server may already have removed the originals); their
 * images are made explicit as placements so they survive the legacy-link reset.
 */
export function restoreStoryDraft(
  current: Journey,
  snapshot: DraftSnapshot,
  firstId: number,
): { chapters: Chapter[]; photos: Photo[] } {
  const currentIds = new Set(current.chapters.map((c) => c.id));
  const snapshotJourney = { ...current, chapters: snapshot.chapters, photos: snapshot.photos } as Journey;
  const idMap = new Map<number, number>();
  let next = firstId;
  // A module "survives" when the draft left it alone, i.e. it is still present.
  for (const c of snapshot.chapters) if (!currentIds.has(c.id)) idMap.set(c.id, next--);
  const chapters = snapshot.chapters.map((c, index) => {
    const parent = c.layout?.parent_id;
    const layoutBase = { ...c.layout };
    if (parent) layoutBase.parent_id = idMap.get(parent) ?? parent;
    if (idMap.has(c.id)) layoutBase.placements = placementsFor(c, snapshotJourney);
    return { ...c, id: idMap.get(c.id) ?? c.id, position: index, layout: layoutBase };
  });
  const bySnapshot = new Map(snapshot.photos.map((p) => [p.id, p]));
  return {
    chapters,
    photos: current.photos.map((p) => {
      const before = bySnapshot.get(p.id);
      if (!before) return p;
      const owner = before.chapter_id;
      return { ...p, chapter_id: owner !== null && idMap.has(owner) ? null : owner };
    }),
  };
}

/**
 * Puts the words of the assistant (step 4) into a finished draft. Day title and text go into
 * the chapter of that capture day; the intro sentence goes into the first chapter module,
 * or, when there is none (by mood / as a moment), into a new text module after the opening image.
 * The new text module always carries the usual default title (titleFor), never an empty one.
 * Pure: returns new arrays and leaves modules without words untouched.
 */
export function applyStoryWords(
  chapters: readonly Chapter[],
  words: StoryWords,
  newId: () => number,
  titleFor: ApplyDeps["titleFor"],
): Chapter[] {
  let out = chapters.map((c) => {
    if (c.kind !== "chapter" || !c.date || c.layout?.parent_id) return c;
    const entry = words.days[c.date];
    if (!entry) return c;
    return {
      ...c,
      title: entry.title.trim() || c.title,
      story: entry.text.trim() || c.story,
    };
  });
  const intro = words.intro.trim();
  if (intro) {
    const at = out.findIndex((c) => c.kind === "chapter" && !c.layout?.parent_id);
    if (at >= 0) out = out.map((c, i) => (i === at ? { ...c, story: c.story ? c.story : intro } : c));
    else {
      const index = out[0]?.kind === "hero" ? 1 : 0;
      const text: Chapter = {
        id: newId(),
        kind: "text",
        title: titleFor("text"),
        date: "",
        story: intro,
        quote: "",
        position: index,
        reveal: { effect: "none", duration: 1000 },
        gallery_mode: "editorial",
        layout: { edition: "inherit", ...initialLayoutFor("text"), show_title: false },
      };
      out = [...out.slice(0, index), text, ...out.slice(index)];
    }
  }
  return out.map((c, position) => ({ ...c, position }));
}
