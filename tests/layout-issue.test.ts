import test from "node:test";
import assert from "node:assert/strict";
import { layoutIssue, layoutIssuePane } from "../src/editor/layoutIssue.ts";

const de = (_en: string, de: string) => de;

test("names module and setting in German", () => {
  const issue = layoutIssue(-3, "columns", ["Photo wall", "Fotowand"], de);
  assert.equal(issue.message, "Fotowand: Einstellung ‚Spalten‘ ist ungültig");
  assert.equal(issue.moduleId, -3);
  assert.equal(issue.pane, "design");
});

test("photo choices open the content pane", () => {
  assert.equal(layoutIssuePane("all_photos"), "content");
  assert.equal(layoutIssuePane("placements"), "content");
  assert.equal(layoutIssuePane("frame"), "design");
  assert.equal(layoutIssuePane(null), "design");
});

test("without a module or key the message stays clear", () => {
  assert.equal(layoutIssue(null, null, null, de).message, "Geschichte: eine Einstellung ist ungültig");
  assert.equal(layoutIssue(1, "mystery", ["Text", "Text"], de).message, "Text: Einstellung ‚mystery‘ ist ungültig");
});
