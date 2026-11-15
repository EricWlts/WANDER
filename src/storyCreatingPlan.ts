export type CreatingLine = { en: string; de: string };

export const CREATING_LINE_MS = 1100;
export const CREATING_REDUCED_MS = 900;

/** Sequence and timing of the transition lines; one static line with reduced motion. */
export function storyCreatingPlan(reduced: boolean, edition: string): { lines: CreatingLine[]; lineMs: number; totalMs: number } {
  const lines: CreatingLine[] = [
    { en: "Your story is being made for you …", de: "Deine Geschichte wird für dich erstellt …" },
    { en: "Your photographs are finding their order …", de: "Die Fotos finden ihre Reihenfolge …" },
    edition === "after-hours"
      ? { en: "Evening falls …", de: "Es wird Abend …" }
      : { en: "Setting the light …", de: "Das Licht wird gesetzt …" },
    { en: "Almost there.", de: "Gleich geht’s los." },
  ];
  if (reduced) return { lines: lines.slice(0, 1), lineMs: CREATING_REDUCED_MS, totalMs: CREATING_REDUCED_MS };
  return { lines, lineMs: CREATING_LINE_MS, totalMs: lines.length * CREATING_LINE_MS };
}

export function prefersReducedMotion(): boolean {
  if (typeof document === "undefined" || typeof window === "undefined") return false;
  if (document.documentElement.dataset.motion === "off") return true;
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
