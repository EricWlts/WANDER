import type { Chapter, RevealConfig } from "./types.ts";
import { coverParallaxIntensity } from "./imageParallax.ts";

/**
 * Bewegung ist ein festes Qualitätsmerkmal von WANDER, keine Einstellung.
 * Diese Tabelle ist die einzige Quelle für Einblendung, Parallax und Hover-Zoom;
 * gespeicherte Einzelwerte (reveal, reveal_settings, parallax*, image_parallax,
 * hover_zoom) bleiben in den Daten, werden aber nirgends mehr ausgewertet.
 * Die Werte entsprechen dem bisherigen Standard („Ruhig“) und sind für beide
 * Editionen gleich.
 */

/** „cover“ ist das Titelbild der Story; alle anderen Arten sind Modularten. */
export type MotionKind = Chapter["kind"] | "cover";

export type FixedReveal = Required<RevealConfig> & { effect: "none" | "fade" };

export interface FixedMotion {
  /** Einblendung beim Scrollen. */
  reveal: FixedReveal;
  /** Parallax-Stärke; 0 = kein Parallax. */
  parallax: number;
  /** Hover-Zoom in Prozent; 0 = kein Zoom. */
  hoverZoom: number;
}

const fade: FixedReveal = { effect: "fade", duration: 1000, delay: 0, intensity: 30 };
const still: FixedReveal = { effect: "none", duration: 1000, delay: 0, intensity: 30 };

/** Dezent · 2,5 % */
export const subtleHoverZoom = 2.5;
/** Titelbild-Modul: bisheriger Standard der Parallax-Stärke. */
export const heroParallaxIntensity = 90;

export const fixedMotionTable: Readonly<Record<MotionKind, FixedMotion>> = {
  cover: { reveal: still, parallax: coverParallaxIntensity, hoverZoom: 0 },
  hero: { reveal: fade, parallax: heroParallaxIntensity, hoverZoom: 0 },
  chapter: { reveal: fade, parallax: 0, hoverZoom: subtleHoverZoom },
  text: { reveal: still, parallax: 0, hoverZoom: 0 },
  quote: { reveal: still, parallax: 0, hoverZoom: 0 },
  image: { reveal: fade, parallax: 0, hoverZoom: subtleHoverZoom },
  pair: { reveal: fade, parallax: 0, hoverZoom: subtleHoverZoom },
  gallery: { reveal: fade, parallax: 0, hoverZoom: subtleHoverZoom },
  wall: { reveal: fade, parallax: 0, hoverZoom: subtleHoverZoom },
  rail: { reveal: fade, parallax: 0, hoverZoom: 0 },
  filmstrip: { reveal: fade, parallax: 0, hoverZoom: 0 },
};

export function fixedMotion(kind: MotionKind): FixedMotion {
  return fixedMotionTable[kind] ?? fixedMotionTable.image;
}

export function fixedReveal(kind: MotionKind): FixedReveal {
  return fixedMotion(kind).reveal;
}

export function fixedParallax(kind: MotionKind): { enabled: boolean; intensity: number } {
  const intensity = fixedMotion(kind).parallax;
  return { enabled: intensity > 0, intensity };
}

/**
 * Hover-Zoom in Prozent. Auf Touch-Geräten aus; ein vollständig gezeigtes Motiv
 * („contain“) wird nie angeschnitten.
 */
export function fixedHoverZoom(kind: MotionKind, options: { touch?: boolean; contain?: boolean } = {}): number {
  if (options.touch || options.contain) return 0;
  return fixedMotion(kind).hoverZoom;
}

/** Skalierungsfaktor für `--image-hover-scale` (1 = kein Zoom). */
export function hoverScale(kind: MotionKind, options: { touch?: boolean; contain?: boolean } = {}): number {
  return 1 + fixedHoverZoom(kind, options) / 100;
}
