// The theme contract, enforced. Every theme must be:
//  - scoped: no rule applies without a data-rb-style="<theme>" opt-in,
//  - collision-free: keyframe names unique across themes,
//  - complete: the shared baseline token set fully declared,
//  - registered: manifest.json, package.json files/exports, and the theme
//    directories all agree.
// A new theme that passes this suite works in every consumer that reads the
// manifest — that is the whole point of the contract.
//
// Adapted from nazuraki/ui-std-lib for the rackbops (--rb-*) namespace. Two
// deliberate divergences from that source: the baseline token set is the union
// of what a data-dense console and an editorial marketing site both need (no
// glass/glow, no code-* baseline), and fonts are system stacks so a theme may
// carry an empty manifest fonts array.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf-8"));
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf-8"));
const themeDirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "test" && e.name !== "node_modules")
  .map((e) => e.name);

// Baseline token set every theme must declare. Additions here are a contract
// change: bump manifest.json's "contract" and update consumers. Code-syntax
// tokens (--rb-code-*) are an optional per-theme extra, not baseline.
const REQUIRED_TOKENS = [
  "bg", "surface", "surface-2", "surface-sunken",
  "text", "text-soft", "text-faint",
  "border", "border-strong",
  "accent", "accent-fg", "accent-wash", "accent-grad",
  "info", "success", "warning", "danger",
  "font-display", "font-body", "font-mono",
  "font-weight", "font-weight-medium", "font-weight-bold",
  "heading-tracking", "label-tracking", "text-sm",
  "radius", "radius-lg", "radius-pill",
  "shadow-sm", "shadow-lg", "blur", "transition",
  "space-1", "space-2", "space-3", "space-4", "space-5",
].map((n) => `--rb-${n}`);

/** Split a selector list on top-level commas (commas inside () and [] don't count). */
function splitSelectors(prelude) {
  const parts = [];
  let depth = 0;
  let buf = "";
  for (const ch of prelude) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) {
      parts.push(buf.trim());
      buf = "";
    } else buf += ch;
  }
  if (buf.trim()) parts.push(buf.trim());
  return parts;
}

/** Selectors, keyframe names, and top-level @imports of one CSS file. */
function parseCss(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const selectors = [];
  const keyframes = [];
  const imports = [];
  const stack = [];
  let buf = "";
  for (const ch of css) {
    if (ch === "{") {
      const prelude = buf.trim();
      buf = "";
      const top = stack[stack.length - 1];
      if (prelude.startsWith("@keyframes")) {
        keyframes.push(prelude.slice("@keyframes".length).trim());
        stack.push("keyframes");
      } else if (prelude.startsWith("@")) {
        stack.push("at");
      } else if (top === "keyframes") {
        stack.push("kf-step");
      } else {
        selectors.push(...splitSelectors(prelude));
        stack.push("rule");
      }
    } else if (ch === "}") {
      stack.pop();
      buf = "";
    } else if (ch === ";") {
      const stmt = buf.trim();
      buf = "";
      if (stack.length === 0 && stmt.startsWith("@import")) imports.push(stmt);
    } else buf += ch;
  }
  return { selectors, keyframes, imports };
}

function themeCssFiles(theme) {
  const dir = join(ROOT, theme);
  const files = ["tokens.css", "base.css"];
  for (const f of readdirSync(join(dir, "components"))) {
    if (f.endsWith(".css")) files.push(join("components", f));
  }
  return files.map((f) => join(dir, f));
}

// Every CSS-only export resolves "types" to this one shared side-effect stub
// (see css-side-effect.d.ts) -- required so TypeScript's stricter side-effect
// import checking (moduleResolution: "bundler"/"node16",
// noUncheckedSideEffectImports) doesn't force a consumer-side shim.
const TYPES_STUB = "./css-side-effect.d.ts";

/** Assert a CSS-only exports entry has the {types, default} shape and both resolve to real files. */
function assertCssExport(key, expectedDefault) {
  const entry = pkg.exports[key];
  assert.equal(typeof entry, "object", `package.json exports[${key}] should be a {types, default} object`);
  assert.equal(entry.types, TYPES_STUB, `package.json exports[${key}].types`);
  assert.equal(entry.default, expectedDefault, `package.json exports[${key}].default`);
  assert.ok(existsSync(join(ROOT, entry.types)), `${entry.types} does not exist`);
}

test("manifest, package.json, and theme directories agree", () => {
  const manifestThemes = Object.keys(manifest.themes).sort();
  assert.deepEqual([...themeDirs].sort(), manifestThemes);
  for (const theme of manifestThemes) {
    assert.ok(pkg.files.includes(theme), `package.json files misses ${theme}`);
    assertCssExport(`./${theme}`, `./${theme}/index.css`);
    assertCssExport(`./${theme}/tokens`, `./${theme}/tokens.css`);
    assertCssExport(`./${theme}/base`, `./${theme}/base.css`);
    const componentsEntry = pkg.exports[`./${theme}/components/*`];
    assert.equal(componentsEntry?.types, TYPES_STUB, `package.json exports[./${theme}/components/*].types`);
    assert.equal(componentsEntry?.default, `./${theme}/components/*.css`);
  }
  assertCssExport("./all", "./all.css");
  assert.equal(pkg.exports["./manifest"], "./manifest.json");
  assert.ok(pkg.files.includes("all.css") && pkg.files.includes("manifest.json"));
  assert.ok(pkg.files.includes("css-side-effect.d.ts"), "package.json files misses css-side-effect.d.ts");
  assert.ok(existsSync(join(ROOT, TYPES_STUB)));
});

test("manifest entries are well-formed", () => {
  assert.equal(typeof manifest.contract, "number");
  for (const [theme, entry] of Object.entries(manifest.themes)) {
    assert.ok(["dark", "light"].includes(entry.scheme), `${theme}: bad scheme`);
    // System-font themes carry an empty fonts array; any entry present must be
    // an https URL (webfont stylesheet).
    assert.ok(Array.isArray(entry.fonts), `${theme}: fonts must be an array`);
    for (const url of entry.fonts) {
      assert.match(url, /^https:\/\//, `${theme}: ${url}`);
    }
  }
});

test("all.css imports every theme and nothing else", () => {
  const { imports, selectors } = parseCss(readFileSync(join(ROOT, "all.css"), "utf-8"));
  assert.deepEqual(selectors, []);
  const imported = imports.map((i) => i.match(/"\.\/([^/]+)\/index\.css"/)?.[1]).sort();
  assert.deepEqual(imported, [...themeDirs].sort());
});

for (const theme of themeDirs) {
  const guard = `[data-rb-style="${theme}"]`;

  test(`${theme}: every selector is guarded by its own opt-in attribute`, () => {
    for (const file of themeCssFiles(theme)) {
      const { selectors } = parseCss(readFileSync(file, "utf-8"));
      for (const sel of selectors) {
        assert.ok(sel.includes(guard), `${file}: unguarded selector: ${sel}`);
      }
    }
  });

  test(`${theme}: index.css pulls tokens, base, and every component file`, () => {
    const { imports, selectors } = parseCss(
      readFileSync(join(ROOT, theme, "index.css"), "utf-8")
    );
    assert.deepEqual(selectors, []);
    const names = imports.map((i) => i.match(/"\.\/(.+)\.css"/)?.[1]);
    const expected = themeCssFiles(theme).map((f) =>
      f.slice(join(ROOT, theme).length + 1).replace(/\.css$/, "").split("\\").join("/")
    );
    assert.deepEqual([...names].sort(), [...expected].sort());
  });

  test(`${theme}: declares the full baseline token set and a color-scheme`, () => {
    const tokens = readFileSync(join(ROOT, theme, "tokens.css"), "utf-8");
    const declared = new Set(tokens.match(/--rb-[\w-]+(?=\s*:)/g));
    const missing = REQUIRED_TOKENS.filter((t) => !declared.has(t));
    assert.deepEqual(missing, [], `${theme} misses baseline tokens`);
    assert.match(tokens, /color-scheme:\s*(dark|light)\s*;/);
  });

  test(`${theme}: color-scheme matches the manifest`, () => {
    const tokens = readFileSync(join(ROOT, theme, "tokens.css"), "utf-8");
    const scheme = tokens.match(/color-scheme:\s*(dark|light)/)?.[1];
    assert.equal(scheme, manifest.themes[theme].scheme);
  });
}

test("every theme's button.css declares a guarded .rb-btn--sm compact variant", () => {
  // The compact size is part of the button contract: every theme must carry it
  // so a screen keeps its inline/table-row actions when it swaps data-rb-style.
  for (const theme of themeDirs) {
    const file = join(ROOT, theme, "components", "button.css");
    const { selectors } = parseCss(readFileSync(file, "utf-8"));
    const guard = `[data-rb-style="${theme}"]`;
    const sm = selectors.filter((s) => /\.rb-btn--sm(?![\w-])/.test(s));
    assert.ok(sm.length > 0, `${theme}: button.css is missing a .rb-btn--sm rule`);
    for (const sel of sm) {
      assert.ok(sel.includes(guard), `${theme}: unguarded .rb-btn--sm selector: ${sel}`);
    }
  }
});

test("every theme's button.css declares a guarded .rb-icon-btn variant", () => {
  // The icon-only square hit target is part of the button contract: every
  // theme must carry it so a screen keeps its icon-only affordances (close,
  // edit, delete glyphs) when it swaps data-rb-style.
  for (const theme of themeDirs) {
    const file = join(ROOT, theme, "components", "button.css");
    const { selectors } = parseCss(readFileSync(file, "utf-8"));
    const guard = `[data-rb-style="${theme}"]`;
    const iconBtn = selectors.filter((s) => /\.rb-icon-btn(?![\w-])/.test(s));
    assert.ok(iconBtn.length > 0, `${theme}: button.css is missing a .rb-icon-btn rule`);
    for (const sel of iconBtn) {
      assert.ok(sel.includes(guard), `${theme}: unguarded .rb-icon-btn selector: ${sel}`);
    }
  }
});

test("keyframe names are rb-prefixed and unique across all themes", () => {
  const seen = new Map();
  for (const theme of themeDirs) {
    for (const file of themeCssFiles(theme)) {
      for (const name of parseCss(readFileSync(file, "utf-8")).keyframes) {
        assert.match(name, /^rb-/, `${file}: keyframe ${name}`);
        assert.ok(!seen.has(name), `keyframe ${name} in both ${seen.get(name)} and ${file}`);
        seen.set(name, file);
      }
    }
  }
});
