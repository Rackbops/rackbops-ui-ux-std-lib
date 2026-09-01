// Bare (unclassed) h1-h6 / p / ul,ol must carry the same *set* of base rules
// across every theme -- same properties, same shared spacing tokens -- even
// though each theme's literal values (weight, tracking, line-height) differ
// by design. See issue #5.
//
// This repo's test suite has no rendering/computed-style infra (contract.test.mjs
// is hand-rolled static CSS-text parsing) -- so "same base rules" is checked as
// "same declared property set" rather than diffing real computed styles.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const themeDirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "test" && e.name !== "node_modules")
  .map((e) => e.name);

/** The declaration block (without braces) of the first rule whose selector list
 * contains `token` as a whole word, or null if no such rule exists. */
function findRuleBlock(css, token) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const wordBoundary = new RegExp(`(^|[\\s,(])${token}([\\s,)]|$)`);
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) return null;
    const prelude = css.slice(i, open);
    const close = css.indexOf("}", open);
    if (wordBoundary.test(prelude)) return css.slice(open + 1, close);
    i = close + 1;
  }
  return null;
}

function declaredProps(block) {
  return new Set(
    block
      .split(";")
      .map((d) => d.trim().split(":")[0].trim())
      .filter(Boolean)
  );
}

for (const theme of themeDirs) {
  const base = readFileSync(join(ROOT, theme, "base.css"), "utf-8");

  test(`${theme}: bare h1 rule declares the shared heading properties`, () => {
    const block = findRuleBlock(base, "h1");
    assert.ok(block, `${theme}/base.css: no rule targets h1`);
    const props = declaredProps(block);
    for (const prop of ["margin", "font-family", "font-weight", "letter-spacing", "line-height"]) {
      assert.ok(props.has(prop), `${theme}/base.css: heading rule misses ${prop}`);
    }
  });

  test(`${theme}: heading selector explicitly lists h1 through h6`, () => {
    const match = base.match(/:where\(([^)]*\bh1\b[^)]*)\)\s*\{/);
    assert.ok(match, `${theme}/base.css: no :where(...) selector contains h1`);
    for (const level of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      assert.ok(
        new RegExp(`(^|[\\s,])${level}([\\s,]|$)`).test(match[1]),
        `${theme}/base.css: heading selector misses ${level}`
      );
    }
  });

  test(`${theme}: bare p rule sets margin`, () => {
    const block = findRuleBlock(base, "p");
    assert.ok(block, `${theme}/base.css: no rule targets p`);
    assert.ok(declaredProps(block).has("margin"), `${theme}/base.css: p rule misses margin`);
  });

  test(`${theme}: bare ul,ol rule sets margin and indent`, () => {
    const block = findRuleBlock(base, "ul");
    assert.ok(block, `${theme}/base.css: no rule targets ul`);
    const props = declaredProps(block);
    assert.ok(props.has("margin"), `${theme}/base.css: ul,ol rule misses margin`);
    assert.ok(
      props.has("padding-inline-start"),
      `${theme}/base.css: ul,ol rule misses padding-inline-start`
    );
  });
}
