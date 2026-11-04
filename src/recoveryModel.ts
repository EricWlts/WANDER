import type { Journey } from "./types";

type Check = (value: unknown) => boolean;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const text: Check = (value) => typeof value === "string";
const number: Check = (value) =>
  typeof value === "number" && Number.isFinite(value);
const boolean: Check = (value) => typeof value === "boolean";
const id: Check = (value) =>
  typeof value === "number" && Number.isSafeInteger(value) && value !== 0;
const photoId: Check = (value) => id(value) && (value as number) > 0;
const nullable = (check: Check): Check => (value) => value === null || check(value);
const list = (check: Check): Check => (value) =>
  Array.isArray(value) && value.every(check);
const oneOf = (...values: string[]): Check => (value) =>
  typeof value === "string" && values.includes(value);
const fields = (value: Record<string, unknown>, keys: string, check: Check) =>
  keys.split(" ").every((key) => check(value[key]));
const optional = (value: Record<string, unknown>, keys: string, check: Check) =>
  keys.split(" ").every((key) => value[key] === undefined || check(value[key]));
const ratio = oneOf("original", "free", "1:1", "3:2", "4:3", "4:5", "16:9");
const fit = oneOf("cover", "contain");
const edition = oneOf("quiet-atlas", "after-hours");

function edits(value: unknown): boolean {
  return record(value) &&
    optional(value, "ratio", ratio) &&
    optional(value, "fit", fit) &&
    optional(value, "x y zoom free_ratio hover_zoom", number) &&
    optional(value, "show_title", boolean);
}

function placements(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((placement) => {
    if (!record(placement) || typeof placement.id !== "string" ||
      !placement.id || ids.has(placement.id) || !photoId(placement.photo_id) ||
      !optional(placement, "edits", edits)) return false;
    ids.add(placement.id);
    return true;
  });
}

function layout(value: unknown): boolean {
  return record(value) &&
    optional(value, "placements filmstrip_placements", placements) &&
    optional(value, "photo_ids", list(photoId)) &&
    optional(value, "photo_edits", (entries) =>
      record(entries) && Object.values(entries).every(edits)) &&
    optional(value, "column_offsets", list(number)) &&
    optional(value, "parent_id", id) &&
    optional(value, "background text_color", text) &&
    optional(value, "hover_zoom parallax_intensity text_width font_weight text_size inset columns rows gap padding offset mobile_columns mobile_gap mobile_padding title_size speed", number) &&
    optional(value, "text_animations show_title parallax rail_loop", boolean) &&
    optional(value, "rail_mode", oneOf("free", "single")) &&
    optional(value, "text_position", oneOf("left", "center", "right", "full")) &&
    optional(value, "text_align", oneOf("left", "center", "right")) &&
    optional(value, "text_preset", oneOf("small", "medium", "large", "display")) &&
    optional(value, "font", oneOf("serif", "sans")) &&
    optional(value, "edition", oneOf("inherit", "quiet-atlas", "after-hours")) &&
    optional(value, "ratio", ratio) && optional(value, "fit", fit) &&
    optional(value, "align", oneOf("flush", "staggered")) &&
    optional(value, "title_style", oneOf("overlay", "overlap", "below"));
}

function reveal(value: unknown): boolean {
  return record(value) &&
    optional(value, "effect", oneOf("none", "fade", "up", "down", "left", "right", "zoom", "parallax", "inherit")) &&
    optional(value, "duration delay intensity", number);
}

function photo(value: unknown): boolean {
  return record(value) && photoId(value.id) &&
    fields(value, "original_url", nullable(text)) &&
    fields(value, "chapter_id", nullable(id)) &&
    fields(value, "large_url title description alt url srcset credit source_url", text) &&
    fields(value, "width height position", number) &&
    fields(value, "featured demo", boolean) &&
    optional(value, "placement_id", text) && optional(value, "edits", edits);
}

function chapter(value: unknown): boolean {
  return record(value) && id(value.id) &&
    fields(value, "title date story quote", text) && number(value.position) &&
    oneOf("chapter", "text", "quote", "gallery", "hero", "image", "pair", "rail", "filmstrip", "wall")(value.kind) &&
    oneOf("editorial", "horizontal")(value.gallery_mode) &&
    reveal(value.reveal) && optional(value, "layout", layout);
}

// Validate shapes, not source references: legacy assignments and missing photo
// sources are handled by the existing model. Never rewrite the stored draft.
export function isRecoveryJourney(value: unknown, journeyId: number): value is Journey {
  if (!record(value) || !photoId(value.id) || value.id !== journeyId ||
    !fields(value, "slug title subtitle location country start_date end_date description introduction reflection closing", text) ||
    !fields(value, "studio_step photo_count chapter_count", number) ||
    !fields(value, "published demo", boolean) ||
    !optional(value, "is_example has_unpublished_changes", boolean) ||
    !edition(value.story_template) || !oneOf("quiet", "cinematic", "gallery")(value.preset) ||
    !nullable(photoId)(value.cover_id) || !nullable(photo)(value.cover) ||
    !list(photoId)(value.filmstrip_ids) ||
    !record(value.reveal_settings) ||
    !optional(value.reveal_settings, "default title introduction reflection closing images", reveal) ||
    !optional(value, "layout", layout) ||
    !Array.isArray(value.photos) || !value.photos.every(photo) ||
    !Array.isArray(value.chapters) || !value.chapters.every(chapter)) return false;

  const photos = value.photos as Record<string, unknown>[];
  const chapters = value.chapters as Record<string, unknown>[];
  if (new Set(photos.map((p) => p.id)).size !== photos.length ||
    new Set(chapters.map((c) => c.id)).size !== chapters.length) return false;

  // A cyclic parent chain cannot be rendered or edited reliably.
  const parents = new Map(chapters.map((c) => [c.id, (c.layout as Record<string, unknown> | undefined)?.parent_id]));
  for (const c of chapters) {
    const seen = new Set<unknown>([c.id]);
    let parent = parents.get(c.id);
    while (parent !== undefined && parents.has(parent)) {
      if (seen.has(parent)) return false;
      seen.add(parent);
      parent = parents.get(parent);
    }
  }
  return true;
}
