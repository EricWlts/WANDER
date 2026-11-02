import type { Layout, Photo } from "./types";

export interface AutomaticWallSpans {
  desktop: number[];
  tablet: number[];
  mobile: number[];
}

function rowSizes(count: number, columns: number, rebalanceSingle: boolean) {
  if (count <= columns) return count ? [count] : [];

  const rows: number[] = [];
  let remaining = count;
  while (remaining > columns) {
    if (rebalanceSingle && remaining === columns + 1 && columns === 4) {
      rows.push(3, 2);
      return rows;
    }
    rows.push(columns);
    remaining -= columns;
  }
  if (remaining) rows.push(remaining);
  return rows;
}

function spansForRows(rows: number[]) {
  return rows.flatMap((size) => Array.from({ length: size }, () => 12 / size));
}

/** Equal-width CSS grid spans for the documented desktop, tablet and mobile defaults. */
export function automaticWallSpans(count: number): AutomaticWallSpans {
  return {
    desktop: spansForRows(rowSizes(count, 4, true)),
    tablet: spansForRows(rowSizes(count, 2, false)),
    mobile: spansForRows(count <= 3 ? Array(count).fill(1) : rowSizes(count, 2, false)),
  };
}

export function usesAutomaticWallComposition(layout: Layout) {
  return (
    layout.columns === undefined &&
    layout.rows === undefined &&
    layout.mobile_columns === undefined &&
    layout.column_offsets === undefined &&
    layout.align !== "staggered"
  );
}

/** Preserve the pair module's desktop default without deriving it from mobile settings. */
export function desktopWallColumns(
  layout: Layout,
  kind: string,
  photoCount: number,
) {
  return layout.columns ?? (kind === "pair" && photoCount === 2 ? 2 : undefined);
}

/** Mirrors Picture's frame ratio precedence without changing its crop or fit behavior. */
export function effectivePhotoRatio(photo: Photo) {
  const ratio = photo.edits?.ratio;
  if (ratio === "free") {
    const freeRatio = photo.edits?.free_ratio;
    return freeRatio && Number.isFinite(freeRatio) && freeRatio > 0
      ? freeRatio
      : 1.5;
  }
  if (ratio && ratio !== "original") {
    const [width, height] = ratio.split(":").map(Number);
    if (width > 0 && height > 0) return width / height;
  }
  return photo.width > 0 && photo.height > 0 ? photo.width / photo.height : 1;
}
