// A light/dark pair MUST ship an identical component set (STANDARD.md 5.2):
// the two components/ directories are byte-identical after normalising the
// theme-specific guard string and keyframe names, or the differing file is
// documented as a deliberate divergence in both design.md's -- as an exact
// backticked `components/<file>` reference, not a bare filename mention or a
// line-numbered citation like `components/table.css:9-15`. Kept separate from
// contract.test.mjs because
// this compares across two themes rather than checking one theme in
// isolation.
//
// Component CSS is token-driven (STANDARD.md 4.2 — the few permitted literals
// are allowlisted; rackbops' rack.css is a documented pair divergence, and
// summer-cloud is unpaired so its literal files never enter this comparison),
// so a pair's component files really can be identical modulo the theme name:
// the palette lives in tokens.css, not components/*.css. The one thing that
// legitimately differs beyond the guard is a keyframe name, which embeds a
// theme-specific word for global uniqueness (e.g.
// arcane-obsidian/components/progress.css's "rb-obsidian-spin" vs
// arcane-parchment's "rb-parchment-spin") rather than the full theme id, so
// it needs its own normalisation pass.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

const PAIRS = [
  ["arcane-obsidian", "arcane-parchment"],
  ["rackbops-studio", "rackbops-noir"],
  ["concrete-signal", "concrete-signal-light"],
  ["amber-hearth", "amber-ember"],
];

function componentFiles(theme) {
  return readdirSync(join(ROOT, theme, "components")).filter((f) => f.endsWith(".css"));
}

function extractKeyframeNames(css) {
  const names = [];
  const re = /@keyframes\s+([\w-]+)/g;
  let m;
  while ((m = re.exec(css))) names.push(m[1]);
  return names;
}

/**
 * Normalise a theme's component CSS so two pair members can be compared:
 * replace every bare occurrence of the theme's own id (the guard attribute's
 * value, but also header-comment mentions like "/* arcane-obsidian — alert",
 * `styles/arcane-obsidian/components/alert.css:1`), then positionally
 * replace each keyframe name (in declaration order) with a placeholder
 * everywhere it appears (the @keyframes line itself and any
 * animation/animation-name reference) — keyframe names embed a shorter
 * theme-specific word, not the full theme id (`rb-obsidian-spin`, not
 * `rb-arcane-obsidian-spin`), so this is a separate pass from the id replace.
 */
function normalize(css, theme) {
  // Comments are editorial prose (voice, rationale) and free to differ
  // between pair members — they have no effect on the styled output, so
  // they're stripped before comparing, the same way parseCss() elsewhere in
  // this package treats them as noise. Stripping a multi-line comment removes
  // its internal newlines too, which shifts every subsequent line relative to
  // a pair member whose comment there is a different height (or absent) —
  // whitespace is collapsed afterward so that shift can never register as a
  // content difference; only real token/selector/declaration text can.
  let out = css.replace(/\/\*[\s\S]*?\*\//g, "").split(theme).join("THEME");
  for (const [i, name] of extractKeyframeNames(css).entries()) {
    out = out.split(name).join(`__KF${i}__`);
  }
  return out.replace(/\s+/g, " ").trim();
}

/** A short window of context around the first point two normalised strings diverge. */
function firstDiffContext(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const window = 40;
  return {
    a: a.slice(Math.max(0, i - window), i + window),
    b: b.slice(Math.max(0, i - window), i + window),
  };
}

/**
 * A pair member documents a component as a deliberate divergence when its
 * design.md carries the exact backticked `components/<file>` reference -- the
 * bare form the four real divergence notes use (arcane `components/button.css`,
 * rackbops `components/rack.css`, concrete `components/form.css`, amber
 * `components/dialog.css`). A line-numbered citation such as
 * `components/table.css:9-15` (the backtick closes after the range) does NOT
 * count, and neither does a bare-filename substring -- the old
 * `design.includes(file)` was true for `dialog.css`.includes(`log.css`) and
 * for any `components/<file>:lines` citation, silently exempting parity for
 * two files that don't actually diverge.
 */
function documentsDivergence(designMd, file) {
  return designMd.includes(`\`components/${file}\``);
}

for (const [themeA, themeB] of PAIRS) {
  test(`${themeA} / ${themeB}: identical component set (or divergence documented in both design.md's)`, () => {
    const filesA = new Set(componentFiles(themeA));
    const filesB = new Set(componentFiles(themeB));
    const allFiles = new Set([...filesA, ...filesB]);

    const designA = readFileSync(join(ROOT, themeA, "design.md"), "utf-8");
    const designB = readFileSync(join(ROOT, themeB, "design.md"), "utf-8");

    for (const file of allFiles) {
      const inA = filesA.has(file);
      const inB = filesB.has(file);

      if (!inA || !inB) {
        const documented =
          documentsDivergence(designA, file) && documentsDivergence(designB, file);
        assert.ok(
          documented,
          `${themeA}/${themeB}: components/${file} exists in only one theme and isn't named in both design.md's`
        );
        continue;
      }

      const rawA = readFileSync(join(ROOT, themeA, "components", file), "utf-8");
      const rawB = readFileSync(join(ROOT, themeB, "components", file), "utf-8");
      const normA = normalize(rawA, themeA);
      const normB = normalize(rawB, themeB);

      if (normA !== normB) {
        const documented =
          documentsDivergence(designA, file) && documentsDivergence(designB, file);
        if (documented) continue;
        const { a: ctxA, b: ctxB } = firstDiffContext(normA, normB);
        assert.fail(
          `${themeA}/${themeB}: components/${file} diverges beyond the guard/keyframe names/comments, ` +
            `and isn't documented as a deliberate divergence in both design.md's.\n` +
            `  ${themeA}: ...${ctxA}...\n  ${themeB}: ...${ctxB}...`
        );
      }
    }
  });
}

test("documentsDivergence: exact backticked components/<file> token, not a substring or citation (#92)", () => {
  // The bare backticked path is the form the four real divergence notes use;
  // a possessive suffix after the closing backtick still counts.
  assert.ok(documentsDivergence("the AA hover formula in `components/button.css` here", "button.css"));
  assert.ok(documentsDivergence("`components/form.css`'s select-arrow data-URI", "form.css"));
  // A line-numbered citation does NOT (the backtick closes after the range).
  assert.ok(!documentsDivergence("see `components/table.css:9-15` for the table", "table.css"));
  // A different file whose name is a substring does NOT (the `dialog.css` ⊃
  // `log.css` bug the old designA.includes(file) fell for).
  assert.ok(!documentsDivergence("the `components/dialog.css` scrim is literal", "log.css"));
  // No reference at all.
  assert.ok(!documentsDivergence("no mention of it anywhere", "table.css"));
});
