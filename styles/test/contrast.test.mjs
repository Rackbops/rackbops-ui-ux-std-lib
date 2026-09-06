// WCAG contrast for the fixed token pairs, computed from each theme's
// tokens.css -- no browser (STANDARD.md 9, issue #49). Section 9 sets the
// targets (4.5:1 for text/control labels, 3:1 for large text and non-text,
// 4.5:1 for --rb-accent-fg on --rb-accent) and requires every design.md to
// document any below-target pair. Asking authors to compute ratios by hand is
// how eleven of twelve design.md ended up without an ## Accessibility section,
// and a stated ratio can be wrong with nothing to catch it -- so compute them.
//
// The pair list, thresholds, and the documented-deviation allowlist live in
// contract.json's `contrast` block (STANDARD.md 10, "the contract is data"),
// alongside the token/class contract; this file reads them. A failing pair is
// either fixed in the tokens or entered in that allowlist with the design.md
// line that documents it -- an allowlisted pair that now passes fails here as
// a stale entry, the same staleness guard the ariaPairs/dialog-blur checks use.
//
// The comment-stripping and --rb-* extraction mirror contract.test.mjs (kept
// local rather than imported -- importing a *.test.mjs would re-register its
// tests).
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const contract = JSON.parse(readFileSync(join(ROOT, "contract.json"), "utf-8"));
const themeDirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "test" && e.name !== "node_modules" && !e.name.startsWith("_"))
  .map((e) => e.name);

/** Strip CSS block comments so an inline `/* ... *​/` after a token value (or a
 * commented-out token) is not mistaken for part of the value. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The `--rb-*: <value>` declarations in a tokens.css, last write wins. */
function readTokens(theme) {
  const css = stripComments(readFileSync(join(ROOT, theme, "tokens.css"), "utf-8"));
  const map = {};
  for (const m of css.matchAll(/(--rb-[\w-]+)\s*:\s*([^;]+);/g)) map[m[1]] = m[2].trim();
  return map;
}

/** Parse a CSS colour literal to {r,g,b,a} (0-255, a in 0..1), or null for a
 * non-literal (var()/color-mix()/…) this arithmetic can't resolve. Supports
 * #rgb, #rrggbb, rgb()/rgba() with comma-, space-, or slash-separated 0-255
 * channels; percentage channels are intentionally unsupported (no token uses
 * them). */
function parseColor(str) {
  str = str.trim();
  let m;
  if ((m = str.match(/^#([0-9a-fA-F]{3})$/))) {
    const [r, g, b] = m[1].split("").map((c) => parseInt(c + c, 16));
    return { r, g, b, a: 1 };
  }
  if ((m = str.match(/^#([0-9a-fA-F]{6})$/))) {
    const n = m[1];
    return { r: parseInt(n.slice(0, 2), 16), g: parseInt(n.slice(2, 4), 16), b: parseInt(n.slice(4, 6), 16), a: 1 };
  }
  if ((m = str.match(/^rgba?\(([^)]+)\)$/i))) {
    const parts = m[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length < 3 || parts.some((p) => /%$/.test(p))) return null;
    const [r, g, b] = parts.slice(0, 3).map(Number);
    const a = parts[3] !== undefined ? Number(parts[3]) : 1;
    if ([r, g, b, a].some((v) => Number.isNaN(v))) return null;
    return { r, g, b, a };
  }
  return null;
}

/** Composite a (possibly translucent) foreground over an opaque background --
 * a token pair's background is always an opaque surface. Opaque fg is a no-op. */
function composite(fg, bg) {
  if (fg.a >= 1) return fg;
  return {
    r: fg.r * fg.a + bg.r * (1 - fg.a),
    g: fg.g * fg.a + bg.g * (1 - fg.a),
    b: fg.b * fg.a + bg.b * (1 - fg.a),
    a: 1,
  };
}

/** WCAG 2.x relative luminance of an sRGB colour. */
function relLuminance({ r, g, b }) {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** WCAG 2.x contrast ratio (1..21) between two colours. */
function contrastRatio(fg, bg) {
  const l1 = relLuminance(fg);
  const l2 = relLuminance(bg);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// -- The math itself, guarded on known values (not only via the live themes) --
test("contrast math: reference ratios (greys pin the formula, primaries pin the coefficients)", () => {
  const white = parseColor("#ffffff");
  const black = parseColor("#000000");
  assert.ok(Math.abs(contrastRatio(black, white) - 21) < 1e-9, "black on white is 21:1");
  assert.equal(contrastRatio(white, white).toFixed(2), "1.00", "white on white is 1:1");
  const r = contrastRatio(parseColor("#767676"), white);
  assert.ok(r >= 4.5 && r < 4.6, `#767676 on white is ~4.54 (AA boundary), got ${r.toFixed(2)}`);
  // Neutral greys are invariant to the coefficient split, so add the saturated
  // sRGB primaries on white (standard ratios) to pin 0.2126/0.7152/0.0722
  // individually -- a swapped or equalised coefficient turns these red.
  assert.ok(Math.abs(contrastRatio(parseColor("#ff0000"), white) - 4.0) < 0.01, "red on white is ~4.00");
  assert.ok(Math.abs(contrastRatio(parseColor("#00ff00"), white) - 1.372) < 0.01, "green on white is ~1.372");
  assert.ok(Math.abs(contrastRatio(parseColor("#0000ff"), white) - 8.592) < 0.01, "blue on white is ~8.59");
});

test("rgba compositing: 50% black over white composites to mid-grey", () => {
  const white = parseColor("#ffffff");
  const c = composite(parseColor("rgba(0, 0, 0, 0.5)"), white);
  assert.ok(
    Math.abs(c.r - 127.5) < 1e-9 && Math.abs(c.g - 127.5) < 1e-9 && Math.abs(c.b - 127.5) < 1e-9,
    `50% black over white is ~127.5 per channel, got ${c.r}`,
  );
  const r = contrastRatio(c, white);
  assert.ok(r > 1 && r < 21, `composited grey has a finite contrast on white, got ${r.toFixed(2)}`);
});

for (const theme of themeDirs) {
  test(`${theme}: fixed token pairs meet their contrast targets (STANDARD.md 9, #49)`, (t) => {
    const tok = readTokens(theme);
    for (const pair of contract.contrast.pairs) {
      const fgRaw = tok[`--rb-${pair.fg}`];
      const bgRaw = tok[`--rb-${pair.bg}`];
      assert.ok(fgRaw && bgRaw, `${theme}: missing --rb-${pair.fg} or --rb-${pair.bg}`);
      const fg = parseColor(fgRaw);
      const bg = parseColor(bgRaw);
      assert.ok(
        fg && bg,
        `${theme}: ${pair.fg}/${pair.bg} is not a parseable colour literal (${fgRaw} / ${bgRaw})`,
      );
      const ratio = contrastRatio(composite(fg, bg), bg);
      const label = `${pair.fg} on ${pair.bg}`;
      const allowed = contract.contrast.allowlist.find(
        (a) => a.theme === theme && a.fg === pair.fg && a.bg === pair.bg,
      );
      if (allowed) {
        // Staleness guard: an allowlisted pair that now clears its target means
        // the deviation is gone -- drop the entry (and the design.md note).
        assert.ok(
          ratio < pair.min,
          `${theme}: ${label} = ${ratio.toFixed(2)} now clears ${pair.min}:1 -- remove the stale contrast allowlist entry ("${allowed.reason}")`,
        );
        t.diagnostic(`${theme}: ${label} = ${ratio.toFixed(2)} (allowlisted below ${pair.min}:1, ${allowed.doc})`);
        continue;
      }
      assert.ok(
        ratio >= pair.min,
        `${theme}: ${label} = ${ratio.toFixed(2)} is below the ${pair.min}:1 target -- fix the tokens, or allowlist it in contract.json's contrast block with the design.md line that documents it`,
      );
      if (pair.warnBelow && ratio < pair.warnBelow) {
        // Non-essential text (faint meta/labels) MAY sit below AA -- warn, do
        // not fail; the theme's design.md documents it (STANDARD.md 9, 4.4).
        t.diagnostic(
          `${theme}: ${label} = ${ratio.toFixed(2)} is below AA ${pair.warnBelow}:1 -- allowed for non-essential ${pair.fg}, must not carry essential text`,
        );
      }
    }
  });
}
