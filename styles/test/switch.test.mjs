// A track-and-thumb .rb-switch in every theme (STANDARD.md 5.1/7, issue #209).
// Family (a) (nine themes) gets the shared shape this issue adds; the concrete
// pair and the three ports already drew their own track and thumb and keep it
// (STANDARD.md 5.3's "a theme reads a component its own way when its design.md
// says so" spirit) -- every theme, all fourteen, still satisfies the same
// contract of states below.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, themeDirs, stripComments, cssOf, splitSelectors } from "./css.mjs";

/** The declaration body of the first rule whose selector list has a compound
 * ending exactly in `suffix` (after stripping the :where(...) scope prefix
 * every rule carries) -- so `.rb-switch` never matches `.rb-switch:checked`
 * or `.rb-switch::after` by substring accident. `css` must be comment-stripped. */
function ruleBodyEndingIn(css, suffix) {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const sel of splitSelectors(m[1].trim())) {
      const bare = sel.replace(/^:where\([^)]*\)/, "").trim();
      if (bare.endsWith(suffix)) return m[2];
    }
  }
  return null;
}

/** Every rule (selector list + body) in a comment-stripped CSS string, as
 * {selectors, body} pairs -- for the two checks below that need to inspect
 * ALL matching rules, not just the first. */
function allRules(css) {
  const rules = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    rules.push({ selectors: splitSelectors(m[1].trim()).map((s) => s.replace(/^:where\([^)]*\)/, "").trim()), body: m[2] });
  }
  return rules;
}

for (const theme of themeDirs) {
  const css = stripComments(cssOf(join(ROOT, theme, "components", "form.css")));

  test(`${theme}: .rb-switch is a real switch, not a checkbox widened by accent-color (#209)`, () => {
    const base = ruleBodyEndingIn(css, ".rb-switch");
    assert.ok(base, `${theme}: no bare .rb-switch rule found in components/form.css`);
    assert.match(base, /appearance:\s*none/, `${theme}: .rb-switch must set appearance: none`);
    // Mutation: restoring `accent-color` + a bare `width: 2rem` checkbox-style
    // override, with no `appearance: none`, must fail here.
    for (const rule of allRules(css)) {
      if (!rule.selectors.some((s) => s === ".rb-switch" || s.startsWith(".rb-switch:") || s.startsWith(".rb-switch::"))) continue;
      assert.doesNotMatch(
        rule.body,
        /accent-color/,
        `${theme}: a .rb-switch rule still declares accent-color -- the switch is no longer a widened native checkbox`,
      );
    }
  });

  test(`${theme}: the checked state moves the thumb (distinguishable without colour) (#209)`, () => {
    const checkedAfter = ruleBodyEndingIn(css, ".rb-switch:checked::after");
    assert.ok(checkedAfter, `${theme}: no .rb-switch:checked::after rule -- the thumb has nowhere documented to move to`);
    assert.match(
      checkedAfter,
      /transform:\s*translateX\(/,
      `${theme}: .rb-switch:checked::after must declare transform: translateX(...) so checked is readable by position alone`,
    );
  });

  test(`${theme}: a disabled switch is visually inert (#209)`, () => {
    const disabled = ruleBodyEndingIn(css, ".rb-switch:disabled");
    assert.ok(disabled, `${theme}: no .rb-switch:disabled rule -- STANDARD.md 7's Disabled row (opacity + not-allowed) is unmet`);
    assert.match(disabled, /cursor:\s*not-allowed/, `${theme}: .rb-switch:disabled must set cursor: not-allowed`);
    assert.match(disabled, /opacity:/, `${theme}: .rb-switch:disabled must reduce opacity`);
  });

  test(`${theme}: no switch-specific focus rule changes the border width (the concrete pair's #86 lesson) (#209)`, () => {
    // A theme MAY replace the base outline with its own accent indicator on
    // :focus-visible (STANDARD.md 7 -- concrete-signal's form controls,
    // luminous-precision, neon-butterfly and summer-cloud already do, sanctioned
    // there) as long as it doesn't change the control's BORDER WIDTH: that moves
    // the padding edge the thumb's inset is measured from and visibly shifts it
    // (#86). Family (a)'s new shared rule (and mono-field, which had a
    // redundant switch-specific :focus-visible chained into the base rule)
    // carries no switch-specific focus rule at all -- the base rule covers it.
    for (const rule of allRules(css)) {
      if (!rule.selectors.some((s) => s.startsWith(".rb-switch") && s.includes(":focus-visible"))) continue;
      assert.doesNotMatch(
        rule.body,
        /border-width\s*:/,
        `${theme}: a .rb-switch:focus-visible rule declares border-width -- this moves the thumb (#86)`,
      );
      const borderShorthand = rule.body.match(/(?<!-)\bborder\s*:\s*([^;]+)/);
      if (borderShorthand) {
        assert.doesNotMatch(
          borderShorthand[1],
          /\b(?:[2-9]|\d{2,})px\b/,
          `${theme}: a .rb-switch:focus-visible rule's border shorthand widens past 1px -- this moves the thumb (#86)`,
        );
      }
    }
  });
}
