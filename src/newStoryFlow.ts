/**
 * Pure logic of the "new story" assistant (/studio/new): four steps, one at a time.
 * 1 photographs, 2 edition, 3 structure, 4 a few words (optional). Nothing here touches the DOM or the network.
 */
import type { FormDraftMode, JourneyForm } from "./journeyForm.ts";
import { dayOf, draftStory, type DraftKind, type DraftOptions, type DraftPhoto } from "./storyDraft.ts";

export type FlowStep = 1 | 2 | 3 | 4;
export const FLOW_STEPS: readonly FlowStep[] = [1, 2, 3, 4];

export type StoryEdition = "quiet-atlas" | "after-hours";
export type StructureOption = "days" | "mood" | "moment";
export const STRUCTURE_OPTIONS: readonly StructureOption[] = ["days", "mood", "moment"];

export interface FlowState {
  /** Photographs of the story that finished processing. */
  photos: number;
  /** An upload is still running. */
  uploading: boolean;
}

/** Step from the URL (?step=2). Steps 2 to 4 need a photograph; everything else means step 1. */
export function stepFromParam(value: string | null | undefined, photos: number): FlowStep {
  const n = Number(value);
  if (n === 2 || n === 3 || n === 4) return photos > 0 ? n : 1;
  return 1;
}

/** "Weiter" on step 1 needs a finished photograph and no running upload; steps 2 to 4 can always go on. */
export function canContinue(step: FlowStep, state: FlowState): boolean {
  if (step === 1) return state.photos > 0 && !state.uploading;
  return true;
}

export function nextStep(step: FlowStep): FlowStep {
  return step === 1 ? 2 : step === 2 ? 3 : 4;
}

export function previousStep(step: FlowStep): FlowStep {
  return step === 4 ? 3 : step === 3 ? 2 : 1;
}

/** Edition from ?template=; anything but "after-hours" means First Light. */
export function editionFromParam(value: string | null | undefined): StoryEdition {
  return value === "after-hours" ? "after-hours" : "quiet-atlas";
}

/** Form and draft mode that belong to an option of step 3. */
export function structureFor(option: StructureOption): { form: JourneyForm; mode: FormDraftMode } {
  if (option === "days") return { form: "journey", mode: "days" };
  if (option === "moment") return { form: "moment", mode: "mood" };
  return { form: "collection", mode: "mood" };
}

/** "By days" is preselected when any photograph carries a capture date, otherwise "by mood". */
export function defaultStructure(dated: number): StructureOption {
  return dated > 0 ? "days" : "mood";
}

/** "By days" stays selectable without capture dates, but gets a small note. */
export function needsDaysNote(option: StructureOption, dated: number): boolean {
  return option === "days" && dated <= 0;
}

/** Edition preset that goes with the starting edition (as when a story is created). */
export function presetFor(edition: StoryEdition): "quiet" | "cinematic" {
  return edition === "after-hours" ? "cinematic" : "quiet";
}

/** Query string for the editor: start the draft once, in the chosen mode. */
export function editorStartQuery(mode: FormDraftMode): string {
  return `start=1&mode=${mode}`;
}

/** Draft mode from ?mode= in the editor; undefined means "decide from the photographs". */
export function draftModeFromParam(value: string | null | undefined): FormDraftMode | undefined {
  return value === "days" || value === "mood" ? value : undefined;
}

/** Words typed in step 4. `days` is keyed by capture day (YYYY-MM-DD). */
export interface StoryWords {
  title: string;
  intro: string;
  days: Record<string, { title: string; text: string }>;
}

export const EMPTY_WORDS: StoryWords = { title: "", intro: "", days: {} };

/** sessionStorage key under which the words wait for the editor (one per story). */
export function wordsKey(slug: string): string {
  return `wander:story-words:${slug}`;
}

export interface DayEntry {
  /** Capture day, YYYY-MM-DD. */
  date: string;
  /** Photograph that shows this day in step 4: the earliest of the day. */
  photoId: number;
  /** 1-based position among the days, as in the draft ("Tag 1"). */
  number: number;
}

interface DayPhoto {
  id: number;
  taken_at?: string | null;
  position: number;
}

/** Capture days of the photographs, ascending, same grouping as the draft (dayOf). Undated photographs are skipped. */
export function storyDays(photos: readonly DayPhoto[]): DayEntry[] {
  const first = new Map<string, DayPhoto>();
  for (const p of photos) {
    const day = dayOf(p.taken_at);
    if (!day) continue;
    const current = first.get(day);
    const earlier =
      !current ||
      (p.taken_at || "") < (current.taken_at || "") ||
      ((p.taken_at || "") === (current.taken_at || "") && (p.position < current.position || (p.position === current.position && p.id < current.id)));
    if (earlier) first.set(day, p);
  }
  return [...first.keys()].sort().map((date, i) => ({ date, photoId: first.get(date)!.id, number: i + 1 }));
}

/**
 * Trims the words and keeps what belongs to the chosen structure: days only "by days",
 * the intro sentence otherwise. Null when nothing was written (= same as skipping).
 */
export function compactWords(words: StoryWords, option: StructureOption, days: readonly DayEntry[]): StoryWords | null {
  const out: StoryWords = { title: words.title.trim(), intro: "", days: {} };
  if (option === "days" && days.length > 0) {
    for (const d of days) {
      const entry = words.days[d.date];
      const title = (entry?.title ?? "").trim(),
        text = (entry?.text ?? "").trim();
      if (title || text) out.days[d.date] = { title, text };
    }
  } else out.intro = words.intro.trim();
  return out.title || out.intro || Object.keys(out.days).length ? out : null;
}

/** Reads words back from sessionStorage JSON; anything malformed means "no words". */
export function parseWords(raw: string | null | undefined): StoryWords | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<StoryWords>;
    if (!v || typeof v !== "object") return null;
    const days: StoryWords["days"] = {};
    for (const [k, e] of Object.entries(v.days && typeof v.days === "object" ? v.days : {})) {
      const title = typeof e?.title === "string" ? e.title : "",
        text = typeof e?.text === "string" ? e.text : "";
      if (title || text) days[k] = { title, text };
    }
    const out = {
      title: typeof v.title === "string" ? v.title : "",
      intro: typeof v.intro === "string" ? v.intro : "",
      days,
    };
    return out.title || out.intro || Object.keys(days).length ? out : null;
  } catch {
    return null;
  }
}

/** Station of the film strip (progress): finished, current or still ahead. */
export type StationState = "done" | "active" | "next";

export function stationState(station: FlowStep, step: FlowStep): StationState {
  return station < step ? "done" : station === step ? "active" : "next";
}

/** Share of the film strip that is filled: up to and including the current station. */
export function filmFill(step: FlowStep): number {
  return step / FLOW_STEPS.length;
}

/** Only finished stations can be opened again (never a step ahead). */
export function canOpenStation(station: FlowStep, step: FlowStep): boolean {
  return station < step;
}

interface CoverPhoto {
  id: number;
  width: number;
  height: number;
  position: number;
}

/** Cover preview of step 1: the first landscape photograph (by position), if any. */
export function coverCandidate<T extends CoverPhoto>(photos: readonly T[]): T | undefined {
  return [...photos]
    .sort((a, b) => a.position - b.position || a.id - b.id)
    .find((p) => p.width > p.height);
}

export interface PreviewModule {
  kind: DraftKind;
  photoIds: number[];
  /** Width / height of every photograph, so the miniature never crops. */
  ratios: number[];
  /** Photographs per row (a wall of four is two rows of two). */
  rows: number[];
  /** Width of the module as a share of the page width (0–1). */
  width: number;
  /** Height of the module as a share of the page width. */
  height: number;
  /** Chapter heading ("Tag 1"), only "by days". */
  title?: string;
  date?: string;
}

export interface StructurePreview {
  modules: PreviewModule[];
  /** Image modules of the draft that did not fit into the miniature. */
  more: number;
}

/**
 * Proportions of a miniature page, all as shares of its content width.
 * Must match .new-story-preview in new-story.css: a 4:5 frame; inside it, cqi is a
 * hundredth of the content width. Framed (First Light): 6% padding, 3cqi gap,
 * 11cqi heading line. Bleed (Last Light): no padding, 2cqi gap, 11cqi heading line.
 */
export interface PreviewFrame {
  height: number;
  gap: number;
  heading: number;
  /** Width of a single "image" module (a hero is always full width). */
  image: number;
}
export const PREVIEW_FRAME: Record<"framed" | "bleed", PreviewFrame> = {
  framed: { height: (1.25 - 0.12) / 0.88, gap: 0.03, heading: 0.11, image: 0.64 },
  bleed: { height: 1.25, gap: 0.02, heading: 0.11, image: 1 },
};

/** Photographs a miniature shows per module, so the previews stay legible. */
export const PREVIEW_PHOTO_CAP: Record<DraftKind, number> = { chapter: 0, hero: 1, image: 1, pair: 2, rail: 3, wall: 4 };

const ratioOf = (p: DraftPhoto | undefined) => (p && p.width > 0 && p.height > 0 ? p.width / p.height : 3 / 2);

function rowsFor(kind: DraftKind, count: number): number[] {
  if (kind === "wall" && count === 4) return [2, 2];
  return count ? [count] : [];
}

/** Natural height of a module at a given width: rows of equal height, photographs uncropped. */
function moduleHeight(ratios: readonly number[], rows: readonly number[], width: number, gap: number): number {
  let i = 0,
    h = 0;
  for (const n of rows) {
    const sum = ratios.slice(i, i + n).reduce((a, b) => a + b, 0) || 1;
    h += (width - gap * (n - 1)) / sum;
    i += n;
  }
  return h + gap * Math.max(0, rows.length - 1);
}

/**
 * Miniature of step 3: a shrunken real page. Takes the modules draftStory() designs
 * for an option, keeps every photograph's aspect ratio and shows only the modules
 * that fit whole into the frame. Chapters only "by days" (it opens on the first one,
 * never ends on one); "as a moment"
 * is one large picture under its date. The first picture is scaled down to fit.
 */
export function structurePreview(
  photos: readonly DraftPhoto[],
  option: StructureOption,
  options: DraftOptions & { frame?: PreviewFrame } = {},
): StructurePreview {
  const { frame = PREVIEW_FRAME.framed, ...rest } = options;
  const { mode } = structureFor(option);
  const byId = new Map(photos.map((p) => [p.id, p]));
  const out: PreviewModule[] = [];
  // Only "by mood" follows the light arc; "as a moment" keeps the upload order.
  const draftOptions = option === "mood" ? rest : { ...rest, light: undefined };
  const draft = draftStory(photos, mode, draftOptions);
  const total = draft.filter((m) => m.kind !== "chapter").length;
  let shown = 0;
  let used = option === "moment" ? frame.heading : 0;
  const budget = frame.height * 0.98;
  const gapBefore = () => (out.length || option === "moment" ? frame.gap : 0);
  // "By days" opens on its first day line, so it reads as days at a glance.
  const firstChapter = draft.findIndex((m) => m.kind === "chapter");
  const start = option === "days" && firstChapter > 0 ? firstChapter : 0;
  for (const m of draft.slice(start)) {
    if (option === "moment" && shown >= 1) break;
    if (m.kind === "chapter") {
      if (option !== "days") continue;
      const h = gapBefore() + frame.heading;
      if (used + h > budget) break;
      out.push({ kind: "chapter", photoIds: [], ratios: [], rows: [], width: 1, height: frame.heading, title: m.title, date: m.date });
      used += h;
      continue;
    }
    // "As a moment" is one large picture under its date.
    const kind: DraftKind = option === "moment" ? "hero" : m.kind;
    const photoIds = m.photoIds.slice(0, option === "moment" ? 1 : PREVIEW_PHOTO_CAP[m.kind]);
    const ratios = photoIds.map((id) => ratioOf(byId.get(id)));
    const rows = rowsFor(kind, photoIds.length);
    const single = rows.length === 1 && rows[0] === 1;
    let width = single && kind === "image" ? frame.image : 1;
    let height = moduleHeight(ratios, rows, width, frame.gap);
    const room = budget - used - gapBefore();
    if (height > room) {
      // The first picture always shows, scaled down; later ones only when they fit whole.
      if (shown > 0 || room <= 0) break;
      // Height grows linearly with width (gaps stay fixed): solve for the width that fills the room.
      const h0 = moduleHeight(ratios, rows, 0, frame.gap),
        h1 = moduleHeight(ratios, rows, 1, frame.gap);
      width = h1 > h0 ? (room - h0) / (h1 - h0) : 0;
      if (width < 0.2) break;
      height = room;
    }
    used += gapBefore() + height;
    out.push({ kind, photoIds, ratios, rows, width, height });
    shown += 1;
  }
  while (out.length && out[out.length - 1].kind === "chapter") out.pop();
  return { modules: out, more: total - shown };
}
