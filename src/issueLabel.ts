/** Roman issue numbers and meteorological seasons for the archive. */
const ROMAN: [number, string][] = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];

export function toRoman(n: number): string {
  if (!Number.isFinite(n) || n < 1) return "";
  let rest = Math.min(Math.floor(n), 3999);
  let out = "";
  for (const [v, s] of ROMAN) while (rest >= v) { out += s; rest -= v; }
  return out;
}

export type Season = "winter" | "spring" | "summer" | "autumn";

/** Meteorological season of an ISO date (YYYY-MM-DD...); null when unparseable. */
export function seasonOf(date: string | null | undefined): Season | null {
  const m = /^(\d{4})-(\d{2})/.exec(date ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  if (month <= 8) return "summer";
  return "autumn";
}

const NAMES: Record<Season, [string, string]> = {
  winter: ["Winter", "Winter"],
  spring: ["Spring", "Frühling"],
  summer: ["Summer", "Sommer"],
  autumn: ["Autumn", "Herbst"],
};

/** "ISSUE II · AUTUMN 2026" / "AUSGABE II · HERBST 2026"; season and year are dropped when unknown. */
export function issueKicker(issue: number, date: string | null | undefined, lang: "en" | "de"): string {
  const season = seasonOf(date);
  const year = /^(\d{4})/.exec(date ?? "")?.[1];
  const tail = [season ? NAMES[season][lang === "de" ? 1 : 0] : "", year ?? ""].filter(Boolean).join(" ");
  return [`${lang === "de" ? "Ausgabe" : "Issue"} ${toRoman(issue)}`, tail].filter((s) => s.trim()).join(" · ");
}

export interface Dated {
  id: number;
  start_date?: string | null;
  created_at?: string | null;
  highlights?: readonly { taken_at?: string | null }[];
}

const DAY = /^\d{4}-\d{2}-\d{2}/;

/** Real trip date (YYYY-MM-DD): the author's start date, else the earliest photo capture day, else the creation day, else "". */
export function travelDate(j: Omit<Dated, "id">): string {
  const start = DAY.exec(j.start_date ?? "")?.[0];
  if (start) return start;
  const taken = (j.highlights ?? []).map((p) => DAY.exec(p.taken_at ?? "")?.[0] ?? "").filter(Boolean).sort();
  return taken[0] ?? DAY.exec(j.created_at ?? "")?.[0] ?? "";
}

/** Chronological comparator by travel date (oldest first), ties broken by id. */
export function byTravelDate(a: Dated, b: Dated): number {
  return travelDate(a).localeCompare(travelDate(b)) || a.id - b.id;
}

/** Journeys in travel-date order: newest trip first by default, or earliest first. Ties keep the id order. */
export function sortByTravelDate<T extends Dated>(journeys: readonly T[], order: "newest" | "oldest"): T[] {
  const asc = [...journeys].sort(byTravelDate);
  return order === "newest" ? asc.reverse() : asc;
}

/** Stable issue number per journey: earliest trip = 1, ties broken by id. Independent of display order. */
export function issueNumbers(journeys: readonly Dated[]): Map<number, number> {
  return new Map([...journeys].sort(byTravelDate).map((j, i) => [j.id, i + 1]));
}

/** Key figures for the archive overview. `since` is the earliest start year (null when unknown). */
export function archiveStats(journeys: { country?: string; start_date?: string | null }[]): { count: number; countries: number; since: number | null } {
  const countries = new Set(journeys.map((j) => (j.country ?? "").trim().toLowerCase()).filter(Boolean));
  const years = journeys.map((j) => Number(j.start_date?.slice(0, 4))).filter((y) => Number.isFinite(y) && y > 0);
  return { count: journeys.length, countries: countries.size, since: years.length ? Math.min(...years) : null };
}
