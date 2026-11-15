import type { Chapter, Layout } from "./types";

export type ModuleKind = Chapter["kind"];
export type Bilingual = readonly [string, string];

/** Abstract thumbnail description rendered by pure CSS (grey blocks and lines). */
export interface PresetPreview {
  blocks: number;
  gap: 0 | 1 | 2 | 3;
  pad: 0 | 1 | 2 | 3;
  shift?: readonly number[];
  lines?: number;
  size?: "s" | "m" | "l";
  centered?: boolean;
  framed?: boolean;
  below?: boolean;
}
export interface StylePreset {
  id: string;
  label: Bilingual;
  /** Every key a preset of this kind controls is listed; undefined means "module default". */
  values: Partial<Layout>;
  preview: PresetPreview;
}

/** Module picker: every module at a glance, in three groups (display order). */
export const pickerGroups: readonly {
  id: "tell" | "one" | "many";
  title: Bilingual;
  kinds: readonly ModuleKind[];
}[] = [
  { id: "tell", title: ["Tell", "Erzählen"], kinds: ["chapter", "text", "quote"] },
  {
    id: "one",
    title: ["One picture, two pictures", "Ein Bild, zwei Bilder"],
    kinds: ["hero", "image", "pair"],
  },
  {
    id: "many",
    title: ["Many pictures", "Viele Bilder"],
    kinds: ["rail", "wall", "gallery", "filmstrip"],
  },
];

const textKeys: Partial<Layout> = {
  font: undefined,
  text_preset: undefined,
  text_size: undefined,
  text_width: undefined,
  text_align: undefined,
  text_position: undefined,
};

const mediaZero = {
  media_spacing: 0,
  media_spacing_top: 0,
  media_spacing_bottom: 0,
};

const PRESETS: Record<ModuleKind, StylePreset[]> = {
  chapter: [
    {
      id: "calm",
      label: ["Calm", "Ruhig"],
      values: { ...textKeys },
      preview: { blocks: 0, gap: 1, pad: 2, lines: 3, size: "s" },
    },
    {
      id: "narrative",
      label: ["Narrative", "Erzählend"],
      values: {
        ...textKeys,
        font: "serif",
        text_preset: "medium",
        text_size: 22,
        text_width: 56,
      },
      preview: { blocks: 0, gap: 1, pad: 2, lines: 3, size: "m" },
    },
    {
      id: "editorial",
      label: ["Large & editorial", "Groß & editorial"],
      values: {
        ...textKeys,
        font: "serif",
        text_preset: "large",
        text_size: 30,
        text_width: 44,
      },
      preview: { blocks: 0, gap: 1, pad: 2, lines: 2, size: "l" },
    },
  ],
  text: [
    {
      id: "calm",
      label: ["Calm", "Ruhig"],
      values: { ...textKeys, padding: 32 },
      preview: { blocks: 0, gap: 1, pad: 2, lines: 3, size: "s" },
    },
    {
      id: "editorial",
      label: ["Large & editorial", "Groß & editorial"],
      values: {
        ...textKeys,
        font: "serif",
        text_preset: "large",
        text_size: 30,
        text_width: 44,
        padding: 56,
      },
      preview: { blocks: 0, gap: 1, pad: 2, lines: 2, size: "l" },
    },
    {
      id: "accent",
      label: ["Quote accent", "Zitat-Akzent"],
      values: {
        ...textKeys,
        font: "serif",
        text_preset: "display",
        text_size: 44,
        text_width: 36,
        text_align: "center",
        padding: 72,
      },
      preview: { blocks: 0, gap: 1, pad: 2, lines: 2, size: "l", centered: true },
    },
  ],
  quote: [
    {
      id: "calm",
      label: ["Calm", "Ruhig"],
      values: { ...textKeys, padding: 32 },
      preview: { blocks: 0, gap: 1, pad: 2, lines: 2, size: "m" },
    },
    {
      id: "editorial",
      label: ["Large & editorial", "Groß & editorial"],
      values: {
        ...textKeys,
        font: "serif",
        text_preset: "large",
        text_size: 30,
        text_width: 40,
        padding: 56,
      },
      preview: { blocks: 0, gap: 1, pad: 2, lines: 2, size: "l" },
    },
    {
      id: "accent",
      label: ["Centred accent", "Zentrierter Akzent"],
      values: {
        ...textKeys,
        font: "serif",
        text_preset: "display",
        text_size: 44,
        text_width: 34,
        text_align: "center",
        padding: 80,
      },
      preview: { blocks: 0, gap: 1, pad: 2, lines: 2, size: "l", centered: true },
    },
  ],
  image: [
    {
      id: "framed",
      label: ["Framed", "Gerahmt"],
      values: {
        padding: 48,
        media_spacing: 40,
        media_spacing_top: 16,
        media_spacing_bottom: 16,
        frame: true,
      },
      preview: { blocks: 1, gap: 1, pad: 3, framed: true },
    },
    {
      id: "bleed",
      label: ["Full bleed", "Randlos"],
      values: { padding: 0, ...mediaZero, frame: undefined },
      preview: { blocks: 1, gap: 0, pad: 0 },
    },
  ],
  pair: [
    {
      id: "balance",
      label: ["Balanced", "Gleichgewicht"],
      values: {
        gap: 18,
        align: undefined,
        offset: undefined,
        column_offsets: undefined,
        stagger: undefined,
      },
      preview: { blocks: 2, gap: 1, pad: 1 },
    },
    {
      id: "offset",
      label: ["Staggered", "Versetzt"],
      values: {
        gap: 18,
        align: undefined,
        offset: undefined,
        column_offsets: undefined,
        stagger: 50,
      },
      preview: { blocks: 2, gap: 1, pad: 1, shift: [-1, 1] },
    },
  ],
  rail: [
    {
      id: "generous",
      label: ["Generous", "Großzügig"],
      values: { padding: 72, media_spacing: 24 },
      preview: { blocks: 3, gap: 2, pad: 3 },
    },
    {
      id: "compact",
      label: ["Compact", "Kompakt"],
      values: { padding: 24, media_spacing: 0 },
      preview: { blocks: 4, gap: 1, pad: 1 },
    },
  ],
  filmstrip: [
    {
      id: "generous",
      label: ["Generous", "Großzügig"],
      values: { padding: 56, speed: 60 },
      preview: { blocks: 4, gap: 2, pad: 3 },
    },
    {
      id: "compact",
      label: ["Compact", "Kompakt"],
      values: { padding: 20, speed: 40 },
      preview: { blocks: 5, gap: 1, pad: 1 },
    },
  ],
  wall: [
    {
      id: "balanced",
      label: ["Balanced", "Ausgewogen"],
      values: { wall_mode: "balanced", gap: 12, padding: 32 },
      preview: { blocks: 4, gap: 1, pad: 1 },
    },
    {
      id: "airy",
      label: ["Airy", "Luftig"],
      values: { wall_mode: "balanced", gap: 28, padding: 56 },
      preview: { blocks: 4, gap: 3, pad: 3 },
    },
  ],
  gallery: [
    {
      id: "balanced",
      label: ["Balanced", "Ausgewogen"],
      values: { gap: 18, padding: 32 },
      preview: { blocks: 3, gap: 1, pad: 1 },
    },
    {
      id: "airy",
      label: ["Airy", "Luftig"],
      values: { gap: 32, padding: 56 },
      preview: { blocks: 3, gap: 3, pad: 3 },
    },
  ],
  hero: [
    {
      id: "overlay",
      label: ["Title on image", "Titel auf dem Bild"],
      values: { title_style: "overlay", show_title: undefined },
      preview: { blocks: 1, gap: 0, pad: 0, lines: 1, size: "l", centered: true },
    },
    {
      id: "image-only",
      label: ["Image only", "Nur das Bild"],
      values: { title_style: "overlay", show_title: false },
      preview: { blocks: 1, gap: 0, pad: 0 },
    },
  ],
};

export function presetsFor(kind: ModuleKind): StylePreset[] {
  return PRESETS[kind] || [];
}

/**
 * The former single-image variant „Mit Weißraum“ (padding 64, no media spacing) looked like
 * „Gerahmt“ and was folded into it: such modules now read as „Gerahmt“. Returns the fields
 * that turn a legacy layout into „Gerahmt“, or {} when nothing changes.
 */
export function legacyLayoutPatch(kind: ModuleKind, layout: Layout | undefined): Partial<Layout> {
  const l = layout || {};
  if (kind !== "image" || l.frame !== undefined || l.padding !== 64) return {};
  if ((l.media_spacing ?? 0) || (l.media_spacing_top ?? 0) || (l.media_spacing_bottom ?? 0)) return {};
  const framed = PRESETS.image.find((p) => p.id === "framed");
  return framed ? { ...framed.values } : {};
}

/** The layout as the renderer and editor read it, with legacy variants mapped. */
export function readLayout(kind: ModuleKind, layout: Layout | undefined): Layout {
  const patch = legacyLayoutPatch(kind, layout);
  return Object.keys(patch).length ? { ...(layout || {}), ...patch } : layout || {};
}

/** Values the renderer assumes when a field is missing; stored defaults count as unset. */
function defaultsFor(kind: ModuleKind): Record<string, unknown> {
  const chapter = kind === "chapter";
  return {
    padding: 32,
    gap: 18,
    media_spacing: 0,
    media_spacing_top: 0,
    media_spacing_bottom: 0,
    font: chapter ? undefined : "serif",
    text_align: "left",
    text_width: chapter ? 60 : 56,
    text_position: chapter ? "left" : "center",
    text_size: kind === "text" ? 16 : undefined,
    title_style: "overlay",
    show_title: true,
    align: "flush",
    offset: 50,
    speed: 45,
  };
}
function normalised(kind: ModuleKind, key: string, value: unknown): string {
  // Pairs no longer read column_offsets (legacy "Emphasis left" renders balanced).
  if (kind === "pair" && key === "column_offsets") return "";
  // Any non-zero stagger is "Staggered"; the slider strength is not part of the preset.
  if (key === "stagger") return typeof value === "number" && value !== 0 ? "1" : "";
  if (key === "column_offsets") {
    return Array.isArray(value) && value.some((n) => n !== 0)
      ? JSON.stringify(value)
      : "";
  }
  return value === defaultsFor(kind)[key] || value === undefined
    ? ""
    : JSON.stringify(value);
}

/** Id of the preset whose controlled fields all equal the layout, else null ("Individuell"). */
export function matchPreset(
  layout: Layout | undefined,
  kind: ModuleKind,
): string | null {
  const current = readLayout(kind, layout) as unknown as Record<string, unknown>;
  const list = presetsFor(kind);
  const keys = Array.from(
    new Set(list.flatMap((p) => Object.keys(p.values))),
  );
  for (const preset of list) {
    const values = preset.values as unknown as Record<string, unknown>;
    if (
      keys.every(
        (key) =>
          normalised(kind, key, current[key]) ===
          normalised(kind, key, values[key]),
      )
    )
      return preset.id;
  }
  return null;
}

/** Returns a new layout with the preset applied; unset ("default") fields are removed. */
export function applyPreset(
  layout: Layout | undefined,
  preset: StylePreset,
): Layout {
  const next = { ...(layout || {}), ...preset.values } as unknown as Record<
    string,
    unknown
  >;
  for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
  return next as unknown as Layout;
}

/** Layout fields for a newly created module: its first (best) preset, no undefined keys. */
export function initialLayoutFor(kind: ModuleKind): Layout {
  const first = presetsFor(kind)[0];
  return first ? applyPreset({}, first) : {};
}

/** The next preset after the active one (wraps around); from "individual" it starts with the first. */
export function nextPreset(
  layout: Layout | undefined,
  kind: ModuleKind,
): StylePreset | null {
  const list = presetsFor(kind);
  if (!list.length) return null;
  const active = matchPreset(layout, kind);
  const index = list.findIndex((p) => p.id === active);
  return list[(index + 1) % list.length];
}

/** The preset a freshly created module of this kind starts with ("Zurücksetzen"). */
export function basePreset(kind: ModuleKind): StylePreset | null {
  return presetsFor(kind)[0] ?? null;
}

/* ── Varianten: die Stile als durchblätterbare Reihe am Modul ──────────────── */

/** Every layout key the presets of this kind control. */
function controlledKeys(kind: ModuleKind): string[] {
  return Array.from(new Set(presetsFor(kind).flatMap((p) => Object.keys(p.values))));
}

/** How many controlled fields of the layout differ from the preset (0 = exactly this variant). */
export function presetDistance(
  layout: Layout | undefined,
  kind: ModuleKind,
  preset: StylePreset,
): number {
  const current = (layout || {}) as unknown as Record<string, unknown>;
  const values = preset.values as unknown as Record<string, unknown>;
  return controlledKeys(kind).filter(
    (key) => normalised(kind, key, current[key]) !== normalised(kind, key, values[key]),
  ).length;
}

/** Tie-breaker between equally distant variants: how far the differing values lie apart. */
function valueGap(layout: Layout | undefined, kind: ModuleKind, preset: StylePreset): number {
  const current = (layout || {}) as unknown as Record<string, unknown>;
  const values = preset.values as unknown as Record<string, unknown>;
  const defaults = defaultsFor(kind);
  let sum = 0;
  for (const key of controlledKeys(kind)) {
    if (normalised(kind, key, current[key]) === normalised(kind, key, values[key])) continue;
    const a = current[key] ?? defaults[key],
      b = values[key] ?? defaults[key];
    sum += typeof a === "number" && typeof b === "number" ? Math.abs(a - b) : 100;
  }
  return sum;
}

export interface VariantState {
  /** All variants of the module kind, in display order. */
  list: StylePreset[];
  /** Index of the variant the module is based on: the exact match, else the closest one. */
  index: number;
  /** True when the module deviates from that variant by its own fine settings. */
  customised: boolean;
}

/**
 * The variant a module is based on. An exact match wins; a module with its own fine settings
 * belongs to the variant with the fewest differing fields; on a tie the closest values decide,
 * then the earlier variant.
 */
export function variantState(raw: Layout | undefined, kind: ModuleKind): VariantState {
  const layout = readLayout(kind, raw);
  const list = presetsFor(kind);
  if (!list.length) return { list, index: -1, customised: false };
  let index = 0,
    best = Infinity,
    bestGap = Infinity;
  list.forEach((preset, i) => {
    const distance = presetDistance(layout, kind, preset);
    const gap = valueGap(layout, kind, preset);
    if (distance < best || (distance === best && gap < bestGap)) {
      best = distance;
      bestGap = gap;
      index = i;
    }
  });
  return { list, index, customised: best > 0 };
}

/** The neighbouring variant (dir 1 = next, -1 = previous), wrapping around. */
export function stepVariant(
  layout: Layout | undefined,
  kind: ModuleKind,
  dir: 1 | -1,
): StylePreset | null {
  const { list, index } = variantState(layout, kind);
  if (list.length < 2) return null;
  return list[(index + dir + list.length) % list.length];
}
