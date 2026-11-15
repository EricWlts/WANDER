import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../src/journal.css", import.meta.url), "utf8");

/** All rules whose selector list names exactly the text and quote module, with their padding-block value. */
function paddingBlockRules(): Array<{ selector: string; value: string }> {
  const rules: Array<{ selector: string; value: string }> = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().replace(/\s+/g, " ");
    if (!/(^|, )(\.journal-module)?\.module-(text|quote)$/.test(selector.split(",").map((x) => x.trim()).join(", "))) continue;
    const decl = m[2].match(/(?:^|;|\s)padding-block:\s*([^;]+);/);
    if (decl) rules.push({ selector, value: decl[1].trim() });
  }
  return rules;
}

test("text and quote modules follow the top & bottom margin slider (--module-padding)", () => {
  const rules = paddingBlockRules();
  assert.ok(rules.length >= 4, "expected the desktop, base and mobile rules");
  for (const { selector, value } of rules)
    assert.match(value, /var\(--module-(mobile-)?padding,/, `"${selector}" ignores the slider: padding-block: ${value}`);
});
