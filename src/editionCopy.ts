// Shared wording of the two editions: used by /inspiration and by the edition picker of a new journey.
export type EditionId = "quiet-atlas" | "after-hours";
type Lang = "de" | "en";

const TRAITS: Record<EditionId, Record<Lang, string[]>> = {
  "quiet-atlas": {
    en: ["Light layout", "Framed", "Calm type"],
    de: ["Helle Darstellung", "Mit Rändern", "Ruhige Typografie"],
  },
  "after-hours": {
    en: ["Dark layout", "Full-bleed", "Cinematic"],
    de: ["Dunkle Darstellung", "Randlos", "Filmisch"],
  },
};

const SAMPLE_TITLES: Record<EditionId, Record<Lang, string>> = {
  "quiet-atlas": { en: "Between snow and stillness", de: "Zwischen Schnee und Stille" },
  "after-hours": { en: "What the sun leaves behind", de: "Was die Sonne dalässt" },
};

export const editionTraits = (id: string, lang: Lang): string[] => TRAITS[id as EditionId]?.[lang] ?? [];

/** Title of the example story: the studio's edition title when set, otherwise the shipped one. */
export const editionSampleTitle = (id: string, lang: Lang, override?: Partial<Record<Lang, string>> | null): string =>
  override?.[lang] || SAMPLE_TITLES[id as EditionId]?.[lang] || "";
