import test from "node:test";
import assert from "node:assert/strict";
import { popTransitionWanted, TRANSITION_CLASS_MAX_MS } from "../src/adaptiveHeader.ts";

test("Back/Forward between different public pages cross-fades", () => {
  assert.equal(popTransitionWanted({ fromPath: "/", toPath: "/inspiration" }), true);
});

test("same path and search never starts a transition", () => {
  assert.equal(popTransitionWanted({ fromPath: "/", toPath: "/" }), false);
  assert.equal(popTransitionWanted({ fromPath: "/a", fromSearch: "?x=1", toPath: "/a", toSearch: "?x=1" }), false);
});

test("photo viewer entries never start a transition", () => {
  assert.equal(popTransitionWanted({ fromPath: "/", toPath: "/inspiration", fromLightbox: true }), false);
  assert.equal(popTransitionWanted({ fromPath: "/", toPath: "/inspiration", toLightbox: true }), false);
});

test("the class safety net is 1500 ms", () => {
  assert.equal(TRANSITION_CLASS_MAX_MS, 1500);
});
