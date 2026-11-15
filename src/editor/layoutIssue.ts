/**
 * A save rejected because of one layout setting (backend code "invalid_layout"):
 * which module, which setting, in which inspector pane, and a message in plain words.
 * Pure: the caller passes the module's display name and the translate function.
 */
export type LayoutIssue = {
  /** Module ID as sent in the request (negative for unsaved modules); null = journey settings. */
  moduleId: number | null;
  key: string | null;
  pane: "content" | "design";
  message: string;
};

type Translate = (en: string, de: string) => string;

/** Settings that live under „Inhalt“; everything else is under „Gestaltung“. */
const CONTENT_KEYS = new Set([
  "photo_ids", "placements", "filmstrip_placements", "photo_edits", "all_photos", "parent_id", "show_title",
]);

const LABELS: Record<string, [string, string]> = {
  frame: ["Framed", "Gerahmt"],
  columns: ["Columns", "Spalten"],
  rows: ["Rows", "Reihen"],
  gap: ["Spacing", "Abstand"],
  wall_mode: ["Layout", "Darstellung"],
  wall_center: ["Centre rows", "Reihen zentrieren"],
  wall_row: ["Photos per row", "Fotos pro Reihe"],
  size: ["Photo size", "Fotogröße"],
  all_photos: ["All photos of the story", "Alle Fotos der Geschichte"],
  photo_ids: ["Photographs", "Fotos"],
  placements: ["Photographs", "Fotos"],
  filmstrip_placements: ["Photographs", "Fotos"],
  photo_edits: ["Image crop", "Bildausschnitt"],
  parent_id: ["Day", "Tag"],
  ratio: ["Aspect ratio", "Seitenverhältnis"],
  fit: ["Fit", "Einpassung"],
  align: ["Alignment", "Ausrichtung"],
  stagger: ["Offset", "Versatz"],
  margin_x: ["Side margin", "Seitenrand"],
  padding: ["Padding", "Innenabstand"],
  offset: ["Offset", "Versatz"],
  speed: ["Speed", "Tempo"],
  text_size: ["Text size", "Textgröße"],
  text_width: ["Text width", "Textbreite"],
  text_align: ["Text alignment", "Textausrichtung"],
  text_position: ["Text position", "Textposition"],
  background: ["Background", "Hintergrund"],
  text_color: ["Text colour", "Textfarbe"],
  edition: ["Edition", "Edition"],
};

export function layoutIssuePane(key: string | null): LayoutIssue["pane"] {
  return key && CONTENT_KEYS.has(key) ? "content" : "design";
}

export function layoutIssue(
  moduleId: number | null,
  key: string | null,
  moduleName: [string, string] | null,
  translate: Translate,
): LayoutIssue {
  const label = key ? (LABELS[key] ?? [key, key]) : null;
  const setting = label
    ? translate(`setting “${label[0]}” is invalid`, `Einstellung ‚${label[1]}‘ ist ungültig`)
    : translate("a setting is invalid", "eine Einstellung ist ungültig");
  const where = moduleName ? translate(moduleName[0], moduleName[1]) : translate("Story settings", "Geschichte");
  return { moduleId, key, pane: layoutIssuePane(key), message: `${where}: ${setting}` };
}
