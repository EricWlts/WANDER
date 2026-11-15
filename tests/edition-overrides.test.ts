import assert from "node:assert/strict";
import test from "node:test";
import {
  coverFocusVars,
  draftFromServer,
  emptyDraft,
  isDefaultDraft,
  limitText,
  normalizeSlot,
  sameDraft,
  setSlot,
  shapeMismatch,
  toPayload,
} from "../src/editionOverrides.ts";

test("an empty draft is the default and sends eight empty places", () => {
  const draft = emptyDraft();
  assert.equal(isDefaultDraft(draft), true);
  const payload = toPayload(draft);
  assert.equal(payload.slots.length, 8);
  assert.ok(payload.slots.every((slot) => slot === null));
  assert.equal(payload.cover_photo_id, null);
});

test("a shipped photograph in its own place is not an override", () => {
  assert.equal(normalizeSlot(3, -4), null);
  assert.equal(normalizeSlot(3, -1), -1);
  assert.deepEqual(setSlot([], 2, -3).slice(0, 4), [null, null, null, null]);
  assert.equal(setSlot([], 2, 17)[2], 17);
  assert.equal(setSlot([1, 2], 0, null)[0], null);
  assert.equal(setSlot([], 9, 5).length, 8);
});

test("changes make a draft non-default and dirty", () => {
  const saved = emptyDraft();
  const edited = { ...saved, slots: setSlot(saved.slots, 1, 42) };
  assert.equal(isDefaultDraft(edited), false);
  assert.equal(sameDraft(saved, edited), false);
  assert.equal(sameDraft(saved, emptyDraft()), true);
  const titled = { ...saved, title: { de: "  ", en: "" } };
  assert.equal(isDefaultDraft(titled), true);
  assert.equal(sameDraft(saved, titled), true);
});

test("focus alone counts as a change", () => {
  const draft = emptyDraft();
  draft.focus.mobile = { x: 10, y: 90 };
  assert.equal(isDefaultDraft(draft), false);
  assert.equal(toPayload(draft).focus.mobile.y, 90);
});

test("server data round-trips and texts are limited to 160 characters", () => {
  const draft = draftFromServer({
    cover_photo_id: 7,
    focus: { desktop: { x: 20, y: 80 }, tablet: { x: 50, y: 50 }, mobile: { x: 0, y: 100 } },
    slots: [null, -1, 5],
    title: { de: "Titel", en: "" },
    subtitle: { de: "", en: "Sub" },
  });
  assert.equal(draft.cover, 7);
  assert.equal(draft.slots.length, 8);
  assert.equal(draft.slots[2], 5);
  assert.equal(limitText("x".repeat(200)).length, 160);
  assert.equal(toPayload({ ...draft, title: { de: "y".repeat(300), en: "" } }).title.de.length, 160);
  assert.equal(sameDraft(draft, draftFromServer({ ...draft, cover_photo_id: draft.cover, slots: draft.slots })), true);
});

test("orientation hint only fires for a mismatch", () => {
  assert.equal(shapeMismatch("portrait", { width: 2000, height: 1300 }), true);
  assert.equal(shapeMismatch("portrait", { width: 1300, height: 2000 }), false);
  assert.equal(shapeMismatch("landscape", { width: 1300, height: 2000 }), true);
  assert.equal(shapeMismatch(undefined, { width: 1, height: 2 }), false);
  assert.equal(shapeMismatch("portrait", null), false);
});

test("cover focus variables are per breakpoint and absent without focus", () => {
  assert.equal(coverFocusVars(null), undefined);
  const vars = coverFocusVars({ desktop: { x: 20, y: 80 }, tablet: { x: 50, y: 50 }, mobile: { x: 100, y: 0 } });
  assert.equal(vars?.["--cover-pos-desktop"], "20% 80%");
  assert.equal(vars?.["--cover-pos-mobile"], "100% 0%");
});

test("edition journeys are recognised by their reserved slug prefix", async () => {
  const { isEditionJourney } = await import("../src/editionOverrides.ts");
  assert.equal(isEditionJourney("__edition-quiet-atlas-de"), true);
  assert.equal(isEditionJourney("berner-oberland"), false);
  assert.equal(isEditionJourney(undefined), false);
});
