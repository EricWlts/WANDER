/**
 * Pure logic for the "form" of a story. Technically everything stays a Journey;
 * the form only changes how it is presented and which defaults apply:
 * - journey: several days, told day by day (period of dates);
 * - collection: pictures on one theme, freely arranged (year or nothing);
 * - moment: one day, one place, few pictures (a single date).
 * The form lives in the journey's `layout.form`. A missing or unknown value
 * always means "journey", so older journeys need no migration.
 */
import { dayOf } from "./storyDraft.ts";
import type { Layout } from "./types";

export type JourneyForm = "journey" | "collection" | "moment";
export type FormLocale = "en" | "de";
export type FormDraftMode = "days" | "mood";

export const JOURNEY_FORMS: readonly JourneyForm[] = ["journey", "collection", "moment"];

export function isJourneyForm(value: unknown): value is JourneyForm {
  return typeof value === "string" && (JOURNEY_FORMS as readonly string[]).includes(value);
}

/** Form of a journey (or of its layout); a missing or unknown value is "journey". */
export function formOf(
  source: { layout?: { form?: unknown } | null; form?: unknown } | null | undefined,
): JourneyForm {
  const value = source?.layout?.form ?? source?.form;
  return isJourneyForm(value) ? value : "journey";
}

/**
 * Layout with the form set. "journey" is the default and is stored as an absent
 * key, so journeys stay byte-identical to what older versions saved.
 */
export function withForm(layout: Layout | null | undefined, form: JourneyForm): Layout {
  const { form: _previous, ...rest } = layout ?? {};
  return form === "journey" ? rest : { ...rest, form };
}

/** Arrangement preselected in "Story gestalten": journeys by days, the others by mood. */
export function defaultDraftModeForForm(form: JourneyForm): FormDraftMode {
  return form === "journey" ? "days" : "mood";
}

/**
 * Preselection with the photographs in mind. A journey keeps the existing rule
 * ("by days" when at least half of the photographs carry a date); collections
 * and moments are always arranged by mood.
 */
export function initialDraftMode(form: JourneyForm, total: number, dated: number): FormDraftMode {
  if (form !== "journey") return "mood";
  return total > 0 && dated * 2 >= total ? "days" : "mood";
}

export interface DateFormatters {
  /** "03 May — 09 May 2026" for a range. */
  range: (start: string, end: string) => string;
  /** One full day, e.g. "09 May 2026". */
  day: (day: string) => string;
}

const YEAR = /^(\d{4})/;
const DAY = /^\d{4}-\d{2}-\d{2}/;

/**
 * Date line of a story: journey → period, moment → one date, collection → the
 * year (or years) only. Empty when there is nothing usable to show.
 */
export function formDateText(
  form: JourneyForm,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
  format: DateFormatters,
): string {
  const start = DAY.exec(startDate ?? "")?.[0];
  if (!start) return "";
  const end = DAY.exec(endDate ?? "")?.[0] ?? start;
  if (form === "moment") return format.day(start);
  if (form === "collection") {
    const from = YEAR.exec(start)![1],
      to = YEAR.exec(end)![1];
    return from === to || to < from ? from : `${from} — ${to}`;
  }
  return format.range(start, end);
}

const NAMES: Record<JourneyForm, { name: [string, string]; placeholder: [string, string]; next: [string, string]; chapter: [string, string] }> = {
  journey: {
    name: ["Journey", "Reise"],
    placeholder: ["Untitled journey", "Unbenannte Reise"],
    next: ["Next journey", "Nächste Reise"],
    chapter: ["Day", "Tag"],
  },
  collection: {
    name: ["Collection", "Sammlung"],
    placeholder: ["Untitled collection", "Unbenannte Sammlung"],
    next: ["Next story", "Nächste Geschichte"],
    chapter: ["Chapter", "Kapitel"],
  },
  moment: {
    name: ["Moment", "Moment"],
    placeholder: ["Untitled moment", "Unbenannter Moment"],
    next: ["Next story", "Nächste Geschichte"],
    chapter: ["Chapter", "Kapitel"],
  },
};

const pick = (pair: [string, string], locale: FormLocale) => pair[locale === "de" ? 1 : 0];

export function formName(form: JourneyForm, locale: FormLocale): string {
  return pick(NAMES[form].name, locale);
}

/** Title WANDER gives a story that has not been named yet. */
export function placeholderTitle(form: JourneyForm, locale: FormLocale): string {
  return pick(NAMES[form].placeholder, locale);
}

/** True for empty titles and for every placeholder title in either language. */
export function isPlaceholderTitleOfAnyForm(title: string | null | undefined): boolean {
  const value = (title ?? "").trim();
  if (value === "") return true;
  return JOURNEY_FORMS.some((form) => NAMES[form].placeholder.includes(value));
}

/** "Next journey" for journeys, "Next story" for every other form. */
export function nextStoryLabel(form: JourneyForm, locale: FormLocale): string {
  return pick(NAMES[form].next, locale);
}

/** Eyebrow word in front of the chapter number: "Day" for journeys, otherwise "Chapter". */
export function chapterWord(form: JourneyForm, locale: FormLocale): string {
  return pick(NAMES[form].chapter, locale);
}

const GENERATED_DAY_TITLE = /^(?:Tag|Day) \d+$/;

/**
 * "Day n" / "Tag n" is only handed out automatically for journeys. For the other
 * forms a generated day title is replaced by the date of that day (or a neutral
 * chapter word when no date is known).
 */
export function draftChapterTitle(
  form: JourneyForm,
  generated: string | undefined,
  date: string | undefined,
  formatDay: (day: string) => string,
  locale: FormLocale,
): string | undefined {
  if (form === "journey" || generated === undefined || !GENERATED_DAY_TITLE.test(generated)) return generated;
  return date ? formatDay(date) : pick(NAMES[form].chapter, locale);
}

const MONTHS = {
  de: ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
} as const;

/**
 * Title proposed from the capture days when the story is still unnamed.
 * - journey: handled by suggestJourneyTitle (storyDraft.ts), so null here;
 * - moment: "Moment am 9. August 2025" for the first capture day;
 * - collection: no date in the title, null.
 */
export function suggestMomentTitle(
  range: { start: string; end: string } | null | undefined,
  locale: FormLocale = "de",
): string | null {
  const start = dayOf(range?.start);
  if (!start) return null;
  const year = Number(start.slice(0, 4)),
    month = MONTHS[locale][Number(start.slice(5, 7)) - 1],
    day = Number(start.slice(8, 10));
  return locale === "de" ? `Moment am ${day}. ${month} ${year}` : `Moment on ${day} ${month} ${year}`;
}
