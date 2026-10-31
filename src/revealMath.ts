/** Symmetric viewport-centred opacity with a smooth plateau in the reading zone. */
export function centerRevealOpacity(
  top: number,
  bottom: number,
  zoneTop: number,
  zoneBottom: number,
) {
  const height = Math.max(100, zoneBottom - zoneTop),
    distance =
      Math.abs((top + bottom - zoneTop - zoneBottom) / 2) /
      (height * 0.5 + Math.min((bottom - top) * 0.1, 50));
  const linear = Math.max(0, Math.min(1, (0.9 - distance) / 0.62));
  return linear * linear * (3 - 2 * linear);
}
