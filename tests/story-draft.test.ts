import test from "node:test";
import assert from "node:assert/strict";
import { dayOf, draftStory } from "../src/storyDraft.ts";
import type { DraftPhoto } from "../src/storyDraft.ts";

function photo(id: number, orientation: "L" | "P", over: Partial<DraftPhoto> = {}): DraftPhoto {
  return {
    id,
    width: orientation === "L" ? 3000 : 2000,
    height: orientation === "L" ? 2000 : 3000,
    position: id,
    taken_at: null,
    featured: false,
    ...over,
  };
}
function mixed(n: number): DraftPhoto[] {
  const pattern = "LPLLPLPPLLLPLPLPLLPP";
  return Array.from({ length: n }, (_, i) => photo(i + 1, pattern[i % pattern.length] as "L" | "P"));
}
function used(modules: ReturnType<typeof draftStory>): number[] {
  return modules.flatMap((m) => m.photoIds);
}
function images(modules: ReturnType<typeof draftStory>) {
  return modules.filter((m) => m.kind !== "chapter");
}

test("deterministic: same input gives identical output", () => {
  const input = mixed(14);
  assert.deepEqual(draftStory(input, "mood"), draftStory(input.slice().reverse(), "mood"));
  assert.deepEqual(draftStory(input, "days"), draftStory(input, "days"));
});

test("every photograph is used exactly once in both modes", () => {
  for (const n of [1, 2, 3, 4, 5, 7, 12, 20, 33]) {
    for (const mode of ["mood", "days"] as const) {
      const input = mixed(n).map((p, i) => ({
        ...p,
        taken_at: i % 3 === 0 ? null : `2026-05-0${1 + (i % 4)}T10:${String(i).padStart(2, "0")}:00`,
      }));
      const ids = used(draftStory(input, mode)).sort((a, b) => a - b);
      assert.deepEqual(ids, input.map((p) => p.id), `${mode} ${n}`);
    }
  }
});

test("edge cases 0, 1, 2, 3 photographs", () => {
  assert.deepEqual(draftStory([], "mood"), []);
  assert.deepEqual(draftStory([], "days"), []);
  assert.deepEqual(draftStory([photo(1, "L")], "mood"), [{ kind: "image", photoIds: [1] }]);
  const two = draftStory([photo(1, "L"), photo(2, "P")], "mood");
  assert.deepEqual(used(two).sort(), [1, 2]);
  assert.equal(two[0].kind, "hero");
  const three = draftStory([photo(1, "L"), photo(2, "P"), photo(3, "P")], "mood");
  assert.deepEqual(used(three).sort(), [1, 2, 3]);
  assert.equal(three.filter((m) => m.kind === "hero").length, 1);
});

test("hero appears at most once and only first; featured wins over landscape", () => {
  const input = mixed(16);
  input[5] = { ...input[5], featured: true };
  for (const mode of ["mood", "days"] as const) {
    const out = draftStory(input, mode);
    assert.ok(out.filter((m) => m.kind === "hero").length <= 1);
    assert.equal(out[0].kind, "hero");
  }
  assert.deepEqual(draftStory(input, "mood")[0].photoIds, [input[5].id]);
});

test("no hero when there is neither a featured nor a landscape photograph", () => {
  const out = draftStory([photo(1, "P"), photo(2, "P"), photo(3, "P")], "mood");
  assert.equal(out.some((m) => m.kind === "hero"), false);
});

test("mood mode: no chapters, photograph order follows position", () => {
  const out = draftStory(mixed(10), "mood");
  assert.equal(out.some((m) => m.kind === "chapter"), false);
  assert.equal(out.every((m) => m.parentIndex === undefined), true);
  assert.deepEqual(used(out).slice(0, 1), [1]);
});

test("days mode: chronological chapters, no day mixing, localized titles", () => {
  const input: DraftPhoto[] = [
    photo(1, "L", { taken_at: "2026-06-03T09:00:00", position: 0 }),
    photo(2, "L", { taken_at: "2026-06-01T09:00:00", position: 1 }),
    photo(3, "P", { taken_at: "2026-06-01T11:00:00", position: 2 }),
    photo(4, "L", { taken_at: "2026-06-03T12:00:00", position: 3 }),
    photo(5, "P", { taken_at: "2026-06-02T08:00:00", position: 4 }),
    photo(6, "L", { taken_at: "2026-06-02T09:30:00", position: 5 }),
    photo(7, "L", { taken_at: "2026-06-02T09:10:00", position: 6 }),
  ];
  const out = draftStory(input, "days", { locale: "de" });
  const chapters = out.filter((m) => m.kind === "chapter");
  assert.deepEqual(chapters.map((c) => c.date), ["2026-06-01", "2026-06-02", "2026-06-03"].filter((d) => chapters.some((c) => c.date === d)));
  assert.deepEqual(chapters.map((c) => c.title), chapters.map((_, i) => `Tag ${i + 1}`));
  const byId = new Map(input.map((p) => [p.id, p]));
  out.forEach((m, index) => {
    if (m.kind === "chapter" || m.kind === "hero") return;
    assert.notEqual(m.parentIndex, undefined);
    const chapter = out[m.parentIndex!];
    assert.equal(chapter.kind, "chapter");
    assert.ok(m.parentIndex! < index);
    for (const id of m.photoIds) assert.equal(byId.get(id)!.taken_at!.slice(0, 10), chapter.date);
  });
  const english = draftStory(input, "days", { locale: "en" }).filter((m) => m.kind === "chapter");
  assert.equal(english[0].title, "Day 1");
});

test("days mode: order inside a day follows capture time", () => {
  const input: DraftPhoto[] = [
    photo(1, "L", { taken_at: "2026-06-01T08:00:00", position: 3 }),
    photo(2, "L", { taken_at: "2026-06-01T07:00:00", position: 0 }),
    photo(3, "L", { taken_at: "2026-06-01T09:00:00", position: 1 }),
    photo(4, "L", { taken_at: "2026-06-01T10:00:00", position: 2 }),
    photo(5, "L", { taken_at: "2026-06-01T11:00:00", position: 4 }),
  ].map((p) => ({ ...p, featured: p.id === 99 }));
  const flat = used(draftStory(input, "days"));
  const hero = flat[0];
  const rest = flat.filter((id) => id !== hero);
  const time = (id: number) => input.find((p) => p.id === id)!.taken_at!;
  assert.deepEqual(rest, rest.slice().sort((a, b) => (time(a) < time(b) ? -1 : 1)));
});

test("days mode: undated photographs go into a trailing 'more moments' chapter", () => {
  const input: DraftPhoto[] = [
    photo(1, "L", { taken_at: "2026-06-01T08:00:00" }),
    photo(2, "L", { taken_at: "2026-06-01T09:00:00" }),
    photo(3, "L", { taken_at: "2026-06-01T10:00:00" }),
    photo(4, "P"),
    photo(5, "L"),
    photo(6, "L"),
  ];
  const out = draftStory(input, "days", { locale: "en" });
  const last = out.filter((m) => m.kind === "chapter").pop()!;
  assert.equal(last.title, "More moments");
  assert.equal(last.date, undefined);
  assert.deepEqual(used(out).sort(), [1, 2, 3, 4, 5, 6]);
});

test("days mode without any date falls back to a chapter-free story", () => {
  const out = draftStory(mixed(8), "days");
  assert.equal(out.some((m) => m.kind === "chapter"), false);
});

test("invalid dates count as undated", () => {
  assert.equal(dayOf("2026-02-30T10:00:00"), null);
  assert.equal(dayOf("garbage"), null);
  assert.equal(dayOf(null), null);
  assert.equal(dayOf("2026-02-28T10:00:00"), "2026-02-28");
});

test("rhythm: a long landscape series becomes a rail of 3 to 6", () => {
  const input = Array.from({ length: 9 }, (_, i) => photo(i + 1, "L"));
  const out = draftStory(input, "mood");
  const rail = out.find((m) => m.kind === "rail");
  assert.ok(rail);
  assert.ok(rail!.photoIds.length >= 3 && rail!.photoIds.length <= 6);
});

test("rhythm: module sizes stay in range", () => {
  for (let n = 2; n <= 40; n++) {
    for (const m of draftStory(mixed(n), "mood")) {
      if (m.kind === "hero" || m.kind === "image") assert.equal(m.photoIds.length, 1);
      if (m.kind === "pair") assert.equal(m.photoIds.length, 2);
      if (m.kind === "rail") assert.ok(m.photoIds.length >= 3 && m.photoIds.length <= 6, `rail ${n}`);
      if (m.kind === "wall") assert.ok(m.photoIds.length >= 3 && m.photoIds.length <= 5, `wall ${n}`);
    }
  }
});

test("rhythm: no direct repetition of a module type for ordinary selections", () => {
  for (let n = 2; n <= 40; n++) {
    const list = images(draftStory(mixed(n), "mood"));
    list.forEach((m, i) => {
      if (i > 0) assert.notEqual(m.kind, list[i - 1].kind, `n=${n} index ${i}`);
    });
  }
});

test("rhythm: a leftover portrait is set as a spacious single image", () => {
  const out = draftStory([photo(1, "L"), photo(2, "L"), photo(3, "L"), photo(4, "P")], "mood");
  const lastImage = out[out.length - 1];
  assert.ok(lastImage.photoIds.includes(4));
});

test("cover photograph: no hero, cover excluded, everything else used once", () => {
  const input = mixed(10).map((p) => (p.id === 4 ? { ...p, featured: true } : p));
  for (const mode of ["mood", "days"] as const) {
    const out = draftStory(input, mode, { coverPhotoId: 4 });
    assert.equal(out.some((m) => m.kind === "hero"), false);
    assert.deepEqual(used(out).sort((a, b) => a - b), input.map((p) => p.id).filter((id) => id !== 4));
  }
});

test("cover photograph: kept when it is the only photograph; unknown cover ignored", () => {
  assert.deepEqual(draftStory([photo(1, "L")], "mood", { coverPhotoId: 1 }), [{ kind: "image", photoIds: [1] }]);
  const out = draftStory(mixed(6), "mood", { coverPhotoId: 999 });
  assert.equal(out[0].kind, "hero");
  assert.equal(used(out).length, 6);
});

import { isPlaceholderTitle, suggestJourneyTitle } from "../src/storyDraft.ts";

test("suggestJourneyTitle: single day, same month, across months and years (DE)", () => {
  assert.equal(suggestJourneyTitle({ start: "2025-08-09", end: "2025-08-09" }), "Reise am 9. August 2025");
  assert.equal(suggestJourneyTitle({ start: "2025-08-09", end: "2025-08-19" }), "Reise vom 9.–19. August 2025");
  assert.equal(suggestJourneyTitle({ start: "2025-07-28", end: "2025-08-03" }), "Reise vom 28. Juli – 3. August 2025");
  assert.equal(suggestJourneyTitle({ start: "2024-12-28", end: "2025-01-03" }), "Reise vom 28. Dezember 2024 – 3. Januar 2025");
});

test("suggestJourneyTitle: English wording", () => {
  assert.equal(suggestJourneyTitle({ start: "2025-08-09", end: "2025-08-09" }, "en"), "Journey on 9 August 2025");
  assert.equal(suggestJourneyTitle({ start: "2025-08-09", end: "2025-08-19" }, "en"), "Journey, 9–19 August 2025");
  assert.equal(suggestJourneyTitle({ start: "2025-07-28", end: "2025-08-03" }, "en"), "Journey, 28 July – 3 August 2025");
  assert.equal(suggestJourneyTitle({ start: "2024-12-28", end: "2025-01-03" }, "en"), "Journey, 28 December 2024 – 3 January 2025");
});

test("suggestJourneyTitle: no or invalid dates give null, swapped range is repaired", () => {
  assert.equal(suggestJourneyTitle(null), null);
  assert.equal(suggestJourneyTitle(undefined), null);
  assert.equal(suggestJourneyTitle({ start: "2025-02-30", end: "2025-03-01" }), null);
  assert.equal(suggestJourneyTitle({ start: "2025-08-19", end: "2025-08-09" }), "Reise vom 9.–19. August 2025");
});

test("isPlaceholderTitle only matches the generated names", () => {
  assert.equal(isPlaceholderTitle("Unbenannte Reise"), true);
  assert.equal(isPlaceholderTitle(" Untitled journey "), true);
  assert.equal(isPlaceholderTitle(""), true);
  assert.equal(isPlaceholderTitle("Schweiz"), false);
});
