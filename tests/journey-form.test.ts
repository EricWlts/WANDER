import assert from "node:assert/strict";
import test from "node:test";
import {
  chapterWord,
  defaultDraftModeForForm,
  draftChapterTitle,
  formDateText,
  formOf,
  initialDraftMode,
  isPlaceholderTitleOfAnyForm,
  nextStoryLabel,
  placeholderTitle,
  suggestMomentTitle,
  withForm,
} from "../src/journeyForm.ts";

const fmt = {
  range: (a: string, b: string) => (a === b ? `D(${a})` : `R(${a}|${b})`),
  day: (d: string) => `D(${d})`,
};

test("formOf: missing, unknown or broken values are a journey", () => {
  assert.equal(formOf(undefined), "journey");
  assert.equal(formOf(null), "journey");
  assert.equal(formOf({}), "journey");
  assert.equal(formOf({ layout: {} }), "journey");
  assert.equal(formOf({ layout: null }), "journey");
  assert.equal(formOf({ layout: { form: "trip" } }), "journey");
  assert.equal(formOf({ layout: { form: 3 } }), "journey");
  assert.equal(formOf({ layout: { form: "collection" } }), "collection");
  assert.equal(formOf({ layout: { form: "moment" } }), "moment");
  assert.equal(formOf({ layout: { form: "journey" } }), "journey");
});

test("withForm keeps other layout keys and stores journey as an absent key", () => {
  const layout = { dates_from_photos: true, background: "#fff" };
  assert.deepEqual(withForm(layout, "collection"), { ...layout, form: "collection" });
  assert.deepEqual(withForm({ ...layout, form: "moment" }, "journey"), layout);
  assert.deepEqual(withForm({ ...layout, form: "moment" }, "collection"), { ...layout, form: "collection" });
  assert.deepEqual(withForm(undefined, "moment"), { form: "moment" });
  assert.deepEqual(withForm(null, "journey"), {});
  assert.deepEqual(layout, { dates_from_photos: true, background: "#fff" }, "input is not mutated");
});

test("default draft mode: journey by days, collection and moment by mood", () => {
  assert.equal(defaultDraftModeForForm("journey"), "days");
  assert.equal(defaultDraftModeForForm("collection"), "mood");
  assert.equal(defaultDraftModeForForm("moment"), "mood");
});

test("initialDraftMode keeps the journey rule and forces mood for the other forms", () => {
  assert.equal(initialDraftMode("journey", 10, 5), "days");
  assert.equal(initialDraftMode("journey", 10, 4), "mood");
  assert.equal(initialDraftMode("journey", 0, 0), "mood");
  assert.equal(initialDraftMode("collection", 10, 10), "mood");
  assert.equal(initialDraftMode("moment", 10, 10), "mood");
});

test("formDateText: journey period, moment one date, collection year only", () => {
  assert.equal(formDateText("journey", "2026-05-03", "2026-05-09", fmt), "R(2026-05-03|2026-05-09)");
  assert.equal(formDateText("journey", "2026-05-03", "", fmt), "D(2026-05-03)");
  assert.equal(formDateText("moment", "2026-05-03", "2026-05-09", fmt), "D(2026-05-03)");
  assert.equal(formDateText("collection", "2026-05-03", "2026-05-09", fmt), "2026");
  assert.equal(formDateText("collection", "2019-12-30", "2024-01-02", fmt), "2019 — 2024");
  assert.equal(formDateText("collection", "2026-05-03", "", fmt), "2026");
});

test("formDateText is empty without a usable start date", () => {
  for (const form of ["journey", "collection", "moment"] as const) {
    assert.equal(formDateText(form, "", "", fmt), "");
    assert.equal(formDateText(form, null, undefined, fmt), "");
    assert.equal(formDateText(form, "soon", "later", fmt), "");
  }
});

test("placeholder titles per form and language", () => {
  assert.equal(placeholderTitle("journey", "de"), "Unbenannte Reise");
  assert.equal(placeholderTitle("collection", "de"), "Unbenannte Sammlung");
  assert.equal(placeholderTitle("moment", "de"), "Unbenannter Moment");
  assert.equal(placeholderTitle("journey", "en"), "Untitled journey");
  assert.equal(placeholderTitle("collection", "en"), "Untitled collection");
  assert.equal(placeholderTitle("moment", "en"), "Untitled moment");
});

test("isPlaceholderTitleOfAnyForm recognises every placeholder and nothing else", () => {
  for (const form of ["journey", "collection", "moment"] as const)
    for (const locale of ["en", "de"] as const)
      assert.equal(isPlaceholderTitleOfAnyForm(placeholderTitle(form, locale)), true);
  assert.equal(isPlaceholderTitleOfAnyForm("  "), true);
  assert.equal(isPlaceholderTitleOfAnyForm(null), true);
  assert.equal(isPlaceholderTitleOfAnyForm("Schweiz"), false);
});

test("next-story and chapter wording depend on the form", () => {
  assert.equal(nextStoryLabel("journey", "de"), "Nächste Reise");
  assert.equal(nextStoryLabel("journey", "en"), "Next journey");
  assert.equal(nextStoryLabel("collection", "de"), "Nächste Geschichte");
  assert.equal(nextStoryLabel("moment", "en"), "Next story");
  assert.equal(chapterWord("journey", "de"), "Tag");
  assert.equal(chapterWord("moment", "de"), "Kapitel");
  assert.equal(chapterWord("collection", "en"), "Chapter");
});

test("draftChapterTitle: Day n only for journeys", () => {
  const day = (d: string) => `D(${d})`;
  assert.equal(draftChapterTitle("journey", "Tag 2", "2026-05-04", day, "de"), "Tag 2");
  assert.equal(draftChapterTitle("collection", "Tag 2", "2026-05-04", day, "de"), "D(2026-05-04)");
  assert.equal(draftChapterTitle("moment", "Day 1", "2026-05-04", day, "en"), "D(2026-05-04)");
  assert.equal(draftChapterTitle("moment", "Day 1", undefined, day, "en"), "Chapter");
  assert.equal(draftChapterTitle("collection", "Weitere Momente", undefined, day, "de"), "Weitere Momente");
  assert.equal(draftChapterTitle("collection", undefined, undefined, day, "de"), undefined);
});

test("suggestMomentTitle names the first capture day", () => {
  assert.equal(suggestMomentTitle({ start: "2025-08-09", end: "2025-08-09" }, "de"), "Moment am 9. August 2025");
  assert.equal(suggestMomentTitle({ start: "2025-08-09", end: "2025-08-19" }, "en"), "Moment on 9 August 2025");
  assert.equal(suggestMomentTitle(null), null);
  assert.equal(suggestMomentTitle({ start: "x", end: "y" }), null);
});
