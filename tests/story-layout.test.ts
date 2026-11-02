import test from "node:test";
import assert from "node:assert/strict";
import {
  automaticWallSpans,
  desktopWallColumns,
  effectivePhotoRatio,
  usesAutomaticWallComposition,
} from "../src/storyLayout.ts";
import type { Photo } from "../src/types.ts";

const widths = (spans: number[]) => spans.map((span) => 12 / span);

test("automatic wall composition fills the documented row sizes at each breakpoint", () => {
  for (const [count, expected] of [
    [0, { desktop: [], tablet: [], mobile: [] }],
    [1, { desktop: [1], tablet: [1], mobile: [1] }],
    [2, { desktop: [2], tablet: [2], mobile: [1, 1] }],
    [3, { desktop: [3], tablet: [2, 1], mobile: [1, 1, 1] }],
    [5, { desktop: [3, 2], tablet: [2, 2, 1], mobile: [2, 2, 1] }],
    [8, { desktop: [4, 4], tablet: [2, 2, 2, 2], mobile: [2, 2, 2, 2] }],
    [9, { desktop: [4, 3, 2], tablet: [2, 2, 2, 2, 1], mobile: [2, 2, 2, 2, 1] }],
  ] as const) {
    const result = automaticWallSpans(count);
    for (const breakpoint of ["desktop", "tablet", "mobile"] as const) {
      assert.deepEqual(
        widths(result[breakpoint]),
        expected[breakpoint].flatMap((size) => Array(size).fill(size)),
        `${count} images at ${breakpoint}`,
      );
    }
  }
});

test("explicit wall composition and stagger settings disable automatic defaults", () => {
  assert.equal(usesAutomaticWallComposition({}), true);
  for (const layout of [
    { columns: 4 },
    { rows: 2 },
    { mobile_columns: 2 },
    { column_offsets: [0, 20] },
    { align: "staggered" as const },
  ]) {
    assert.equal(usesAutomaticWallComposition(layout), false);
  }
});

test("mobile pair columns do not determine desktop columns", () => {
  assert.equal(desktopWallColumns({ mobile_columns: 1 }, "pair", 2), 2);
  assert.equal(desktopWallColumns({ mobile_columns: 2 }, "pair", 2), 2);
  assert.equal(desktopWallColumns({ columns: 3, mobile_columns: 1 }, "pair", 2), 3);
  assert.equal(desktopWallColumns({ mobile_columns: 1 }, "wall", 2), undefined);
});

function photo(width: number, height: number, edits?: Photo["edits"]): Photo {
  return {
    id: 1,
    chapter_id: null,
    title: "",
    description: "",
    alt: "",
    width,
    height,
    featured: false,
    position: 0,
    url: "",
    srcset: "",
    credit: "",
    source_url: "",
    demo: true,
    large_url: "",
    original_url: null,
    edits,
  };
}

test("rail ratio follows source and explicit Picture frame ratios", () => {
  assert.equal(effectivePhotoRatio(photo(1600, 1000)), 1.6);
  assert.equal(effectivePhotoRatio(photo(800, 1200)), 2 / 3);
  assert.equal(effectivePhotoRatio(photo(800, 1200, { ratio: "4:5" })), 0.8);
  assert.equal(
    effectivePhotoRatio(photo(800, 1200, { ratio: "free", free_ratio: 1.8 })),
    1.8,
  );
  assert.equal(
    effectivePhotoRatio(photo(800, 1200, { ratio: "free" })),
    1.5,
  );
});
