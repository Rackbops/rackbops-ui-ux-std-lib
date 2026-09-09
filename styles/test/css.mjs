// Shared CSS-reading/parsing helpers for the styles test suite and for
// scripts/new-theme.mjs -- one canonical implementation of each, so a parsing
// bug fixed here fixes every consumer at once, instead of six near-identical
// copies drifting apart (issue #93). Not a *.test.mjs itself: importing it
// registers no tests.
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

/** Every theme directory id, manifest-driven -- the roster the package and
 * its consumers agree on, never a filesystem scan (which would need its own
 * exclusion list for `test/`/`node_modules/`/`_shared/`, and could silently
 * miss or include a theme mid-scaffold). Mirrors scripts/bundle-css.mjs's
 * themeIds(), kept as an independent one-liner rather than an import so this
 * module -- pulled into every test file in this suite -- never drags in
 * lightningcss's native binding. */
export const themeDirs = Object.keys(
  JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf-8")).themes,
);

/** The component CSS filenames (not full paths) in one theme's components/. */
export function componentFiles(theme) {
  return readdirSync(join(ROOT, theme, "components")).filter((f) => f.endsWith(".css"));
}

/** Strip CSS block comments so a commented-out declaration, selector, or
 * token is never mistaken for a live one. */
export function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every @keyframes name declared in a CSS string, in declaration order
 * (duplicates included, matching source order -- callers that want a unique
 * set dedupe themselves, e.g. via `new Set(...)`). Comments are stripped
 * first so a name mentioned only in a comment is never picked up. */
export function extractKeyframeNames(css) {
  const names = [];
  const re = /@keyframes\s+([\w-]+)/g;
  let m;
  while ((m = re.exec(stripComments(css)))) names.push(m[1]);
  return names;
}

/** Split a selector list on top-level commas (commas inside () and [] don't
 * count) -- used by parseCss to separate a rule's comma-joined selectors, and
 * exported since contract.test.mjs also needs it standalone (to check an
 * enclosing selector's individual compounds one at a time, not just as part
 * of a full parseCss() pass). */
export function splitSelectors(prelude) {
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

/**
 * Selectors (flat), rule groups (selectors grouped by the rule they came
 * from -- needed to check that two selectors are paired in the same rule,
 * not merely co-occurring somewhere in the file), keyframe names, and
 * top-level @imports of one CSS file.
 */
export function parseCss(css) {
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

const cssCache = new Map();

/** The raw text of a file, read once and cached for the lifetime of this
 * module instance. `node --test`'s default per-file process isolation means
 * this dedupes reads WITHIN one test file's many per-theme test() blocks --
 * exactly where the redundancy was (27 separate readFileSync sites in
 * contract.test.mjs alone, each theme's tokens.css/base.css/component files
 * re-read by every test that touched them). Callers that need comment-
 * stripped text call stripComments(cssOf(path)) themselves -- caching the
 * stripped text too would either duplicate the strip pass per cache entry or
 * force every caller onto one cache key shape; stripping is cheap enough
 * that caching only the read is where the real cost was. */
export function cssOf(path) {
  let text = cssCache.get(path);
  if (text === undefined) {
    text = readFileSync(path, "utf-8");
    cssCache.set(path, text);
  }
  return text;
}
