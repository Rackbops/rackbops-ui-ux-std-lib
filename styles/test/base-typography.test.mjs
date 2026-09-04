// Bare (unclassed) h1-h6 / p / ul,ol / a / :focus-visible / ::selection must
// carry the same *set* of base rules across every theme -- same properties,
// same shared structural tokens -- even though each theme's literal values
// (weight, tracking, line-height, selection color) differ by design. See
// issue #5 (original h1/p/ul coverage) and #36 (extended coverage + value
// checks for the structural tokens -- a property merely being present isn't
// enough to catch e.g. a heading margin silently changed to 0, or a
// :focus-visible outline silently changed to a non-token color).
//
// This repo's test suite has no rendering/computed-style infra (contract.test.mjs
// is hand-rolled static CSS-text parsing) -- so "same base rules" is checked as
// "same declared property set, with required values for the structural tokens"
// rather than diffing real computed styles.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const themeDirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "test" && e.name !== "node_modules")
  .map((e) => e.name);

/** The declaration block (without braces) of the first rule whose selector
 * list contains `token`, or null if no such rule exists. A plain word token
 * (h1, p, ul, a) must appear selector-list-bounded (preceded by start of
 * string/whitespace/comma/open-paren, followed by whitespace/comma/close-
 * paren/end) so it can't match inside an unrelated identifier. A pseudo
 * token (leading `:`, e.g. :focus-visible or ::selection) is matched as a
 * plain substring instead -- ::selection in particular follows the guard's
 * closing `)` directly with no separator, which the word-boundary form can't
 * express, and `:`/`::` is already an unambiguous enough marker on its own
 * in this codebase. */
function findRuleBlock(css, token) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const isPseudo = token.startsWith(":");
  const wordBoundary = isPseudo ? null : new RegExp(`(^|[\\s,(])${token}([\\s,)]|$)`);
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) return null;
    const prelude = css.slice(i, open);
    const close = css.indexOf("}", open);
    const matches = isPseudo ? prelude.includes(token) : wordBoundary.test(prelude);
    if (matches) return css.slice(open + 1, close);
    i = close + 1;
  }
  return null;
}

/** Map of declared property name -> its (trimmed) value string. */
function declaredValues(block) {
  const map = new Map();
  for (const stmt of block.split(";")) {
    const trimmed = stmt.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    map.set(trimmed.slice(0, idx).trim(), trimmed.slice(idx + 1).trim());
  }
  return map;
}

// Every bare rule checked, keyed by the selector token findRuleBlock should
// locate. `props` maps each required property to either the structural-token
// substring its value MUST contain, or null when the value is legitimately
// theme-specific (voice/contrast choices, not shared structure) and only
// presence is required.
const RULES = [
  {
    name: "h1-h6",
    token: "h1",
    props: {
      margin: "var(--rb-space-3)",
      "font-family": null,
      "font-weight": null,
      "letter-spacing": null,
      "line-height": null,
    },
  },
  {
    name: "p",
    token: "p",
    props: { margin: "var(--rb-space-3)" },
  },
  {
    name: "ul,ol",
    token: "ul",
    props: {
      margin: "var(--rb-space-3)",
      "padding-inline-start": "var(--rb-space-4)",
    },
  },
  {
    // color intentionally unconstrained: var(--rb-accent) in ten themes,
    // color: inherit in rackbops-studio -- both are documented, deliberate
    // choices (see that theme's design.md Accessibility section), not drift.
    name: "a",
    token: "a",
    props: { color: null },
  },
  {
    name: ":focus-visible",
    token: ":focus-visible",
    props: { outline: "var(--rb-accent)" },
  },
  {
    // background is always the accent (the structural rule); color legitimately
    // varies per theme for contrast against it (accent-fg, #fff, or bg).
    name: "::selection",
    token: "::selection",
    props: { background: "var(--rb-accent)", color: null },
  },
];

for (const theme of themeDirs) {
  const base = readFileSync(join(ROOT, theme, "base.css"), "utf-8");

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

  for (const rule of RULES) {
    test(`${theme}: bare ${rule.name} rule declares the shared base properties`, () => {
      const block = findRuleBlock(base, rule.token);
      assert.ok(block, `${theme}/base.css: no rule targets ${rule.name}`);
      const values = declaredValues(block);
      for (const [prop, requiredSubstring] of Object.entries(rule.props)) {
        assert.ok(values.has(prop), `${theme}/base.css: ${rule.name} rule misses ${prop}`);
        if (requiredSubstring !== null) {
          assert.ok(
            values.get(prop).includes(requiredSubstring),
            `${theme}/base.css: ${rule.name} rule's ${prop} ("${values.get(prop)}") should reference ${requiredSubstring}`
          );
        }
      }
    });
  }
}
