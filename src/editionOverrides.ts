// Pure logic for the studio's edition editor and for applying edition covers on public pages.
import { defaultFocus, focusToPosition, normalizeFocus, sameFocus, type HeroFocus } from "./heroFocus.ts";
import type { FocusMap, SiteEdition } from "./types.ts";

export const EDITION_SLOTS = 8;
/** Edition journeys are real but hidden journeys with a fixed look (slug prefix mirrors the backend). */
export const EDITION_JOURNEY_PREFIX = "__edition-";
export const isEditionJourney = (slug: string | null | undefined): boolean => Boolean(slug?.startsWith(EDITION_JOURNEY_PREFIX));
export const TEXT_LIMIT = 160;
export type Lang = "de" | "en";
export type Ref = number | null;

export interface EditionDraft {
  cover: Ref;
  focus: HeroFocus;
  slots: Ref[];
  title: Record<Lang, string>;
  subtitle: Record<Lang, string>;
}

export const limitText = (value: string): string => value.slice(0, TEXT_LIMIT);

/** A shipped photograph of the edition in its own place is the same as "no override". */
export function normalizeSlot(index: number, ref: Ref): Ref {
  return ref === -(index + 1) ? null : ref;
}

export function setSlot(slots: readonly Ref[], index: number, ref: Ref): Ref[] {
  const next = Array.from({ length: EDITION_SLOTS }, (_, i) => slots[i] ?? null);
  if (index >= 0 && index < EDITION_SLOTS) next[index] = normalizeSlot(index, ref);
  return next;
}

export function draftFromServer(edition: Pick<SiteEdition, "cover_photo_id" | "focus" | "slots" | "title" | "subtitle">): EditionDraft {
  return {
    cover: edition.cover_photo_id ?? null,
    focus: normalizeFocus(edition.focus),
    slots: setSlot(edition.slots ?? [], -1, null),
    title: { de: edition.title?.de ?? "", en: edition.title?.en ?? "" },
    subtitle: { de: edition.subtitle?.de ?? "", en: edition.subtitle?.en ?? "" },
  };
}

export function emptyDraft(): EditionDraft {
  return draftFromServer({ cover_photo_id: null, focus: defaultFocus(), slots: [], title: { de: "", en: "" }, subtitle: { de: "", en: "" } });
}

export function isDefaultDraft(draft: EditionDraft): boolean {
  return (
    draft.cover === null &&
    sameFocus(draft.focus, defaultFocus()) &&
    draft.slots.every((slot) => slot === null) &&
    [...Object.values(draft.title), ...Object.values(draft.subtitle)].every((text) => text.trim() === "")
  );
}

export function sameDraft(a: EditionDraft, b: EditionDraft): boolean {
  return (
    a.cover === b.cover &&
    sameFocus(a.focus, b.focus) &&
    a.slots.length === b.slots.length &&
    a.slots.every((slot, index) => slot === b.slots[index]) &&
    (["de", "en"] as const).every(
      (lang) => a.title[lang].trim() === b.title[lang].trim() && a.subtitle[lang].trim() === b.subtitle[lang].trim(),
    )
  );
}

export function toPayload(draft: EditionDraft) {
  return {
    cover_photo_id: draft.cover,
    focus: draft.focus,
    slots: setSlot(draft.slots, -1, null),
    title: { de: limitText(draft.title.de).trim(), en: limitText(draft.title.en).trim() },
    subtitle: { de: limitText(draft.subtitle.de).trim(), en: limitText(draft.subtitle.en).trim() },
  };
}

export type Shape = "portrait" | "landscape";
export const shapeOf = (photo: { width: number; height: number }): Shape => (photo.height > photo.width ? "portrait" : "landscape");
/** True when a photograph's orientation does not match what the layout expects at that place. */
export const shapeMismatch = (expected: Shape | undefined, photo: { width: number; height: number } | null): boolean =>
  Boolean(expected && photo && shapeOf(photo) !== expected);

/** CSS variables for the per-breakpoint cover crop; undefined for the centred default. */
export function coverFocusVars(focus: FocusMap | null | undefined): Record<string, string> | undefined {
  if (!focus) return undefined;
  const value = normalizeFocus(focus);
  return {
    "--cover-pos-desktop": focusToPosition(value.desktop),
    "--cover-pos-tablet": focusToPosition(value.tablet),
    "--cover-pos-mobile": focusToPosition(value.mobile),
  };
}

/** Archive band crop: the journey's own archive_focus, else its cover focus. */
export function archiveFocusVars(journey: { cover_focus?: FocusMap | null; layout?: { archive_focus?: FocusMap | null } | null }): Record<string, string> | undefined {
  return coverFocusVars(journey.layout?.archive_focus ?? journey.cover_focus);
}
