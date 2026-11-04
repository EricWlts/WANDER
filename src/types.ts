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
}
export interface Layout {
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
  show_title?: boolean;
  parallax?: boolean;
  speed?: number;
  rail_mode?: "free" | "single";
  rail_loop?: boolean;
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
  layout?: Layout;
  has_unpublished_changes?: boolean;
  story_template: "quiet-atlas" | "after-hours";
  studio_step: number;
  filmstrip_ids: number[];
  is_example?: boolean;
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
}
