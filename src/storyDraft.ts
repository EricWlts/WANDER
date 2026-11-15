/**
 * Pure story-draft logic ("Story gestalten"): turns a set of photographs into an
 * editorially paced list of image-module suggestions. No React, no I/O, no
 * randomness: the same input always yields the same output.
 */
import { moodArc, splitMovements, type PhotoLight } from "./photoMood.ts";

export type DraftMode = "days" | "mood";
export type DraftKind = "chapter" | "hero" | "image" | "pair" | "rail" | "wall";

export interface DraftPhoto {
  id: number;
  width: number;
  height: number;
  taken_at?: string | null;
  position: number;
  featured?: boolean;
}

export interface DraftModule {
  kind: DraftKind;
  photoIds: number[];
  title?: string;
  /** ISO date (YYYY-MM-DD) of a day chapter. */
  date?: string;
  /** Index (in the returned list) of the chapter this module belongs to. */
  parentIndex?: number;
  /** Single image set with extra white space (leftover portrait). */
  spacious?: boolean;
}

export interface DraftOptions {
  locale?: "en" | "de";
  /**
   * Photograph already shown as the journey cover. It opens the story, so it is
   * excluded from the draft (and no hero is created) unless it is the only photo.
   */
  coverPhotoId?: number | null;
  /**
   * Light of each photograph (by id), read in the browser. Only used "by mood":
   * the photographs then follow a light arc in two to four movements. Without
   * any usable value the upload order stays.
   */
  light?: Readonly<Record<number, PhotoLight | null | undefined>>;
}

const RAIL_MAX = 6;
const WALL_MAX = 5;

export function isPortrait(photo: DraftPhoto): boolean {
  return photo.height > photo.width;
}

/** Calendar day (YYYY-MM-DD) of a stored timestamp, or null when unusable. */
export function dayOf(takenAt: string | null | undefined): string | null {
  if (typeof takenAt !== "string") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(takenAt);
  if (!match) return null;
  const [, y, m, d] = match;
  const probe = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (
    probe.getUTCFullYear() !== Number(y) ||
    probe.getUTCMonth() !== Number(m) - 1 ||
    probe.getUTCDate() !== Number(d)
  )
    return null;
  return `${y}-${m}-${d}`;
}

function byPosition(a: DraftPhoto, b: DraftPhoto): number {
  return a.position - b.position || a.id - b.id;
}

function byTime(a: DraftPhoto, b: DraftPhoto): number {
  const x = a.taken_at || "";
  const y = b.taken_at || "";
  return x < y ? -1 : x > y ? 1 : byPosition(a, b);
}

/** Number of images to take so that no single orphan photograph is left over. */
function sizeFor(available: number, max: number, min: number): number {
  const take = Math.min(max, available);
  return available - take === 1 && take > min ? take - 1 : take;
}

function leadingLandscapes(queue: DraftPhoto[]): number {
  let run = 0;
  while (run < queue.length && !isPortrait(queue[run])) run++;
  return run;
}

interface Rhythm {
  last: DraftKind | null;
  sinceWall: number;
}

/** Turns an ordered run of photographs into image modules (no hero, no chapters). */
function rhythmize(
  photos: DraftPhoto[],
  state: Rhythm,
  out: DraftModule[],
  parentIndex: number | undefined,
): void {
  const queue = photos.slice();
  const emit = (kind: DraftKind, take: number, spacious = false) => {
    const group = queue.splice(0, take);
    const module: DraftModule = { kind, photoIds: group.map((p) => p.id) };
    if (parentIndex !== undefined) module.parentIndex = parentIndex;
    if (spacious) module.spacious = true;
    out.push(module);
    state.last = kind;
    state.sinceWall = kind === "wall" ? 0 : state.sinceWall + 1;
  };
  while (queue.length) {
    const n = queue.length;
    const last = state.last;
    const run = leadingLandscapes(queue);
    if (n === 1) {
      const previous = out[out.length - 1];
      const attachable =
        previous &&
        previous.parentIndex === parentIndex &&
        ((previous.kind === "wall" && previous.photoIds.length < WALL_MAX) ||
          (previous.kind === "rail" && previous.photoIds.length < RAIL_MAX));
      if (attachable && last === previous.kind) {
        previous.photoIds.push(queue.shift()!.id);
      } else {
        emit("image", 1, isPortrait(queue[0]));
      }
      continue;
    }
    if (run >= 4 && last !== "rail") {
      emit("rail", sizeFor(n, RAIL_MAX, 3));
      continue;
    }
    if (n >= 5 && state.sinceWall >= 3 && last !== "wall") {
      emit("wall", sizeFor(n, WALL_MAX, 3));
      continue;
    }
    if (n === 4 && (last === "image" || last === "hero")) {
      emit("wall", 4);
      continue;
    }
    if (n === 4 && last === "wall") {
      emit("image", 1, isPortrait(queue[0]));
      continue;
    }
    if (n === 2 && last !== "pair") {
      emit("pair", 2);
      continue;
    }
    if (n === 2) {
      // Two photographs left after a pair: fold everything into one wall of four
      // instead of repeating a module type, when that is possible.
      const previous = out[out.length - 1];
      const before = out[out.length - 2];
      if (
        previous?.kind === "pair" &&
        previous.parentIndex === parentIndex &&
        before?.kind !== "wall"
      ) {
        previous.kind = "wall";
        previous.photoIds.push(...queue.splice(0, 2).map((p) => p.id));
        state.last = "wall";
        state.sinceWall = 0;
        continue;
      }
    }
    if (last === "pair") {
      emit("image", 1, isPortrait(queue[0]));
    } else if (last === "image" || last === "hero") {
      emit("pair", 2);
    } else if (isPortrait(queue[0])) {
      emit("pair", 2);
    } else {
      emit("image", 1);
    }
  }
}

function pickHero(photos: DraftPhoto[]): DraftPhoto | null {
  return (
    photos.find((p) => p.featured) ||
    photos.find((p) => !isPortrait(p)) ||
    null
  );
}

export function draftStory(
  input: readonly DraftPhoto[],
  mode: DraftMode,
  options: DraftOptions = {},
): DraftModule[] {
  const de = options.locale === "de";
  const seen = new Set<number>();
  const unique = input
    .filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)))
    .sort(byPosition);
  const coverId = options.coverPhotoId;
  const coverExcluded =
    coverId !== undefined &&
    coverId !== null &&
    unique.length >= 2 &&
    unique.some((p) => p.id === coverId);
  const uploaded = coverExcluded ? unique.filter((p) => p.id !== coverId) : unique;
  if (!uploaded.length) return [];

  // "By mood" with known light: the photographs follow the light arc.
  const light = options.light;
  const lit = mode === "mood" && !!light && uploaded.some((p) => light[p.id]);
  const lightOf = (p: DraftPhoto) => ({ id: p.id, position: p.position, light: light?.[p.id] ?? null, photo: p });
  const photos = lit ? moodArc(uploaded.map(lightOf)).map((x) => x.photo) : uploaded;

  const dated = photos.filter((p) => dayOf(p.taken_at));
  const useDays = mode === "days" && dated.length > 0;

  // Opening image: only once per story, only when there are enough photographs.
  const out: DraftModule[] = [];
  const state: Rhythm = { last: null, sinceWall: 0 };
  let hero: DraftPhoto | null = null;
  if (!coverExcluded && photos.length >= 2) {
    const pool = useDays
      ? (() => {
          const counts = new Map<string, number>();
          for (const p of dated) {
            const day = dayOf(p.taken_at)!;
            counts.set(day, (counts.get(day) || 0) + 1);
          }
          const roomy = photos.filter((p) => {
            const day = dayOf(p.taken_at);
            return day === null || (counts.get(day) || 0) > 1;
          });
          return roomy.length ? roomy : photos;
        })()
      : photos;
    hero = pickHero(pool);
  }
  if (hero) {
    out.push({ kind: "hero", photoIds: [hero.id] });
    state.last = "hero";
  }
  const rest = photos.filter((p) => p !== hero);

  if (!useDays && lit) {
    // Movements of the arc, each opened by a calm single image with white space.
    splitMovements(rest.map(lightOf)).forEach((movement, i) => {
      const list = movement.map((x) => x.photo);
      if (i > 0) {
        out.push({ kind: "image", photoIds: [list.shift()!.id], spacious: true });
        state.last = "image";
        state.sinceWall++;
      }
      rhythmize(list, state, out, undefined);
    });
    return out;
  }

  if (!useDays) {
    rhythmize(rest, state, out, undefined);
    return out;
  }

  const groups = new Map<string, DraftPhoto[]>();
  const undated: DraftPhoto[] = [];
  for (const p of rest) {
    const day = dayOf(p.taken_at);
    if (day) groups.set(day, [...(groups.get(day) || []), p]);
    else undated.push(p);
  }
  let number = 0;
  for (const day of [...groups.keys()].sort()) {
    const list = groups.get(day)!.sort(byTime);
    number++;
    out.push({
      kind: "chapter",
      photoIds: [],
      title: de ? `Tag ${number}` : `Day ${number}`,
      date: day,
    });
    state.last = "chapter";
    rhythmize(list, state, out, out.length - 1);
  }
  if (undated.length) {
    out.push({
      kind: "chapter",
      photoIds: [],
      title: de ? "Weitere Momente" : "More moments",
    });
    state.last = "chapter";
    rhythmize(undated, state, out, out.length - 1);
  }
  return out;
}

const MONTHS = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

/** Titles WANDER creates for a journey that has not been named yet (see NewJournal). */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  const value = (title ?? "").trim();
  return value === "" || value === "Untitled journey" || value === "Unbenannte Reise";
}

/**
 * Suggested journey title from the capture days of the photographs, e.g.
 * "Reise vom 9.–19. August 2025". Null when no capture date is known.
 */
export function suggestJourneyTitle(
  range: { start: string; end: string } | null | undefined,
  locale: "en" | "de" = "de",
): string | null {
  const start = dayOf(range?.start),
    end = dayOf(range?.end);
  if (!start || !end) return null;
  const [lo, hi] = start <= end ? [start, end] : [end, start];
  const part = (day: string) => ({ y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) - 1, d: Number(day.slice(8, 10)) });
  const a = part(lo),
    b = part(hi),
    months = MONTHS[locale],
    de = locale === "de",
    full = (p: typeof a) => (de ? `${p.d}. ${months[p.m]} ${p.y}` : `${p.d} ${months[p.m]} ${p.y}`);
  if (lo === hi) return de ? `Reise am ${full(a)}` : `Journey on ${full(a)}`;
  if (a.y === b.y && a.m === b.m)
    return de
      ? `Reise vom ${a.d}.–${b.d}. ${months[b.m]} ${b.y}`
      : `Journey, ${a.d}–${b.d} ${months[b.m]} ${b.y}`;
  if (a.y === b.y) {
    const short = (p: typeof a) => (de ? `${p.d}. ${months[p.m]}` : `${p.d} ${months[p.m]}`);
    return de
      ? `Reise vom ${short(a)} – ${full(b)}`
      : `Journey, ${short(a)} – ${full(b)}`;
  }
  return de ? `Reise vom ${full(a)} – ${full(b)}` : `Journey, ${full(a)} – ${full(b)}`;
}
