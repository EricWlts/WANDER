import type { JourneyForm } from "./journeyForm.ts";
export interface ImageEdits {
  ratio?: Ratio;
  fit?: "cover" | "contain";
  x?: number;
  y?: number;
  zoom?: number;
  free_ratio?: number;
  show_title?: boolean;
  hover_zoom?: number;
}
export type Ratio =
  "original" | "free" | "1:1" | "3:2" | "4:3" | "4:5" | "16:9";
export interface ImagePlacement {
  id: string;
  photo_id: number;
  edits?: ImageEdits;
  /** Photo wall weight within its row: small · normal · large (unset = normal). */
  size?: "s" | "m" | "l";
}
export interface Layout {
  /** Story form: absent means "journey". */
  form?: JourneyForm;
  placements?: ImagePlacement[];
  filmstrip_placements?: ImagePlacement[];
  hover_zoom?: number;
  parallax_intensity?: number;
  image_parallax?: boolean;
  background?: string;
  text_color?: string;
  text_position?: "left" | "center" | "right" | "full";
  text_width?: number;
  text_preset?: "small" | "medium" | "large" | "display";
  font_weight?: number;
  text_animations?: boolean;
  column_offsets?: number[];
  photo_edits?: Record<string, ImageEdits>;
  font?: "serif" | "sans";
  text_size?: number;
  text_align?: "left" | "center" | "right";
  inset?: number;
  media_width?: "cover-image" | "cover-frame";
  media_spacing?: number;
  media_spacing_top?: number;
  media_spacing_bottom?: number;
  /** „Gerahmt“: a fine paper frame in Erstes Licht, only the space in Letztes Licht. */
  frame?: boolean;
  edition?: "inherit" | "quiet-atlas" | "after-hours";
  photo_ids?: number[];
  parent_id?: number;
  columns?: number;
  rows?: number;
  gap?: number;
  padding?: number;
  offset?: number;
  mobile_columns?: number;
  mobile_gap?: number;
  mobile_padding?: number;
  ratio?: Ratio;
  fit?: "cover" | "contain";
  align?: "flush" | "staggered";
  title_style?: "overlay" | "overlap" | "below";
  title_size?: number;
  /** Journey cover: anchor of the title block in % of the cover (unset = bottom left). */
  title_x?: number;
  title_y?: number;
  /** Module with its own edition: tint the whole section in the edition colour. */
  edition_fill?: boolean;
  /** Side margin (px) around the module content; unset = theme default. */
  margin_x?: number;
  /** Pair: vertical stagger -100..100 (negative = left image lower). */
  stagger?: number;
  /** Journey layout: start/end follow the photographs' capture dates (false = set by hand). */
  dates_from_photos?: boolean;
  /** Journey layout: crop of the cover in the archive band; unset = cover_focus. */
  archive_focus?: FocusMap | null;
  show_title?: boolean;
  parallax?: boolean;
  speed?: number;
  rail_mode?: "free" | "single";
  rail_loop?: boolean;
  /** Photo wall: „Ausgewogen“ (rows of equal height) or the classic grid; unset = grid (legacy walls). */
  wall_mode?: "balanced" | "grid";
  /** Photo wall: centre an incomplete last row. */
  wall_center?: boolean;
  /** Photo wall: photographs per row 1–6; unset = automatic. */
  wall_row?: number;
  /** Filmstrip: show every photograph of the story, new uploads included. */
  all_photos?: boolean;
}
export interface Photo {
  placement_id?: string;
  edits?: ImageEdits;
  original_url: string | null;
  large_url: string;
  id: number;
  chapter_id: number | null;
  title: string;
  description: string;
  alt: string;
  width: number;
  height: number;
  featured: boolean;
  position: number;
  /** Capture time from EXIF (naive local ISO string), when known. */
  taken_at?: string | null;
  url: string;
  srcset: string;
  credit: string;
  source_url: string;
  demo: boolean;
}
export interface Chapter {
  gallery_mode: "editorial" | "horizontal";
  kind:
    | "chapter"
    | "text"
    | "quote"
    | "gallery"
    | "hero"
    | "image"
    | "pair"
    | "rail"
    | "filmstrip"
    | "wall";
  layout?: Layout;
  reveal: RevealConfig;
  id: number;
  title: string;
  date: string;
  story: string;
  quote: string;
  position: number;
}
export interface Journey {
  composition_version?: number;
  layout?: Layout;
  has_unpublished_changes?: boolean;
  story_template: "quiet-atlas" | "after-hours";
  studio_step: number;
  filmstrip_ids: number[];
  is_example?: boolean;
  /** Examples and showcases only: studio-chosen cover focus per screen size (null = centred). */
  cover_focus?: FocusMap | null;
  reveal_settings: RevealSettings;
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  location: string;
  country: string;
  start_date: string;
  end_date: string;
  description: string;
  introduction: string;
  reflection: string;
  closing: string;
  preset: "quiet" | "cinematic" | "gallery";
  published: boolean;
  demo: boolean;
  cover_id: number | null;
  cover: Photo | null;
  photo_count: number;
  chapter_count: number;
  photos: Photo[];
  /** Public list only: up to three non-cover photos (subset of Photo fields) from the published snapshot. */
  highlights?: Array<Pick<Photo, "id" | "url" | "srcset" | "alt" | "width" | "height"> & Partial<Photo>>;
  chapters: Chapter[];
}
export type RevealEffect =
  "none" | "fade" | "up" | "down" | "left" | "right" | "zoom" | "parallax";
export interface RevealConfig {
  effect?: RevealEffect | "inherit";
  duration?: number;
  delay?: number;
  intensity?: number;
}
export type RevealSettings = Partial<
  Record<
    "default" | "title" | "introduction" | "reflection" | "closing" | "images",
    RevealConfig
  >
>;

export interface StoryTemplate {
  id: Journey["story_template"];
  name: string;
  kicker: string;
  description: string;
  cover: string;
  preset: Journey["preset"];
  prompts: string[];
  /** Studio override of the edition cover (null = shipped image) and its focus (null = centred). */
  cover_photo?: Photo | null;
  cover_focus?: FocusMap | null;
  title_override?: Record<"de" | "en", string>;
}

export type FocusMap = Record<"desktop" | "tablet" | "mobile", { x: number; y: number }>;

/** Studio override of one edition (GET /api/site/editions). Negative photo ids are the edition's shipped photographs. */
export interface SiteEdition {
  id: Journey["story_template"];
  custom: boolean;
  cover_photo_id: number | null;
  cover: Photo | null;
  default_cover: Photo;
  default_cover_index: number;
  focus: FocusMap;
  slots: (number | null)[];
  slot_photos: (Photo | null)[];
  assets: Photo[];
  slot_shapes: ("portrait" | "landscape")[];
  title: Record<"de" | "en", string>;
  subtitle: Record<"de" | "en", string>;
  /** Slugs of the editable edition journeys per language; absent while the edition is still code-based. */
  journey_slugs?: Partial<Record<"de" | "en", string>>;
}

/** Public home-hero setting: a chosen photograph (or null = automatic) and a focus per device size. */
export interface SiteHero {
  photo: Photo | null;
  focus: Record<"desktop" | "tablet" | "mobile", { x: number; y: number }>;
}
