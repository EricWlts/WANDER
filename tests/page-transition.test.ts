import test from "node:test";
import assert from "node:assert/strict";
import {
  PAGE_READY_MAX_MS,
  createScrollMemory,
  expectsCoverImage,
  navTargetFor,
  pageIsReady,
  pageTransitionAllowed,
  prefetchPathsFor,
  type PageReadiness,
} from "../src/adaptiveHeader.ts";

test("navigation targets follow the main navigation", () => {
  assert.equal(navTargetFor("/"), "home");
  assert.equal(navTargetFor("/archive"), "archive");
  assert.equal(navTargetFor("/inspiration"), "editions");
  assert.equal(navTargetFor("/inspiration/quiet-atlas"), "editions");
  assert.equal(navTargetFor("/about"), "about");
  assert.equal(navTargetFor("/studio"), "studio");
  assert.equal(navTargetFor("/studio/test/edit"), "studio");
  assert.equal(navTargetFor("/journeys/lisboa"), null);
  assert.equal(navTargetFor("/showcase/after-hours"), null);
});

test("public pages and the way into and out of the studio get the transition", () => {
  for (const [from, to] of [
    ["/", "/archive"], ["/archive", "/about"], ["/about", "/inspiration"],
    ["/inspiration", "/showcase/after-hours"], ["/archive", "/journeys/lisboa"],
    ["/", "/studio"], ["/studio", "/"], ["/studio/test/edit", "/archive"],
  ]) assert.equal(pageTransitionAllowed(from, to), true, `${from} -> ${to}`);
});

test("moves inside the studio and non-page URLs cut as before", () => {
  assert.equal(pageTransitionAllowed("/studio", "/studio/new"), false);
  assert.equal(pageTransitionAllowed("/studio/new", "/studio/test/edit"), false);
  assert.equal(pageTransitionAllowed("/", "/api/journeys"), false);
  assert.equal(pageTransitionAllowed("/", "/images/ch-steg-1280.webp"), false);
  assert.equal(pageTransitionAllowed("/", "/journeys/a/b"), false);
});

test("prefetch paths match the requests each page starts with", () => {
  assert.deepEqual(prefetchPathsFor("/", "en"), [
    "/journeys?public=1", "/showcase/after-hours?lang=en", "/showcase/quiet-atlas?lang=en", "/site/hero",
  ]);
  assert.deepEqual(prefetchPathsFor("/archive", "de"), ["/journeys?public=1"]);
  assert.deepEqual(prefetchPathsFor("/inspiration", "de"), ["/templates"]);
  assert.deepEqual(prefetchPathsFor("/journeys/lisboa", "de"), ["/journeys/lisboa?public=1"]);
  assert.deepEqual(prefetchPathsFor("/showcase/after-hours", "fr"), ["/showcase/after-hours?lang=de"]);
  assert.deepEqual(prefetchPathsFor("/inspiration/quiet-atlas", "en"), ["/templates/quiet-atlas/example?lang=en"]);
  assert.deepEqual(prefetchPathsFor("/about", "de"), []);
  assert.deepEqual(prefetchPathsFor("/studio", "de"), []);
});

const base: PageReadiness = {
  rendered: true, present: true, flag: null, busy: false, expectsImage: false, hasImage: false,
};

test("a page is ready only when rendered, present and not loading", () => {
  assert.equal(pageIsReady(base), true);
  assert.equal(pageIsReady({ ...base, rendered: false }), false);
  assert.equal(pageIsReady({ ...base, present: false }), false);
  assert.equal(pageIsReady({ ...base, busy: true }), false);
});

test("an explicit data-page-ready signal wins over the image heuristic", () => {
  assert.equal(pageIsReady({ ...base, flag: "false", hasImage: true }), false);
  assert.equal(pageIsReady({ ...base, flag: "true", expectsImage: true, hasImage: false }), true);
  assert.equal(pageIsReady({ ...base, flag: "true", busy: true }), false);
});

test("pages opening on a photograph wait for it without a signal", () => {
  assert.equal(pageIsReady({ ...base, expectsImage: true }), false);
  assert.equal(pageIsReady({ ...base, expectsImage: true, hasImage: true }), true);
  assert.equal(expectsCoverImage("/about"), true);
  assert.equal(expectsCoverImage("/inspiration"), true);
  assert.equal(expectsCoverImage("/journeys/lisboa"), true);
  assert.equal(expectsCoverImage("/studio"), false);
  assert.equal(expectsCoverImage("/archive"), false);
});

test("waiting is capped at 600 ms", () => {
  assert.equal(PAGE_READY_MAX_MS, 600);
});

test("scroll memory keeps one position per history entry and forgets the oldest", () => {
  const memory = createScrollMemory(3);
  memory.save("a", 120.6);
  memory.save("b", -5);
  assert.equal(memory.get("a"), 121);
  assert.equal(memory.get("b"), 0);
  memory.save("c", 300);
  memory.save("a", 400); // refreshes "a"
  memory.save("d", 500); // drops "b", the oldest
  assert.equal(memory.get("b"), undefined);
  assert.equal(memory.get("a"), 400);
  assert.equal(memory.size, 3);
});
