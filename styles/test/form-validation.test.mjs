// Help text, error text and a required marker in every theme (STANDARD.md 5.1/5.5/9, issue #210).
// The invalid state itself ([aria-invalid="true"] on .rb-input/.rb-select/.rb-textarea) is pinned
// by contract.test.mjs's ariaStates check; this file covers the three new element classes.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, themeDirs, stripComments, cssOf, splitSelectors } from "./css.mjs";

/** The declaration body of the first rule whose selector list has a compound
 * ending exactly in `suffix` (after stripping the :where(...) scope prefix
 * every rule carries). `css` must be comment-stripped. */
function ruleBodyEndingIn(css, suffix) {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    for (const sel of splitSelectors(m[1].trim())) {
      const bare = sel.replace(/^:where\([^)]*\)/, "").trim();
      if (bare.endsWith(suffix)) return m[2];
    }
  }
  return null;
}

/** Every `property: value` declaration whose value is a bare colour literal
 * (hex or rgb/rgba) rather than a `var(--rb-*)` reference or a non-colour
 * value (a length, a keyword) -- used to assert the new rules spend only
 * tokens, never a literal, for colour. */
function literalColourDeclarations(body) {
  const out = [];
  for (const m of body.matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
    const [, prop, value] = m;
    if (!/^(color|background(-color)?|border(-left)?(-color)?)$/.test(prop)) continue;
    if (value.includes("var(--rb-")) continue;
    if (/^(transparent|inherit|initial|unset|none)$/.test(value.trim())) continue;
    if (/#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(value)) out.push(`${prop}: ${value}`);
  }
  return out;
}

for (const theme of themeDirs) {
  const css = stripComments(cssOf(join(ROOT, theme, "components", "form.css")));

  test(`${theme}: .rb-field__help, .rb-field__error and .rb-label__required all exist (#210)`, () => {
    for (const suffix of [".rb-field__help", ".rb-field__error", ".rb-label__required"]) {
      assert.ok(ruleBodyEndingIn(css, suffix), `${theme}: no ${suffix} rule found in components/form.css`);
    }
  });

  test(`${theme}: error text is ink with a danger bar, never coloured small text (#210, STANDARD.md 9)`, () => {
    const error = ruleBodyEndingIn(css, ".rb-field__error");
    assert.ok(error, `${theme}: no .rb-field__error rule`);
    assert.match(error, /color:\s*var\(--rb-text\)(?!-)/, `${theme}: .rb-field__error must set color: var(--rb-text) -- ink, not danger`);
    assert.doesNotMatch(error, /color:\s*var\(--rb-danger\)/, `${theme}: .rb-field__error must never set color: var(--rb-danger) -- the §9 anti-pattern`);
    assert.match(
      error,
      /border-left:[^;]*var\(--rb-danger\)/,
      `${theme}: .rb-field__error must reinforce with a border-left naming var(--rb-danger)`,
    );
  });

  test(`${theme}: [aria-invalid="true"] is selected for .rb-input, .rb-select and .rb-textarea (#210)`, () => {
    // Mirrors contract.test.mjs's ariaStates check (the mechanical pin); this
    // is the same assertion written directly against the source, so a bug in
    // the shared evalAriaState helper can't hide a real gap from both tests
    // at once.
    for (const base of [".rb-input", ".rb-select", ".rb-textarea"]) {
      const found = [...css.matchAll(/([^{}]+)\{/g)].some((m) =>
        splitSelectors(m[1].trim()).some((s) => {
          const bare = s.replace(/^:where\([^)]*\)/, "").trim();
          return bare.startsWith(base) && bare.includes('[aria-invalid="true"]');
        }),
      );
      assert.ok(found, `${theme}: no rule selects ${base}[aria-invalid="true"]`);
    }
  });

  test(`${theme}: every colour in .rb-field__help/.rb-field__error/.rb-label__required is a var(--rb-*) token (#210)`, () => {
    for (const suffix of [".rb-field__help", ".rb-field__error", ".rb-label__required"]) {
      const body = ruleBodyEndingIn(css, suffix);
      assert.ok(body, `${theme}: no ${suffix} rule`);
      const literals = literalColourDeclarations(body);
      assert.deepEqual(literals, [], `${theme}: ${suffix} has a literal colour instead of a var(--rb-*) token: ${literals.join(", ")}`);
    }
  });
}
