import assert from "node:assert/strict";
import test from "node:test";
import {
  canOpenStation,
  coverCandidate,
  filmFill,
  PREVIEW_FRAME,
  PREVIEW_PHOTO_CAP,
  stationState,
  structurePreview,
} from "../src/newStoryFlow.ts";
import { formatSheetLine, formatSheetMegabytes, sheetProgress } from "../src/uploadProgress.ts";

const MB = 1_000_000;

test("film strip: stations, fill and which ones open", () => {
  assert.equal(stationState(1, 3), "done");
  assert.equal(stationState(3, 3), "active");
  assert.equal(stationState(4, 3), "next");
  assert.equal(filmFill(1), 0.25);
  assert.equal(filmFill(4), 1);
  assert.equal(canOpenStation(2, 3), true);
  assert.equal(canOpenStation(3, 3), false);
  assert.equal(canOpenStation(4, 3), false);
});

test("cover candidate: first landscape by position, none for portraits only", () => {
  const photos = [
    { id: 3, width: 4000, height: 3000, position: 2 },
    { id: 1, width: 3000, height: 4000, position: 0 },
    { id: 2, width: 6000, height: 4000, position: 1 },
  ];
  assert.equal(coverCandidate(photos)?.id, 2);
  assert.equal(coverCandidate([{ id: 1, width: 3000, height: 4000, position: 0 }]), undefined);
  assert.equal(coverCandidate([{ id: 1, width: 4000, height: 4000, position: 0 }]), undefined);
});

test("sheet progress counts files, bytes and errors", () => {
  const p = sheetProgress([
    { status: "done", size: 10 * MB },
    { status: "uploading", size: 20 * MB, loaded: 5 * MB },
    { status: "processing", size: 4 * MB, loaded: 1 * MB },
    { status: "waiting", size: 6 * MB },
    { status: "error", size: 9 * MB },
    { status: "removed", size: 50 * MB },
  ]);
  assert.deepEqual(p, { done: 1, total: 4, failed: 1, doneBytes: 19 * MB, totalBytes: 40 * MB, active: true });
  assert.equal(sheetProgress([], 3).total, 3);
  assert.equal(sheetProgress([], 3).active, false);
});

test("sheet line: running, finished, resumed and small files", () => {
  const running = { done: 12, total: 30, failed: 0, doneBytes: 48.2 * MB, totalBytes: 126.4 * MB, active: true };
  assert.equal(formatSheetLine(running, "de"), "12 von 30 Fotos · 48 von 126 MB");
  assert.equal(formatSheetLine(running, "en"), "12 of 30 photographs · 48 of 126 MB");
  assert.equal(formatSheetLine({ ...running, active: false, done: 30 }, "de"), "30 Fotos · 126 MB");
  assert.equal(formatSheetLine({ done: 1, total: 1, failed: 2, doneBytes: 0, totalBytes: 0, active: false }, "de"), "1 Foto · 2 Fehler");
  assert.equal(formatSheetMegabytes(3.44 * MB, 8 * MB, "de"), "3,4");
  assert.equal(formatSheetMegabytes(3.44 * MB, 80 * MB, "en"), "3");
});

const day = (d: number, h = 10) => `2025-08-0${d}T${String(h).padStart(2, "0")}:00:00`;
const shots = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  width: i % 3 === 0 ? 3000 : 6000,
  height: 4000,
  position: i,
  taken_at: day(1 + Math.floor(i / 4), 8 + (i % 4)),
}));

const used = (p: ReturnType<typeof structurePreview>, gap: number, lead = 0) =>
  lead + p.modules.reduce((sum, m, i) => sum + m.height + (i || lead ? gap : 0), 0);

test("structure preview: days show a day line, nothing cropped, only whole modules", () => {
  const days = structurePreview(shots, "days", { locale: "de" });
  assert.equal(days.modules[0].kind, "chapter");
  assert.notEqual(days.modules[days.modules.length - 1].kind, "chapter");
  const f = PREVIEW_FRAME.framed;
  assert.ok(used(days, f.gap) <= f.height);
  for (const m of days.modules) {
    assert.ok(m.photoIds.length <= PREVIEW_PHOTO_CAP[m.kind]);
    // every photograph keeps its own aspect ratio
    m.photoIds.forEach((id, i) => {
      const p = shots[id - 1];
      assert.equal(m.ratios[i], p.width / p.height);
    });
    assert.equal(m.rows.reduce((a, b) => a + b, 0), m.photoIds.length);
  }
  const shown = days.modules.filter((m) => m.kind !== "chapter").length;
  assert.ok(days.more > 0 && shown + days.more <= shots.length);
});

test("structure preview: mood has no chapters, a moment one large picture", () => {
  const mood = structurePreview(shots, "mood");
  assert.ok(mood.modules.length > 0 && mood.modules.every((m) => m.kind !== "chapter"));
  const moment = structurePreview(shots, "moment");
  assert.equal(moment.modules.length, 1);
  assert.equal(moment.modules[0].kind, "hero");
  assert.equal(moment.modules[0].photoIds.length, 1);
  assert.ok(moment.modules[0].width > PREVIEW_FRAME.framed.image);
  const f = PREVIEW_FRAME.framed;
  assert.ok(used(moment, f.gap, f.heading) <= f.height);
  assert.deepEqual(structurePreview([], "days"), { modules: [], more: 0 });
});

test("structure preview: a tall portrait is scaled down to fit, never cut", () => {
  const tall = [1, 2, 3].map((id) => ({ id, width: 1000, height: 3000, position: id }));
  for (const frame of [PREVIEW_FRAME.framed, PREVIEW_FRAME.bleed]) {
    const p = structurePreview(tall, "moment", { frame });
    assert.equal(p.modules.length, 1);
    assert.ok(p.modules[0].width < 1);
    assert.ok(Math.abs(used(p, frame.gap, frame.heading) - frame.height * 0.98) < 1e-9);
  }
});
