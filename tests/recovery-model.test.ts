import test from "node:test";
import assert from "node:assert/strict";
import { isRecoveryJourney } from "../src/recoveryModel.ts";
import type { Journey } from "../src/types.ts";

function draft(): Journey {
  const photo = {
    id: 11, chapter_id: 2, original_url: null, large_url: "/large.jpg",
    title: "Photo", description: "", alt: "Landscape", width: 1200,
    height: 800, featured: false, position: 0, url: "/photo.jpg",
    srcset: "", credit: "", source_url: "", demo: false,
    edits: { x: 20, fit: "cover" as const },
  };
  return {
    id: 1, slug: "test-recovery", title: "Draft", subtitle: "", location: "",
    country: "", start_date: "", end_date: "", description: "",
    introduction: "", reflection: "", closing: "", preset: "quiet",
    story_template: "quiet-atlas", studio_step: 1, published: false, demo: false,
    cover_id: 11, cover: photo, photo_count: 1, chapter_count: 2,
    filmstrip_ids: [11], reveal_settings: { images: { effect: "fade" } },
    photos: [photo], chapters: [
      { id: 2, kind: "chapter", title: "Day", date: "", story: "", quote: "",
        position: 0, gallery_mode: "editorial", reveal: {}, layout: {} },
      { id: -3, kind: "wall", title: "Wall", date: "", story: "", quote: "",
        position: 1, gallery_mode: "editorial", reveal: { effect: "inherit" },
        layout: { parent_id: 2, placements: [
          { id: "first", photo_id: 11 },
          { id: "repeat", photo_id: 11, edits: { zoom: 1.2 } },
        ] } },
    ],
    layout: { filmstrip_placements: [{ id: "film", photo_id: 11 }] },
  };
}

test("current recovery accepts temporary module IDs and repeated photo occurrences without mutation", () => {
  const value = draft();
  const before = structuredClone(value);
  assert.equal(isRecoveryJourney(value, 1), true);
  assert.deepEqual(value, before);
});

test("legacy assignments and omitted optional layouts, placements and edits remain recoverable", () => {
  const value = draft();
  delete value.layout;
  delete value.photos[0].edits;
  delete value.chapters[0].layout;
  value.chapters[1].layout = {
    photo_ids: [11, 11, 404], photo_edits: { "11": { x: 40, ratio: "4:3" } },
  };
  value.filmstrip_ids = [11, 11, 404];
  const before = structuredClone(value);
  assert.equal(isRecoveryJourney(value, 1), true);
  assert.deepEqual(value, before);
  // A module without layout still uses the source's legacy chapter_id.
  assert.equal(value.photos[0].chapter_id, value.chapters[0].id);
});

test("explicitly empty placement arrays and empty journals remain valid", () => {
  const value = draft();
  value.layout = { placements: [], filmstrip_placements: [] };
  value.chapters[1].layout = { placements: [], photo_ids: [11] };
  assert.equal(isRecoveryJourney(value, 1), true);
  value.photos = [];
  value.chapters = [];
  value.cover = null;
  value.cover_id = null;
  value.filmstrip_ids = [];
  assert.equal(isRecoveryJourney(value, 1), true);
});

test("invalid roots and mismatched IDs are ignored", () => {
  for (const value of [null, [], [draft()], false, 1, "draft", {},
    { ...draft(), id: 2 }, { ...draft(), id: "1" }]) {
    assert.equal(isRecoveryJourney(value, 1), false);
  }
});

test("every required journey, chapter and photo field must be present and correctly typed", () => {
  const required = {
    journey: {
      id: "1", slug: 0, title: {}, subtitle: null, location: [], country: false,
      start_date: 0, end_date: 0, description: {}, introduction: [], reflection: null,
      closing: false, preset: "unknown", story_template: "unknown", studio_step: "1",
      published: "false", demo: 0, cover_id: "11", cover: [], photo_count: "1",
      chapter_count: null, filmstrip_ids: {}, reveal_settings: [], photos: {}, chapters: {},
    },
    chapter: {
      id: "2", kind: "unknown", title: {}, date: 0, story: [], quote: null,
      position: "0", gallery_mode: "unknown", reveal: [],
    },
    photo: {
      id: "11", chapter_id: "2", original_url: {}, large_url: [], title: {},
      description: null, alt: false, width: "1200", height: null, featured: "false",
      position: "0", url: {}, srcset: [], credit: null, source_url: false, demo: 0,
    },
  };
  for (const [target, invalidFields] of Object.entries(required)) {
    for (const [field, invalid] of Object.entries(invalidFields)) {
      for (const missing of [false, true]) {
        const value = draft();
        const record = (target === "journey" ? value : target === "chapter"
          ? value.chapters[0] : value.photos[0]) as unknown as Record<string, unknown>;
        if (missing) delete record[field];
        else record[field] = invalid;
        const before = structuredClone(value);
        assert.equal(isRecoveryJourney(value, 1), false, `${target}.${field}, missing=${missing}`);
        assert.deepEqual(value, before);
      }
    }
  }
});

test("unusable lists, duplicate IDs and cyclic module parents are ignored", () => {
  const mutations: ((value: Journey) => void)[] = [
    (value) => { value.chapters = [null] as never; },
    (value) => { value.photos = [[]] as never; },
    (value) => { value.chapters.push(value.chapters[0]); },
    (value) => { value.photos.push(value.photos[0]); },
    (value) => { value.chapters[0].layout = { parent_id: 2 }; },
    (value) => { value.chapters[0].layout = { parent_id: -3 }; },
    (value) => { value.photos[0].id = 0; },
    (value) => { value.chapters[0].id = 1.5; },
    (value) => { value.photos[0].width = Infinity; },
    (value) => { value.chapters[0].position = NaN; },
    (value) => { value.cover = { id: 11 } as never; },
  ];
  for (const mutate of mutations) {
    const value = draft();
    mutate(value);
    assert.equal(isRecoveryJourney(value, 1), false);
  }
});

test("malformed optional current and legacy structures are ignored", () => {
  const invalidLayouts = [
    null, [], "layout", { placements: {} }, { placements: [null] },
    { placements: [{ id: "frame", photo_id: "11" }] },
    { placements: [{ id: "frame", photo_id: 11, edits: { zoom: "2" } }] },
    { placements: [{ id: "", photo_id: 11 }] },
    { placements: [{ id: "same", photo_id: 11 }, { id: "same", photo_id: 11 }] },
    { filmstrip_placements: [11] }, { photo_ids: ["11"] },
    { photo_edits: [] }, { photo_edits: { "11": null } },
    { photo_edits: { "11": { zoom: "2" } } },
    { column_offsets: [null] }, { parent_id: "2" }, { columns: "4" },
    { background: {} }, { text_animations: "false" }, { ratio: "unknown" },
  ];
  for (const layout of invalidLayouts) {
    for (const root of [true, false]) {
      const value = draft();
      if (root) value.layout = layout as never;
      else value.chapters[0].layout = layout as never;
      assert.equal(isRecoveryJourney(value, 1), false, JSON.stringify(layout));
    }
  }
  for (const patch of [
    { filmstrip_ids: [null] }, { reveal_settings: { images: { duration: "1" } } },
    { has_unpublished_changes: "true" }, { is_example: null },
  ]) assert.equal(isRecoveryJourney({ ...draft(), ...patch }, 1), false);
  for (const edits of [null, [], { fit: "invalid" }, { x: "20" }, { show_title: 1 }]) {
    const value = draft();
    value.photos[0].edits = edits as never;
    assert.equal(isRecoveryJourney(value, 1), false);
  }
  for (const reveal of [null, [], { effect: "unknown" }, { delay: "20" }]) {
    const value = draft();
    value.chapters[0].reveal = reveal as never;
    assert.equal(isRecoveryJourney(value, 1), false);
  }
});

test("unknown fields and unresolved source references do not invalidate compatible drafts", () => {
  const value = draft();
  value.chapters[1].layout!.placements!.push({ id: "missing", photo_id: 404 });
  assert.equal(isRecoveryJourney({ ...value, future_metadata: { version: 2 } }, 1), true);
});


test("manual rail modes survive recovery and malformed options are ignored", () => {
  for (const rail_mode of ["free", "single"] as const) for (const rail_loop of [false, true]) {
    const value = draft();
    value.chapters[1].layout = { rail_mode, rail_loop };
    assert.equal(isRecoveryJourney(JSON.parse(JSON.stringify(value)), 1), true);
  }
  for (const invalid of [{ rail_mode: "automatic" }, { rail_loop: "true" }]) {
    const value = draft();
    Object.assign(value.chapters[1].layout!, invalid);
    assert.equal(isRecoveryJourney(value, 1), false);
  }
});


test("explicit image parallax survives recovery with legacy cover settings and rejects non-booleans", () => {
  const value = draft();
  value.layout = { ...value.layout, parallax: false, parallax_intensity: 125, image_parallax: true };
  value.chapters[1].layout = { ...value.chapters[1].layout, image_parallax: false };
  assert.equal(isRecoveryJourney(JSON.parse(JSON.stringify(value)), 1), true);
  for (const invalid of [1, "true", null]) {
    const bad = structuredClone(value);
    (bad.chapters[1].layout as Record<string, unknown>).image_parallax = invalid;
    assert.equal(isRecoveryJourney(bad, 1), false);
  }
});
