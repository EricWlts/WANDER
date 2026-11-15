import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_WORDS,
  canContinue,
  compactWords,
  parseWords,
  storyDays,
  wordsKey,
  defaultStructure,
  draftModeFromParam,
  editionFromParam,
  editorStartQuery,
  needsDaysNote,
  nextStep,
  presetFor,
  previousStep,
  stepFromParam,
  structureFor,
} from "../src/newStoryFlow.ts";

test("step from the URL needs photographs for steps 2 and 3", () => {
  assert.equal(stepFromParam("2", 3), 2);
  assert.equal(stepFromParam("3", 1), 3);
  assert.equal(stepFromParam("2", 0), 1);
  assert.equal(stepFromParam("3", 0), 1);
  assert.equal(stepFromParam("1", 5), 1);
  assert.equal(stepFromParam("4", 2), 4);
  assert.equal(stepFromParam("4", 0), 1);
  assert.equal(stepFromParam("9", 5), 1);
  assert.equal(stepFromParam(null, 5), 1);
  assert.equal(stepFromParam("abc", 5), 1);
});

test("continue on step 1 needs a photograph and no running upload", () => {
  assert.equal(canContinue(1, { photos: 0, uploading: false }), false);
  assert.equal(canContinue(1, { photos: 2, uploading: true }), false);
  assert.equal(canContinue(1, { photos: 1, uploading: false }), true);
  assert.equal(canContinue(2, { photos: 0, uploading: false }), true);
  assert.equal(canContinue(3, { photos: 0, uploading: true }), true);
});

test("steps move one at a time and stop at the ends", () => {
  assert.equal(nextStep(1), 2);
  assert.equal(nextStep(2), 3);
  assert.equal(nextStep(3), 4);
  assert.equal(nextStep(4), 4);
  assert.equal(previousStep(4), 3);
  assert.equal(previousStep(3), 2);
  assert.equal(previousStep(2), 1);
  assert.equal(previousStep(1), 1);
});

test("edition preselection follows ?template=", () => {
  assert.equal(editionFromParam("after-hours"), "after-hours");
  assert.equal(editionFromParam("quiet-atlas"), "quiet-atlas");
  assert.equal(editionFromParam("nonsense"), "quiet-atlas");
  assert.equal(editionFromParam(null), "quiet-atlas");
  assert.equal(presetFor("after-hours"), "cinematic");
  assert.equal(presetFor("quiet-atlas"), "quiet");
});

test("options map to form and draft mode", () => {
  assert.deepEqual(structureFor("days"), { form: "journey", mode: "days" });
  assert.deepEqual(structureFor("mood"), { form: "collection", mode: "mood" });
  assert.deepEqual(structureFor("moment"), { form: "moment", mode: "mood" });
});

test("structure preselection and the note without capture dates", () => {
  assert.equal(defaultStructure(3), "days");
  assert.equal(defaultStructure(0), "mood");
  assert.equal(needsDaysNote("days", 0), true);
  assert.equal(needsDaysNote("days", 2), false);
  assert.equal(needsDaysNote("mood", 0), false);
});

test("editor start query and mode parameter", () => {
  assert.equal(editorStartQuery("days"), "start=1&mode=days");
  assert.equal(draftModeFromParam("mood"), "mood");
  assert.equal(draftModeFromParam("days"), "days");
  assert.equal(draftModeFromParam("x"), undefined);
  assert.equal(draftModeFromParam(null), undefined);
});

const photos = [
  { id: 1, taken_at: "2025-08-10T15:00:00", position: 0 },
  { id: 2, taken_at: "2025-08-09T09:00:00", position: 1 },
  { id: 3, taken_at: "2025-08-09T08:00:00", position: 2 },
  { id: 4, taken_at: null, position: 3 },
  { id: 5, taken_at: "2025-08-12T10:00:00", position: 4 },
];

test("step 4 lists the capture days like the draft, with the earliest photograph", () => {
  assert.deepEqual(storyDays(photos), [
    { date: "2025-08-09", photoId: 3, number: 1 },
    { date: "2025-08-10", photoId: 1, number: 2 },
    { date: "2025-08-12", photoId: 5, number: 3 },
  ]);
  assert.deepEqual(storyDays([{ id: 1, position: 0 }]), []);
});

test("words are trimmed and limited to the chosen structure", () => {
  const days = storyDays(photos);
  const words = {
    title: "  Lofoten ",
    intro: " Ein Satz. ",
    days: { "2025-08-09": { title: " Ankunft ", text: "  " }, "2025-08-11": { title: "x", text: "y" } },
  };
  assert.deepEqual(compactWords(words, "days", days), {
    title: "Lofoten",
    intro: "",
    days: { "2025-08-09": { title: "Ankunft", text: "" } },
  });
  assert.deepEqual(compactWords(words, "mood", days), { title: "Lofoten", intro: "Ein Satz.", days: {} });
  assert.equal(compactWords(EMPTY_WORDS, "days", days), null);
  assert.equal(compactWords({ ...EMPTY_WORDS, title: " " }, "moment", days), null);
  // by days without capture dates falls back to the intro sentence
  assert.equal(compactWords({ ...EMPTY_WORDS, intro: "Hallo" }, "days", [])?.intro, "Hallo");
});

test("stored words survive a round trip and ignore garbage", () => {
  const words = { title: "A", intro: "", days: { "2025-08-09": { title: "T", text: "X" } } };
  assert.deepEqual(parseWords(JSON.stringify(words)), words);
  assert.equal(parseWords("not json"), null);
  assert.equal(parseWords(null), null);
  assert.equal(parseWords("{}"), null);
  assert.equal(wordsKey("abc"), "wander:story-words:abc");
});
