/** Largest travel (px) any reveal may use; keeps the motion a quiet settle, not a journey. */
export const maxRevealDistance = 24;
export const maxRevealDuration = 700;
export function revealDistance(intensity: number) {
  return Math.max(0, Math.min(Number.isFinite(intensity) ? intensity : 0, maxRevealDistance));
}
const smooth = (value: number) => {
  const x = Math.max(0, Math.min(1, value));
  return x * x * (3 - 2 * x);
};
/**
 * Edge-based, symmetric opacity. Content starts to appear just before its top
 * edge enters the zone and is fully opaque after ~15% of the zone height; it
 * fades out only as its bottom edge leaves. Tall blocks that cover the zone
 * therefore stay fully visible, so a scroll never ends on an empty screen.
 */
export function centerRevealOpacity(
  top: number,
  bottom: number,
  zoneTop: number,
  zoneBottom: number,
) {
  const height = Math.max(100, zoneBottom - zoneTop),
    lead = height * 0.05,
    span = height * 0.2;
  return Math.min(
    smooth((zoneBottom + lead - top) / span),
    smooth((bottom - zoneTop + lead) / span),
  );
}

/**
 * Whether an element overlaps the reveal zone at all. Such elements are
 * placed straight at their final value (no fade-in from 0) when they are
 * registered or re-measured after a layout, font or image change.
 */
export function revealIsInZone(top: number, bottom: number, zoneTop: number, zoneBottom: number) {
  return bottom > zoneTop && top < zoneBottom;
}

/**
 * Enter-only variant for chapter headings: a gentle fade-in as the top edge arrives,
 * then fully opaque for good (no fade-out while scrolling on, like a magazine).
 */
export function centerRevealEnterOpacity(
  top: number,
  zoneTop: number,
  zoneBottom: number,
) {
  const height = Math.max(100, zoneBottom - zoneTop);
  return smooth((zoneBottom + height * 0.05 - top) / (height * 0.2));
}
