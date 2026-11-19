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
      !optional(placement, "edits", edits) ||
      !optional(placement, "size", oneOf("s", "m", "l"))) return false;
    ids.add(placement.id);
    return true;
  });
}

/** Every key of Layout in src/types.ts. Guarded by tests/layoutContract.test.ts against types.ts and backend/app.py. */
export const LAYOUT_KEYS = [
  "form", "placements", "filmstrip_placements", "hover_zoom", "parallax_intensity", "image_parallax",
  "background", "text_color", "text_position", "text_width", "text_preset", "font_weight", "text_animations",
  "column_offsets", "photo_edits", "font", "text_size", "text_align", "inset", "media_width", "media_spacing",
  "media_spacing_top", "media_spacing_bottom", "frame", "edition", "photo_ids", "parent_id", "columns", "rows",
  "gap", "padding", "offset", "mobile_columns", "mobile_gap", "mobile_padding", "ratio", "fit", "align",
  "title_style", "title_size", "title_x", "title_y", "edition_fill", "margin_x", "stagger", "dates_from_photos",
  "archive_focus", "show_title", "parallax", "speed", "rail_mode", "rail_size", "rail_loop", "wall_mode", "wall_center",
  "wall_row", "all_photos", "edge_to_edge",
] as const;

function layout(value: unknown): boolean {
  return record(value) &&
    optional(value, "placements filmstrip_placements", placements) &&
    optional(value, "photo_ids", list(photoId)) &&
    optional(value, "photo_edits", (entries) =>
      record(entries) && Object.values(entries).every(edits)) &&
    optional(value, "column_offsets", list(number)) &&
    optional(value, "parent_id", id) &&
    optional(value, "background text_color", text) &&
    Object.keys(value).every((key) => (LAYOUT_KEYS as readonly string[]).includes(key)) &&
    optional(value, "hover_zoom parallax_intensity text_width font_weight text_size inset columns rows gap padding offset mobile_columns mobile_gap mobile_padding title_size speed media_spacing media_spacing_top media_spacing_bottom title_x title_y margin_x stagger wall_row", number) &&
    optional(value, "text_animations show_title parallax image_parallax rail_loop edition_fill dates_from_photos frame wall_center all_photos edge_to_edge", boolean) &&
    optional(value, "form", oneOf("journey", "collection", "moment")) &&
    optional(value, "media_width", oneOf("cover-image", "cover-frame")) &&
    optional(value, "wall_mode", oneOf("balanced", "grid")) &&
    optional(value, "rail_mode", oneOf("free", "single")) &&
    optional(value, "rail_size", oneOf("normal", "large")) &&
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

export function canRestoreRecovery(draft: Journey, current: Journey): boolean {
  const version = draft.composition_version;
  if (
    draft.id !== current.id || draft.slug !== current.slug ||
    typeof version !== "number" || !Number.isSafeInteger(version) || version < 1 ||
    version !== current.composition_version
  ) return false;

  const sources = new Set(current.photos.map((photo) => photo.id));
  if (sources.size !== draft.photos.length || !draft.photos.every((photo) => sources.has(photo.id)))
    return false;

  const references = [
    ...(draft.cover_id === null ? [] : [String(draft.cover_id)]),
    ...draft.filmstrip_ids.map(String),
    ...[draft.layout, ...draft.chapters.map((chapter) => chapter.layout)].flatMap((layout) => [
      ...(layout?.photo_ids ?? []).map(String),
      ...Object.keys(layout?.photo_edits ?? {}),
      ...(layout?.placements ?? []).map((placement) => String(placement.photo_id)),
      ...(layout?.filmstrip_placements ?? []).map((placement) => String(placement.photo_id)),
    ]),
  ];
  const sourceKeys = new Set(Array.from(sources, String));
  return references.every((id) => sourceKeys.has(id));
}

type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type RecoveryCopy = {
  storage: RecoveryStorage;
  key: string;
  raw: string;
  draft: Journey;
};

function readCopy(storage: RecoveryStorage, key: string, id: number): RecoveryCopy | null {
  try {
    const raw = storage.getItem(key);
    if (raw === null) return null;
    const draft: unknown = JSON.parse(raw);
    return isRecoveryJourney(draft, id) ? { storage, key, raw, draft } : null;
  } catch {
    return null;
  }
}

export function readRecoveries(stores: RecoveryStorage[], id: number): RecoveryCopy[] {
  const key = `wander-recovery-${id}`;
  return stores.flatMap((storage) => readCopy(storage, key, id) ?? []);
}

export function writeRecovery(
  stores: RecoveryStorage[], draft: Journey, owned: RecoveryCopy | null,
): RecoveryCopy | null {
  const key = `wander-recovery-${draft.id}`;
  const raw = JSON.stringify(draft);
  // Prefer the existing slot. Use the session slot when another copy occupies local storage.
  const candidates = owned?.key === key
    ? [owned.storage, ...stores.filter((storage) => storage !== owned.storage)]
    : stores;
  for (const storage of candidates) {
    let updatingOwnedCopy = false;
    try {
      const previous = storage.getItem(key);
      updatingOwnedCopy = owned?.storage === storage && owned.key === key && owned.raw === previous;
      if (previous !== null && !updatingOwnedCopy) continue;
      storage.setItem(key, raw);
      return { storage, key, raw, draft };
    } catch {
      // Keep ownership of the older backup if updating it failed.
      if (updatingOwnedCopy) return null;
    }
  }
  return null;
}

export function removeRecovery(copy: RecoveryCopy): boolean {
  try {
    if (copy.storage.getItem(copy.key) === copy.raw) copy.storage.removeItem(copy.key);
    return true;
  } catch {
    return false;
  }
}
