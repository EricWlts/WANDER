import test from "node:test";
import assert from "node:assert/strict";
import { closeNavigationOnEscape } from "../src/mobileNavigation.ts";

test("Escape closes the open navigation and returns focus to its toggle", () => {
  let closed = 0,
    focused = 0,
    prevented = 0;
  const handled = closeNavigationOnEscape(
    { key: "Escape", preventDefault: () => prevented++ },
    () => closed++,
    { focus: () => focused++ },
  );

  assert.equal(handled, true);
  assert.equal(closed, 1);
  assert.equal(focused, 1);
  assert.equal(prevented, 1);
});

test("other keys do not close or steal focus from the navigation", () => {
  let closed = 0,
    focused = 0,
    prevented = 0;
  const handled = closeNavigationOnEscape(
    { key: "Enter", preventDefault: () => prevented++ },
    () => closed++,
    { focus: () => focused++ },
  );

  assert.equal(handled, false);
  assert.equal(closed, 0);
  assert.equal(focused, 0);
  assert.equal(prevented, 0);
});
