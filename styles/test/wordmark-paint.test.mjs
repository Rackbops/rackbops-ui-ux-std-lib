// Pins the shared `.rb-wordmark` anatomy across all fourteen themes (promoted
// from a four-theme extra to the shared component set, #185): every theme
// keeps `width: fit-content` (STANDARD.md 5.1's "sizes to its own content"
// rule -- without it the gradient-clipping themes would spend most of their
// span on empty space instead of sweeping through the text). Paint follows
// each theme's own gradient ration: the four themes that already ration
// `--rb-accent-grad` to the wordmark (arcane + kenzen pairs) clip it into the
// text; the other ten pay no gradient and paint solid `--rb-text`.
//
// GRADIENT_THEMES below was verified against every styles/<theme>/components/
// wordmark.css by inspection (2026-09-11), not assumed from the design doc --
// a theme that starts rationing (or stops) must update this list in the same
// change, which is the point: deleting or flipping either declaration in any
// theme goes red.
//
// Static CSS-text check, like the rest of this suite (see
// arcane-tabstrip-underline.test.mjs for the same pattern).
import assert from "node:assert/strict";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, stripComments, cssOf, themeDirs } from "./css.mjs";

const GRADIENT_THEMES = ["arcane-obsidian", "arcane-parchment", "kenzen-midnight", "kenzen-cyberhealth"];

/** The declaration block of the theme's own `.rb-wordmark` rule -- the base
 * class, never `.rb-wordmark__spark`. Matched by an exact suffix (not
 * `includes`) so the longer class can never shadow the shorter one
 * regardless of which rule happens to appear first in the file. */
function wordmarkBlock(css) {
  const src = stripComments(css);
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf("{", i);
    if (open === -1) return null;
    const close = src.indexOf("}", open);
    if (close === -1) return null;
    const prelude = src.slice(i, open).trim();
    if (prelude.endsWith(".rb-wordmark")) return src.slice(open + 1, close);
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

for (const theme of themeDirs) {
  test(`${theme}: .rb-wordmark sizes to its content and paints per the theme's own gradient ration`, () => {
    const css = cssOf(join(ROOT, theme, "components", "wordmark.css"));
    const block = wordmarkBlock(css);
    assert.ok(block, `${theme}/components/wordmark.css has no .rb-wordmark rule`);

    const decl = declarations(block);
    assert.equal(
      decl.width,
      "fit-content",
      `${theme}: .rb-wordmark must not stretch to a flex/grid ancestor's cross axis`,
    );

    if (GRADIENT_THEMES.includes(theme)) {
      assert.equal(
        decl["background-image"],
        "var(--rb-accent-grad)",
        `${theme}: rations the gradient to the wordmark -- must clip it into the text`,
      );
    } else {
      assert.equal(
        decl.color,
        "var(--rb-text)",
        `${theme}: does not ration the gradient to the wordmark -- must paint solid --rb-text`,
      );
      assert.equal(
        decl["background-image"],
        undefined,
        `${theme}: must not spend --rb-accent-grad outside the four rationed themes`,
      );
    }
  });
}

test("wordmarkBlock: matches the base rule, not the __spark rule or a comment, regardless of source order", () => {
  const css = `
    /* .x.rb-wordmark { color: red; } */
    .x.rb-wordmark__spark { color: var(--rb-accent); }
    .x.rb-wordmark { width: fit-content; color: var(--rb-text); }
  `;
  assert.equal(wordmarkBlock(css)?.trim(), "width: fit-content; color: var(--rb-text);");
  assert.equal(wordmarkBlock(".x.rb-wordmark__spark { color: var(--rb-accent); }"), null);
});
