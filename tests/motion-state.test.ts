import test from "node:test";
import assert from "node:assert/strict";
import {
  cachedQuery,
  isMotionOff,
  joinScrollFrames,
  prefersReducedMotion,
  reducedMotionQuery,
  requestScrollFrame,
  type MotionWindow,
  type ScrollFrameWindow,
} from "../src/motionState.ts";

function fakeMotionWindow(reduce: boolean, motion?: string) {
  let calls = 0;
  const win = {
    matchMedia: (query: string) => {
      calls++;
      return { matches: reduce, media: query } as unknown as MediaQueryList;
    },
    document: { documentElement: { dataset: { motion } as DOMStringMap } },
  } satisfies MotionWindow;
  return { win, calls: () => calls };
}

test("die MediaQueryList wird pro Fenster einmal angelegt und wiederverwendet", () => {
  const { win, calls } = fakeMotionWindow(false);
  const first = reducedMotionQuery(win);
  for (let i = 0; i < 50; i++) assert.equal(reducedMotionQuery(win), first);
  assert.equal(calls(), 1);
  // Andere Abfrage = eigene Instanz, aber ebenfalls nur einmal.
  const compact = cachedQuery("(max-width: 760px)", win);
  assert.notEqual(compact, first);
  assert.equal(cachedQuery("(max-width: 760px)", win), compact);
  assert.equal(calls(), 2);
});

test("zwei Fenster teilen keine Abfrage", () => {
  const a = fakeMotionWindow(false).win;
  const b = fakeMotionWindow(true).win;
  assert.notEqual(reducedMotionQuery(a), reducedMotionQuery(b));
  assert.equal(prefersReducedMotion(a), false);
  assert.equal(prefersReducedMotion(b), true);
});

test("Bewegung ist aus bei reduced-motion ODER data-motion=off", () => {
  assert.equal(isMotionOff(fakeMotionWindow(false, "on").win), false);
  assert.equal(isMotionOff(fakeMotionWindow(false).win), false);
  assert.equal(isMotionOff(fakeMotionWindow(true, "on").win), true);
  assert.equal(isMotionOff(fakeMotionWindow(false, "off").win), true);
  assert.equal(isMotionOff(fakeMotionWindow(true, "off").win), true);
});

test("ohne window (Node) ist Bewegung nicht aus und nichts wirft", () => {
  assert.equal(isMotionOff(), false);
  assert.equal(prefersReducedMotion(), false);
  assert.equal(reducedMotionQuery(), undefined);
});

function fakeFrameWindow() {
  const listeners = new Map<string, Set<unknown>>();
  const frames: (() => void)[] = [];
  const win = {
    addEventListener: (type: string, fn: unknown) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    },
    removeEventListener: (type: string, fn: unknown) => listeners.get(type)?.delete(fn),
    requestAnimationFrame: (fn: () => void) => frames.push(fn),
    cancelAnimationFrame: (id: number) => {
      frames[id - 1] = () => {};
    },
  } as unknown as ScrollFrameWindow;
  const count = (type: string) => listeners.get(type)?.size ?? 0;
  const flush = () => frames.splice(0).forEach((fn) => fn());
  return { win, count, flush, pending: () => frames.length };
}

test("beliebig viele Einträge teilen sich einen Scroll- und einen Resize-Listener", () => {
  const { win, count } = fakeFrameWindow();
  const leaves = Array.from({ length: 40 }, () => joinScrollFrames(win, { read: () => {} }));
  assert.equal(count("scroll"), 1);
  assert.equal(count("resize"), 1);
  leaves.slice(0, 39).forEach((leave) => leave());
  assert.equal(count("scroll"), 1);
  leaves[39]();
  assert.equal(count("scroll"), 0);
  assert.equal(count("resize"), 0);
});

test("ein zweites Fenster (Iframe-Vorschau) wird mitgehört und sauber freigegeben", () => {
  const frame = fakeFrameWindow();
  const top = fakeFrameWindow();
  const leave = joinScrollFrames(frame.win, { read: () => {} }, top.win);
  assert.equal(frame.count("scroll"), 1);
  assert.equal(top.count("scroll"), 1);
  leave();
  assert.equal(frame.count("scroll"), 0);
  assert.equal(top.count("scroll"), 0);
});

test("erst alle Lesevorgänge, dann alle Schreiber, in einem Frame", () => {
  const { win, flush, pending } = fakeFrameWindow();
  const log: string[] = [];
  const entry = (name: string) => ({
    read: () => {
      log.push(`read ${name}`);
      return () => log.push(`write ${name}`);
    },
  });
  const leaves = [joinScrollFrames(win, entry("a")), joinScrollFrames(win, entry("b"))];
  assert.equal(pending(), 1);
  requestScrollFrame(win);
  requestScrollFrame(win);
  assert.equal(pending(), 1);
  flush();
  assert.deepEqual(log, ["read a", "read b", "write a", "write b"]);
  leaves.forEach((leave) => leave());
});

test("abgemeldete Einträge werden nicht mehr gelesen; Neuanmeldung funktioniert", () => {
  const { win, flush, count } = fakeFrameWindow();
  let reads = 0;
  const entry = { read: () => void reads++ };
  const leave = joinScrollFrames(win, entry);
  leave();
  leave();
  flush();
  assert.equal(reads, 0);
  const again = joinScrollFrames(win, entry);
  assert.equal(count("scroll"), 1);
  flush();
  assert.equal(reads, 1);
  again();
});
