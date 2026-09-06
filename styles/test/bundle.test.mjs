// Per-theme flattened bundle.css (issue #52). The bundles are generated at
// prepack and never committed, so this regenerates them in-memory and checks
// each is a faithful, self-contained flatten of the theme's index.css.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flatten, themeIds, canonicalize } from "../../scripts/bundle-css.mjs";

const STYLES = resolve(fileURLToPath(import.meta.url), "../..");
const pkg = JSON.parse(readFileSync(join(STYLES, "package.json"), "utf-8"));

/** Ordered rule-selector list: strip comments, walk braces, take each non-@
 * rule's prelude split on top-level commas (skip @-rule preludes and @keyframes
 * steps), whitespace-normalised. */
function selectors(css) {
  const s = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let depth = 0;
  let buf = "";
  const atStack = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "{") {
      const prelude = buf.trim();
      buf = "";
      if (prelude.startsWith("@")) {
        atStack.push(prelude.split(/\s/)[0]);
        depth++;
        continue;
      }
      if (atStack[atStack.length - 1] !== "@keyframes") {
        for (const sel of prelude.split(",")) out.push(sel.replace(/\s+/g, " ").trim());
      }
      depth++;
    } else if (c === "}") {
      depth--;
      buf = "";
      if (atStack.length && depth < atStack.length) atStack.pop();
    } else if (c === ";" && depth === atStack.length) {
      buf = "";
    } else {
      buf += c;
    }
  }
  return out.filter(Boolean);
}

/** The files an entry point @imports (one level), concatenated in import order.
 * lightningcss canonicalises the result the same way it canonicalises the
 * bundle, so comparing their selector lists is version-independent. */
function resolveConcat(dir, entry) {
  const css = readFileSync(join(dir, entry), "utf-8");
  return [...css.matchAll(/@import\s+"([^"]+)"/g)]
    .map((m) => readFileSync(join(dir, m[1]), "utf-8"))
    .join("\n");
}
const canonicalSelectors = (code) => selectors(canonicalize(code));

for (const id of themeIds()) {
  test(`${id}: bundle.css is a self-contained flatten of index.css (#52)`, () => {
    const bundled = flatten(join(STYLES, id, "index.css"));
    assert.equal((bundled.match(/@import/g) || []).length, 0, `${id}: bundle still contains @import`);
    assert.ok(bundled.includes(`[data-rb-style="${id}"]`), `${id}: bundle lost the theme guard`);
    // Same rule set, same order, as index.css fully resolved.
    assert.deepEqual(selectors(bundled), canonicalSelectors(resolveConcat(join(STYLES, id), "index.css")));
  });

  test(`${id}: package.json declares a ./${id}/bundle export (#52)`, () => {
    const exp = pkg.exports[`./${id}/bundle`];
    assert.ok(exp, `${id}: missing "./${id}/bundle" export`);
    assert.equal(exp.default, `./${id}/bundle.css`);
  });
}

test("all.bundle.css flattens every theme, self-contained (#52)", () => {
  const bundled = flatten(join(STYLES, "all.css"));
  assert.equal((bundled.match(/@import/g) || []).length, 0, "all.bundle still contains @import");
  for (const id of themeIds()) {
    assert.ok(bundled.includes(`[data-rb-style="${id}"]`), `all.bundle missing ${id}`);
  }
  // all.css @imports each theme's index.css, so all.bundle's rule SET is the
  // union of every per-theme flatten -- compared as a set, not an ordered list,
  // because the bundler includes the shared _shared/structure.css once (deduped)
  // where the per-theme flattens each carry their own copy (issue #52).
  const bundledSet = [...new Set(selectors(bundled))].sort();
  const unionSet = [...new Set(themeIds().flatMap((id) => selectors(flatten(join(STYLES, id, "index.css")))))].sort();
  assert.deepEqual(bundledSet, unionSet);
});

test("package.json declares the ./all-bundle export (#52)", () => {
  const exp = pkg.exports["./all-bundle"];
  assert.ok(exp, 'missing "./all-bundle" export');
  assert.equal(exp.default, "./all.bundle.css");
});

test("npm pack ships every bundle -- the prepack actually generates them (#52)", () => {
  // The tests above regenerate bundles in-memory via flatten(), so they stay
  // green even if the `bundle-css` prepack step is deleted or all.bundle.css is
  // dropped from `files` -- a clean-checkout publish would then ship zero
  // bundles and every ./bundle export + CDN URL would 404. Pack for real and
  // assert the artefacts are in the tarball, mirroring the LICENSE/NOTICE guard
  // in scripts/copy-license.test.mjs.
  // Delete any stale on-disk bundles first so the pack must REGENERATE them via
  // prepack -- otherwise leftover artefacts from a prior run would mask a broken
  // prepack (CI checks out clean; this makes the guard hold locally too).
  for (const id of themeIds()) rmSync(join(STYLES, id, "bundle.css"), { force: true });
  rmSync(join(STYLES, "all.bundle.css"), { force: true });
  const stdout = execSync("npm pack --dry-run --json", { cwd: STYLES, encoding: "utf-8" });
  const paths = new Set(JSON.parse(stdout)[0].files.map((f) => f.path));
  for (const id of themeIds()) {
    assert.ok(paths.has(`${id}/bundle.css`), `npm pack misses ${id}/bundle.css (prepack wired? files ok?)`);
  }
  assert.ok(paths.has("all.bundle.css"), "npm pack misses all.bundle.css (missing from files[]?)");
});
