import { countWord } from "./homeLightTable.ts";

export function shouldShowEmptyLibrary(
  loading: boolean,
  error: string,
  journeyCount: number,
) {
  return !loading && !error && journeyCount === 0;
}


/** Second half of the studio title, with the count woven in: "Deine fünf Geschichten." / "Your five stories." */
export function studioStoriesLine(count: number): { en: string; de: string } {
  if (count <= 0) return { en: "Your stories.", de: "Deine Geschichten." };
  if (count === 1) return { en: "Your first story.", de: "Deine erste Geschichte." };
  const word = countWord(count);
  return { en: `Your ${word.en.toLowerCase()} stories.`, de: `Deine ${word.de.toLowerCase()} Geschichten.` };
}

/** Quiet line under the title: "4 veröffentlicht · 1 Entwurf" (empty parts left out). */
export function studioStatusLine(published: number, drafts: number): { en: string; de: string } {
  const en: string[] = [];
  const de: string[] = [];
  if (published) {
    en.push(`${published} published`);
    de.push(`${published} veröffentlicht`);
  }
  if (drafts) {
    en.push(`${drafts} ${drafts === 1 ? "draft" : "drafts"}`);
    de.push(`${drafts} ${drafts === 1 ? "Entwurf" : "Entwürfe"}`);
  }
  return { en: en.join(" · "), de: de.join(" · ") };
}
