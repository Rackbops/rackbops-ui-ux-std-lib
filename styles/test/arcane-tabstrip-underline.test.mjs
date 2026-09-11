// The arcane pair's Tabstrip carries the rationed gradient as the active
// tab's 2px underline -- fidelity to artifact-console 1.x, whose
// `.tabstrip button.active::after` paints `var(--accent-grad)` under the
// active view tab (static/style.css). The pair was reverse-documented
// without it; CLAUDE.md's "Fidelity is a hard rule" makes that a defect,
// and this pins the fix so it can't silently regress in one theme.
//
// Static CSS-text check, like the rest of this suite: the rule whose
// selector targets `.rb-tabstrip__tab--active::after` must exist in BOTH
// arcane tabstrip.css files and its block must paint the gradient at 2px.
// Deleting the rule (or its background) in either theme goes red.
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, stripComments, cssOf } from "./css.mjs";

const ARCANE = ["arcane-obsidian", "arcane-parchment"];
const SELECTOR = ".rb-tabstrip__tab--active::after";

/** The declaration block of the first rule whose selector list contains
 * `selector`, or null. Comments are stripped first so a commented-out rule
 * never counts. */
function ruleBlock(css, selector) {
  const src = stripComments(css);
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open === -1) return null;
    const close = src.indexOf("}", open);
    if (close === -1) return null;
    const prelude = src.slice(i, open);
    if (prelude.includes(selector)) return src.slice(open + 1, close);
    i = close + 1;
  }
  return null;
}

/** `prop: value` pairs of a declaration block, whitespace-normalised. */
function declarations(block) {
  return Object.fromEntries(
    block
      .split(";")
      .map((d) => d.trim())
      .filter(Boolean)
      .map((d) => {
        const at = d.indexOf(":");
        return [d.slice(0, at).trim(), d.slice(at + 1).trim()];
      }),
  );
}

for (const theme of ARCANE) {
  test(`${theme}: the active tabstrip tab paints the rationed gradient as a 2px underline`, () => {
    const css = cssOf(join(ROOT, theme, "components", "tabstrip.css"));
    const block = ruleBlock(css, SELECTOR);
    assert.ok(block, `${theme}/components/tabstrip.css has no ${SELECTOR} rule`);

    const decl = declarations(block);
    assert.equal(decl.background, "var(--rb-accent-grad)", `${theme}: the underline must paint --rb-accent-grad`);
    assert.equal(decl.height, "2px", `${theme}: the underline is 2px, as artifact-console 1.x draws it`);
    assert.equal(decl.content, '""', `${theme}: a ::after with no content never renders`);
    assert.equal(decl.position, "absolute", `${theme}: the underline is positioned within the tab`);
    // Geometry: inset by --rb-space-3 either side, sitting on the pill's
    // 1px bottom border, rounded on top only (1.x: left/right 12px,
    // border-radius 2px 2px 0 0).
    assert.equal(decl.left, "var(--rb-space-3)", `${theme}: the underline is inset --rb-space-3 from the left`);
    assert.equal(decl.right, "var(--rb-space-3)", `${theme}: the underline is inset --rb-space-3 from the right`);
    assert.equal(decl.bottom, "-1px", `${theme}: the underline sits on the pill's bottom border`);
    assert.equal(decl["border-radius"], "2px 2px 0 0", `${theme}: the underline is rounded on top only`);
    // A decorative indicator that appears/disappears with the active class --
    // no transition of its own, so there is nothing for prefers-reduced-motion
    // to have to suppress.
    assert.equal(decl.transition, undefined, `${theme}: the underline must not animate`);
  });
}

test("ruleBlock: matches the rule, not a comment or a different pseudo", () => {
  const css = `
    /* .x::after { background: var(--rb-accent-grad); } */
    .x::before { content: ""; }
    .x.x--active::after { content: ""; height: 2px; }
  `;
  assert.equal(ruleBlock(css, ".x--active::after")?.trim(), 'content: ""; height: 2px;');
  assert.equal(ruleBlock(css, ".x::after"), null);
  assert.equal(ruleBlock(css, ".missing"), null);
});
