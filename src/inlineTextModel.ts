// Inline text editing in the editor canvas: pure helpers (no DOM).

/** Which text a canvas edit belongs to: a field of the story itself or of one module. */
export type TextTarget =
  | { journey: "title" | "subtitle" | "introduction" | "reflection" | "closing" }
  | { module: number; field: "title" | "story" | "quote" };

/** Text as typed, without the trailing line break browsers add to editable blocks. */
export function cleanEditedText(raw: string, multiline: boolean): string {
  const text = raw.replace(/\r\n?/g, "\n").replace(/ /g, " ");
  return (multiline ? text.replace(/\n+$/, "") : text.replace(/\s*\n\s*/g, " ")).trim();
}

