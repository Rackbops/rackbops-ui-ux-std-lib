// The theme contract, enforced. Every theme must be:
//  - scoped: no rule applies without a data-rb-style="<theme>" opt-in,
//  - collision-free: keyframe names unique across themes,
//  - complete: the shared baseline token set and component/class set fully
//    declared, and nothing undocumented added,
//  - registered: manifest.json, package.json files/exports, and the theme
//    directories all agree.
// A new theme that passes this suite works in every consumer that reads the
// manifest — that is the whole point of the contract.
//
// styles/contract.json is the single source of truth for the token list, the
// required component/class set, the documented-omission allowlist, each
// theme's extra classes, and the ARIA-pairing / dialog-blur parity checks
// (STANDARD.md 4.4). This file reads it rather than hard-coding any of that.
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
const contract = JSON.parse(readFileSync(join(ROOT, "contract.json"), "utf-8"));
const themeDirs = readdirSync(ROOT, { withFileTypes: true })
  .filter((e) => e.isDirectory() && e.name !== "test" && e.name !== "node_modules")
  .map((e) => e.name);

// Baseline token set every theme must declare, from contract.json. Additions
// there are a contract change: bump contract.json's (and manifest.json's)
// "contract" integer and update consumers.
const REQUIRED_TOKENS = contract.tokens.map((n) => `--rb-${n}`);

// Every required class across every shared component, flattened to
// {component, file, class} — parallel to REQUIRED_TOKENS, sourced from
// contract.json's `components` map instead of a hand-written list.
const REQUIRED_CLASSES = Object.entries(contract.components).flatMap(([name, def]) =>
  def.classes.map((cls) => ({ file: `${name}.css`, class: cls }))
);

// The union of every required class name, used by the closed-world
// "no undocumented class" check below.
const ALL_REQUIRED_CLASS_NAMES = new Set(REQUIRED_CLASSES.map((c) => c.class));

// Documented omissions (STANDARD.md 5.3): a theme, a required class it
// deliberately doesn't style, and why. Sourced from contract.json.
const CLASS_ALLOWLIST = contract.allowlist;

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

/** Strip CSS block comments so a commented-out declaration or selector is not
 * mistaken for a live one. */
function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** The --rb-* custom properties actually declared (as `--rb-x:`) in a
 * tokens.css, comments stripped so a commented-out token is not counted as
 * present -- otherwise a dropped baseline token could ship green. */
function declaredTokens(css) {
  return new Set(stripComments(css).match(/--rb-[\w-]+(?=\s*:)/g));
}

/** The color-scheme (dark|light) a tokens.css declares, comments stripped so a
 * commented-out color-scheme is not read as the theme's scheme -- otherwise a
 * theme could be mis-reported against the manifest. */
function declaredScheme(css) {
  return stripComments(css).match(/color-scheme:\s*(dark|light)/)?.[1];
}

/**
 * Selectors (flat), rule groups (selectors grouped by the rule they came
 * from — needed to check that two selectors are paired in the same rule,
 * not merely co-occurring somewhere in the file), keyframe names, and
 * top-level @imports of one CSS file.
 */
function parseCss(css) {
  css = stripComments(css);
  const selectors = [];
  const ruleGroups = [];
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
        const group = splitSelectors(prelude);
        selectors.push(...group);
        ruleGroups.push(group);
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
  return { selectors, ruleGroups, keyframes, imports };
}

/** The declaration body of the first rule whose selector list contains
 * `selectorSubstr`, or null. `css` must be comment-stripped; these simple
 * `:disabled` blocks never nest braces, so an innermost-brace scan is enough. */
function ruleBodyFor(css, selectorSubstr) {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (m[1].includes(selectorSubstr)) return m[2];
  }
  return null;
}

function themeCssFiles(theme) {
  const dir = join(ROOT, theme);
  const files = ["tokens.css", "base.css"];
  for (const f of readdirSync(join(dir, "components"))) {
    if (f.endsWith(".css")) files.push(join("components", f));
  }
  return files.map((f) => join(dir, f));
}

/** Escape a literal string for embedding in a RegExp. */
function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -- Component-selector nesting (STANDARD.md 4.1, issue #94) -----------------
// Base component rules are one class deep. A rule MAY reach deeper only to
// style a semantic child element the markup can't class (`.rb-table td`), or a
// child from its parent's state/variant (`.rb-stepper--complete
// .rb-stepper__node`). The forbidden shape is chaining a block to ITS OWN
// element class with no state marker (`.rb-card .rb-card__title`), where the
// element class alone would do. Cross-block scoping (`.rb-table .rb-num`) is
// allowed.
const NEST_UTILITY_CLASSES = new Set(["rb-num"]);

/** Strip the leading zero-specificity `:where(...)` guard from a selector. */
function stripGuard(sel) {
  const m = sel.match(/^:where\([^)]*\)/);
  return m ? sel.slice(m[0].length) : sel;
}

/** Split a selector into combinator-joined compounds (top level only -- commas
 * and combinators inside () and [] don't split). */
function splitCompounds(sel) {
  const compounds = [];
  let depth = 0;
  let buf = "";
  for (const ch of sel) {
    if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    if (depth === 0 && (ch === " " || ch === ">" || ch === "+" || ch === "~")) {
      if (buf.trim()) compounds.push(buf.trim());
      buf = "";
    } else buf += ch;
  }
  if (buf.trim()) compounds.push(buf.trim());
  return compounds;
}

/** The `rb-*` classes in a compound, each with its BEM block (before __ or --). */
function rbClasses(compound) {
  return [...compound.matchAll(/\.(rb-[\w-]+)/g)].map((m) => ({
    cls: m[1],
    block: m[1].split("__")[0].split("--")[0],
  }));
}

/** A compound carries a state marker: a modifier class, an attribute selector,
 * or a genuine state pseudo-class. The logical pseudos (`:not`/`:is`/`:has`)
 * are deliberately excluded -- they're containers, not state, and a no-op
 * `:not(.x)` must not launder a gratuitous nest past the check (the real
 * state->child selectors all carry a `:hover`/`--mod`/`[aria-*]` besides). */
function hasStateMarker(compound) {
  return (
    /--/.test(compound) ||
    /\[[^\]]+\]/.test(compound) ||
    /:(hover|focus|focus-visible|focus-within|active|checked|disabled|indeterminate|placeholder-shown|target|visited)\b/.test(
      compound
    )
  );
}

/** If `bodySel` (guard already stripped) is a forbidden nest, return the
 * reason; else null. Exported for the synthetic unit test. */
export function forbiddenNest(bodySel) {
  const compounds = splitCompounds(bodySel);
  if (compounds.length <= 1) return null;
  for (let i = 1; i < compounds.length; i++) {
    for (const { cls, block } of rbClasses(compounds[i])) {
      if (NEST_UTILITY_CLASSES.has(cls)) continue;
      let sharedAncestor = false;
      let stateInChain = false;
      for (let j = 0; j < i; j++) {
        if (hasStateMarker(compounds[j])) stateInChain = true;
        if (rbClasses(compounds[j]).some((a) => a.block === block)) sharedAncestor = true;
      }
      if (sharedAncestor && !stateInChain) {
        return `.${cls} is reached from its own block with no state marker -- flatten to .${cls}, or add a --modifier/[aria-*]/state to the ancestor: ${bodySel}`;
      }
    }
  }
  return null;
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
    assertCssExport(`./${theme}/components/*`, `./${theme}/components/*.css`);
  }
  assertCssExport("./all", "./all.css");
  assert.equal(pkg.exports["./manifest"], "./manifest.json");
  assert.equal(pkg.exports["./contract"], "./contract.json");
  assert.ok(pkg.files.includes("all.css") && pkg.files.includes("manifest.json"));
  assert.ok(pkg.files.includes("contract.json"), "package.json files misses contract.json");
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

test("manifest.json's contract integer matches contract.json's", () => {
  assert.equal(
    manifest.contract,
    contract.contract,
    "manifest.json and contract.json have drifted -- bump both together"
  );
});

test("every theme ships every required component file", () => {
  // Today's parity tests open a handful of files (button.css, table.css, ...)
  // by name; anything not in REQUIRED_CLASSES is only ever discovered via
  // readdirSync, so a theme missing a required file entirely used to pass
  // silently. Assert the file list explicitly so the failure names the file.
  for (const theme of themeDirs) {
    for (const name of Object.keys(contract.components)) {
      const file = join(ROOT, theme, "components", `${name}.css`);
      assert.ok(existsSync(file), `${theme}: missing components/${name}.css`);
    }
  }
});

test("all.css imports every theme and nothing else", () => {
  const { imports, selectors } = parseCss(readFileSync(join(ROOT, "all.css"), "utf-8"));
  assert.deepEqual(selectors, []);
  const imported = imports.map((i) => i.match(/"\.\/([^/]+)\/index\.css"/)?.[1]).sort();
  assert.deepEqual(imported, [...themeDirs].sort());
});

test("declaredTokens ignores commented-out tokens (issue #42 overflow)", () => {
  // The per-theme baseline-token check reads the raw tokens.css; without
  // stripping comments a commented-out `/* --rb-x: … */` would count as
  // declared and a dropped baseline token could ship green.
  const css = '/* --rb-commented: red; */\n:where([data-rb-style="x"]) { --rb-live: 1; }';
  const declared = declaredTokens(css);
  assert.ok(!declared.has("--rb-commented"), "a commented-out token must not count as declared");
  assert.ok(declared.has("--rb-live"), "a live token must count as declared");
});

test("declaredScheme ignores a commented-out color-scheme (issue #42 overflow)", () => {
  // Guards declaredScheme() -- the helper the per-theme "color-scheme matches
  // the manifest" check uses -- so reverting its stripComments fails HERE, not
  // silently green because no real theme happens to carry a commented scheme.
  const css = '/* color-scheme: light; */\n:where([data-rb-style="x"]) { color-scheme: dark; }';
  assert.equal(declaredScheme(css), "dark", "the live color-scheme must win over a commented-out one");
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
    const raw = readFileSync(join(ROOT, theme, "tokens.css"), "utf-8");
    const declared = declaredTokens(raw);
    const missing = REQUIRED_TOKENS.filter((t) => !declared.has(t));
    assert.deepEqual(missing, [], `${theme} misses baseline tokens`);
    // Presence only (raw is fine -- a live declaration always satisfies this);
    // the value is validated against the manifest via declaredScheme below.
    assert.match(raw, /color-scheme:\s*(dark|light)\s*;/);
  });

  test(`${theme}: color-scheme matches the manifest`, () => {
    const raw = readFileSync(join(ROOT, theme, "tokens.css"), "utf-8");
    assert.equal(declaredScheme(raw), manifest.themes[theme].scheme);
  });

  test(`${theme}: every .rb-* class in its CSS is either required or listed under extras`, () => {
    // The other direction of class parity: a class REQUIRED_CLASSES doesn't
    // know about and this theme's contract.json extras don't document is
    // either a typo, a forgotten extras entry, or scope creep -- any of
    // which should fail loudly rather than silently ship.
    const allowedExtras = new Set(contract.extras[theme] ?? []);
    const found = new Set();
    for (const file of themeCssFiles(theme)) {
      const { selectors } = parseCss(readFileSync(file, "utf-8"));
      for (const sel of selectors) {
        for (const m of sel.match(/\.rb-[\w-]+/g) ?? []) {
          found.add(m.slice(1));
        }
      }
    }
    const undocumented = [...found]
      .filter((cls) => !ALL_REQUIRED_CLASS_NAMES.has(cls) && !allowedExtras.has(cls))
      .sort();
    assert.deepEqual(
      undocumented,
      [],
      `${theme}: class(es) not in any contract.json component or this theme's extras: ${undocumented.join(", ")}`
    );
  });

  test(`${theme}: button-backed hover rules scope out :disabled, and every disableable class dims (issues #37, #85)`, () => {
    // Generalizes #37 beyond .rb-btn to every <button>-backed class. A disabled
    // element still matches :hover in real browsers (confirmed via the
    // showcase), so every hover selector touching one of these classes must
    // scope itself :not(:disabled) or a disabled tab/chip/button keeps reacting
    // to the pointer; and every such base class must carry a disabled dim
    // (opacity + cursor: not-allowed) per STANDARD.md 7. :focus-visible/:active
    // need no scoping -- disabled elements can't be focused or activated.
    const BACKED = /\.rb-(btn|icon-btn|tab|tabstrip__tab|chip)\b/;
    // Base classes that must define their OWN :disabled dim. .rb-icon-btn and
    // the --variants compose with .rb-btn and inherit its dim, so they don't.
    const DIM_BASES = ["rb-btn", "rb-tab", "rb-tabstrip__tab", "rb-chip"];
    let sawHover = false;
    for (const file of themeCssFiles(theme)) {
      const src = readFileSync(file, "utf-8");
      const stripped = stripComments(src);
      const { selectors } = parseCss(src);
      // (a) Hover scoping.
      for (const sel of selectors) {
        if (/:hover\b/.test(sel) && BACKED.test(sel)) {
          sawHover = true;
          assert.ok(
            sel.includes(":not(:disabled)"),
            `${file}: button-backed hover selector must scope out :disabled: ${sel}`
          );
        }
      }
      // (b) Disabled dim -- required in any file where a base class has a hover
      // rule (i.e. the file that styles that interactive class).
      for (const base of DIM_BASES) {
        const baseRe = new RegExp(`\\.${base}\\b`);
        const hasHover = selectors.some((s) => /:hover\b/.test(s) && baseRe.test(s));
        if (!hasHover) continue;
        const disSel = `.${base}:disabled`;
        assert.ok(
          selectors.some((s) => s.includes(disSel)),
          `${file}: missing ${disSel} dim rule (STANDARD.md 7 Disabled)`
        );
        const body = ruleBodyFor(stripped, disSel);
        assert.ok(body && /\bopacity\s*:/.test(body), `${file}: ${disSel} must set opacity`);
        assert.ok(
          body && /\bcursor\s*:\s*not-allowed\b/.test(body),
          `${file}: ${disSel} must set cursor: not-allowed`
        );
      }
    }
    assert.ok(sawHover, `${theme}: expected at least one button-backed hover selector`);
  });
}

for (const { file, class: cls } of REQUIRED_CLASSES) {
  test(`every theme's ${file} declares a guarded .${cls} rule (or is allowlisted)`, () => {
    // Class parity: every theme must style every class the shared component
    // set requires (contract.json), so a screen keeps its affordances when
    // it swaps data-rb-style -- unless that theme has a documented reason
    // not to (CLASS_ALLOWLIST, STANDARD.md 5.3).
    const escaped = reEscape(cls);
    const re = new RegExp(`\\.${escaped}(?![\\w-])`);
    for (const theme of themeDirs) {
      const allowed = CLASS_ALLOWLIST.find((a) => a.theme === theme && a.class === cls);
      const guard = `[data-rb-style="${theme}"]`;
      const cssFile = join(ROOT, theme, "components", file);
      const { selectors } = parseCss(readFileSync(cssFile, "utf-8"));
      const matches = selectors.filter((s) => re.test(s));
      if (allowed) {
        assert.deepEqual(
          matches,
          [],
          `${theme}: .${cls} is allowlisted as absent but a rule now exists -- update or drop the allowlist entry`
        );
        continue;
      }
      assert.ok(matches.length > 0, `${theme}: ${file} is missing a .${cls} rule`);
      for (const sel of matches) {
        assert.ok(sel.includes(guard), `${theme}: unguarded .${cls} selector: ${sel}`);
      }
    }
  });
}

/**
 * Evaluate an ARIA modifier/attribute pairing over a file's rule groups.
 * `allPaired` — EVERY rule group bearing the modifier class also carries the
 * attribute scoped to the same base element (the positive check; one paired
 * group must not mask an unpaired sibling, issue #92). `anyPaired` — the class
 * is paired in at least one group (the exempt-staleness check). Extracted so
 * the .every()/.some() distinction is unit-testable on synthetic groups, not
 * only via the live themes (whose clean state gives .some and .every the same
 * verdict). `classGroups.length > 0` keeps `.every()` from passing vacuously
 * when the class is absent.
 */
export function evalAriaPairing(ruleGroups, classRe, baseRe, attribute) {
  const classGroups = ruleGroups.filter((g) => g.some((s) => classRe.test(s)));
  const groupPaired = (g) => g.some((s) => s.includes(attribute) && baseRe.test(s));
  return {
    allPaired: classGroups.length > 0 && classGroups.every(groupPaired),
    anyPaired: classGroups.some(groupPaired),
  };
}

test("evalAriaPairing: .every() rejects an unpaired sibling that .some() would mask (#92)", () => {
  const classRe = /\.rb-tab--active(?![\w-])/;
  const baseRe = /\.rb-tab(?![\w-])/;
  const attr = '[aria-selected="true"]';
  // Two groups bear the modifier class: the first paired, the second not.
  const mixed = [
    ['.rb-tab.rb-tab--active', '.rb-tab[aria-selected="true"]'],
    ['.rb-tab.rb-tab--active::after'],
  ];
  const r = evalAriaPairing(mixed, classRe, baseRe, attr);
  assert.equal(r.allPaired, false, ".every() must reject the unpaired ::after sibling");
  assert.equal(r.anyPaired, true, "first group is paired -- the old .some() check would pass here");
  // Fully paired -> passes.
  assert.equal(
    evalAriaPairing([["a.rb-tab--active", 'a.rb-tab[aria-selected="true"]']], classRe, baseRe, attr).allPaired,
    true
  );
  // Class absent -> not vacuously true.
  assert.equal(evalAriaPairing([[".rb-btn:hover"]], classRe, baseRe, attr).allPaired, false);
});

for (const pair of contract.ariaPairs) {
  const file = `${pair.component}.css`;
  const classRe = new RegExp(`\\.${reEscape(pair.class)}(?![\\w-])`);
  const baseRe = new RegExp(`\\.${reEscape(pair.baseSelector)}(?![\\w-])`);

  test(`ARIA pairing: .${pair.class} in ${file} pairs with ${pair.attribute} (or is exempt, see #65)`, () => {
    for (const theme of themeDirs) {
      const exempt = pair.exempt.find((e) => e.theme === theme);
      const cssFile = join(ROOT, theme, "components", file);
      const { ruleGroups } = parseCss(readFileSync(cssFile, "utf-8"));
      // The attribute selector must be scoped to the same base element
      // (.rb-tab, .rb-link, .rb-stepper__step) as the modifier class -- not
      // merely co-occur in the same rule group, which an unrelated selector
      // (e.g. a shared hover/focus rule) could otherwise satisfy.
      const { allPaired, anyPaired } = evalAriaPairing(ruleGroups, classRe, baseRe, pair.attribute);
      if (exempt) {
        // Staleness guard: if the theme pairs the class in ANY group, the
        // exempt entry is stale (anyPaired, not allPaired -- one paired
        // occurrence already makes "deliberately unpaired" untrue).
        assert.ok(
          !anyPaired,
          `${theme}: .${pair.class} is now paired with ${pair.attribute} -- remove the stale exempt entry ("${exempt.reason}")`
        );
        continue;
      }
      // EVERY occurrence of the modifier class must pair with the attribute --
      // one paired rule no longer masks an unpaired sibling (issues #92, #65).
      assert.ok(
        allPaired,
        `${theme}: .${pair.class} in ${file} has an occurrence not paired with a selector containing ${pair.attribute} in the same rule`
      );
    }
  });
}

for (const theme of themeDirs) {
  test(`${theme}: component rules don't nest a block into its own element without a state (STANDARD.md 4.1, #94)`, () => {
    for (const file of themeCssFiles(theme)) {
      // tokens.css/base.css hold canvas + bare-element rules, not component rules.
      if (!/[\\/]components[\\/]/.test(file)) continue;
      const { selectors } = parseCss(readFileSync(file, "utf-8"));
      for (const sel of selectors) {
        const reason = forbiddenNest(stripGuard(sel));
        assert.equal(reason, null, `${file}: ${reason}`);
      }
    }
  });
}

test("forbiddenNest: flags a block reaching its own element without a state, permits the legitimate patterns (#94)", () => {
  // Banned: a block chained to its own element class, no state marker -- the
  // element class alone would do, and the chain just raises specificity.
  assert.ok(forbiddenNest(".rb-card .rb-card__title"), "redundant same-block nest must flag");
  assert.ok(forbiddenNest(".rb-card__head .rb-card__title"), "element->same-block element must flag");
  assert.ok(
    forbiddenNest(".rb-card:not(.x) .rb-card__title"),
    "a no-op :not() on the ancestor must not launder a same-block nest"
  );
  // Permitted: state/variant -> child (the parent's state drives the child).
  assert.equal(forbiddenNest(".rb-stepper--complete .rb-stepper__node"), null);
  assert.equal(forbiddenNest('.rb-stepper__step[aria-current="step"] .rb-stepper__node'), null);
  assert.equal(forbiddenNest(".rb-btn:not(:disabled):hover .rb-btn__arrow"), null);
  // Permitted: class -> semantic element, cross-block scoping, and the rb-num utility.
  assert.equal(forbiddenNest(".rb-table td"), null);
  assert.equal(forbiddenNest(".rb-table .rb-num"), null);
  assert.equal(forbiddenNest(".rb-rack__bars > i:nth-child(1)"), null);
  // A single compound (a base rule, even with a modifier/attribute) is not a nest.
  assert.equal(forbiddenNest(".rb-tab.rb-tab--active"), null);
});

// -- Literal colours (STANDARD.md 4.2, issue #94) ---------------------------
/** Remove balanced `color-mix(...)` spans so a permitted token / `#fff` / `#000`
 * inside a mix isn't seen by the literal-hex scan below. */
function removeColorMix(css) {
  const lower = css.toLowerCase(); // CSS function names are case-insensitive
  let out = "";
  let i = 0;
  while (i < css.length) {
    const idx = lower.indexOf("color-mix(", i);
    if (idx === -1) {
      out += css.slice(i);
      break;
    }
    out += css.slice(i, idx);
    let depth = 0;
    let j = idx + "color-mix".length;
    for (; j < css.length; j++) {
      if (css[j] === "(") depth++;
      else if (css[j] === ")") {
        depth--;
        if (depth === 0) {
          j++;
          break;
        }
      }
    }
    i = j;
  }
  return out;
}

for (const theme of themeDirs) {
  test(`${theme}: component CSS has no literal hex colour outside color-mix (STANDARD.md 4.2, #94)`, () => {
    const permitted = contract.permittedLiterals ?? {};
    for (const file of themeCssFiles(theme)) {
      if (!/[\\/]components[\\/]/.test(file)) continue;
      const rel = `${theme}/${file.split(/[\\/]/).pop()}`;
      const allowed = new Set((permitted[rel] ?? []).map((h) => h.toLowerCase()));
      const css = removeColorMix(stripComments(readFileSync(file, "utf-8")));
      // Data-URI SVG strokes are %23-encoded and never match this; #fff/#000
      // inside a mix are stripped above.
      for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        assert.ok(
          allowed.has(m[0].toLowerCase()),
          `${file}: literal hex ${m[0]} outside color-mix -- draw it from a token, or (if it's an unavoidable per-theme literal) add it to contract.json permittedLiterals["${rel}"] with a design.md note (STANDARD.md 4.2)`
        );
      }
    }
  });
}

test("hex-literal scan: sees a literal outside color-mix, ignores one inside it (#94)", () => {
  assert.match(removeColorMix(".x { color: #123456; }"), /#123456/);
  const inside = removeColorMix(".x { color: color-mix(in srgb, var(--a) 88%, #fff); }");
  assert.ok(!/#fff/.test(inside), "a #fff inside color-mix must be stripped before the scan");
});

test("dialog backdrop blurs with var(--rb-blur), not a literal (or is exempt, see #65)", () => {
  const token = contract.dialogBackdropBlur.token;
  const tokenRe = new RegExp(`var\\(\\s*${reEscape(token)}\\s*\\)`);
  for (const theme of themeDirs) {
    const exempt = contract.dialogBackdropBlur.exempt.find((e) => e.theme === theme);
    const css = readFileSync(join(ROOT, theme, "components", "dialog.css"), "utf-8");
    const backdropBlock = css.match(/::backdrop\s*\{([^}]*)\}/);
    const usesToken = !!backdropBlock && tokenRe.test(backdropBlock[1]);
    if (exempt?.permanent) continue; // by-design (no backdrop-filter at all), never checked either way
    if (exempt) {
      assert.ok(
        !usesToken,
        `${theme}: dialog backdrop now uses var(${token}) -- remove the stale exempt entry ("${exempt.reason}")`
      );
      continue;
    }
    assert.ok(
      usesToken,
      `${theme}: dialog.css ::backdrop must blur with var(${token}), not a literal`
    );
  }
});

test("every theme's progress.css styles the native <progress> pseudo-elements, not a .rb-progress__bar div", () => {
  // The progress contract is native <progress> (both the React Progress and
  // the showcase render one) styled via ::-webkit-progress-value /
  // ::-moz-progress-bar -- never a div child, which can never appear inside
  // a native <progress> and so silently loses its accent fill under every
  // consumer (issue #28).
  for (const theme of themeDirs) {
    const file = join(ROOT, theme, "components", "progress.css");
    const { selectors } = parseCss(readFileSync(file, "utf-8"));
    const guard = `[data-rb-style="${theme}"]`;
    const barDiv = selectors.filter((s) => /\.rb-progress__bar/.test(s));
    assert.deepEqual(barDiv, [], `${theme}: progress.css still styles a .rb-progress__bar div`);
    const webkitValue = selectors.filter((s) => /\.rb-progress::-webkit-progress-value(?![\w-])/.test(s));
    const mozBar = selectors.filter((s) => /\.rb-progress::-moz-progress-bar(?![\w-])/.test(s));
    assert.ok(webkitValue.length > 0, `${theme}: progress.css is missing a ::-webkit-progress-value rule`);
    assert.ok(mozBar.length > 0, `${theme}: progress.css is missing a ::-moz-progress-bar rule`);
    for (const sel of [...webkitValue, ...mozBar]) {
      assert.ok(sel.includes(guard), `${theme}: unguarded progress fill selector: ${sel}`);
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
