// Flatten each theme's index.css (and all.css) into one self-contained
// bundle.css via lightningcss --bundle. A theme directory is @import-linked
// (index.css -> tokens/base/components, and after #52 -> ../_shared), so it
// can't be copied out or served as a single request; the flattened bundle is
// the artefact for no-build, CDN, and vendored use (STANDARD.md 2.5, issue #52).
//
//   node scripts/bundle-css.mjs   # write every <theme>/bundle.css + all.bundle.css
//
// Wired into `styles` prepack so the bundles ship in the published package.
// They are generated artefacts and are NOT committed (see .gitignore); the
// contract test regenerates them in-memory to verify parity with index.css.
import { bundle, transform } from "lightningcss";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const STYLES = join(ROOT, "styles");

/** The flattened, self-contained CSS for one entry point, as a string. Pure --
 * callers decide whether to write it (prepack) or assert on it (the test).
 * `minify: false` keeps it readable; lightningcss still canonicalises values
 * and the four legacy pseudo-elements, all render-identical to the source.
 *
 * A relative `url()` is relative to the file it sits in, and bundling moves the
 * rule into the bundle, which is written beside the entry point (<theme>/bundle.css,
 * styles/all.bundle.css). So each such url is re-pointed from its source file's
 * folder to the entry's folder (#220); data:, absolute and fragment urls pass through. */
export function flatten(entryAbsPath) {
  const { code, dependencies } = bundle({ filename: entryAbsPath, minify: false, analyzeDependencies: true });
  let css = code.toString();
  const outDir = dirname(entryAbsPath);
  for (const dep of dependencies ?? []) {
    if (dep.type !== "url") continue;
    let target = dep.url;
    if (!/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(dep.url)) {
      const rel = relative(outDir, resolve(dirname(dep.loc.filePath), dep.url)).split(sep).join("/");
      target = rel.startsWith(".") ? rel : `./${rel}`;
    }
    css = css.split(dep.placeholder).join(target);
  }
  return css;
}

/** Canonicalise a CSS string through lightningcss exactly as `flatten` does
 * (same value/selector normalisations), so a test can compare a bundle's rule
 * set against its resolved sources without tracking those normalisations. */
export function canonicalize(css) {
  return transform({ filename: "canonical.css", code: Buffer.from(css), minify: false }).code.toString();
}

/** Theme ids, from the manifest -- the roster the package and tests agree on
 * (never a filesystem scan, which would sweep in `_shared/` after #52). */
export function themeIds() {
  const manifest = JSON.parse(readFileSync(join(STYLES, "manifest.json"), "utf-8"));
  return Object.keys(manifest.themes);
}

/** Write <theme>/bundle.css for every theme plus a flattened all.bundle.css.
 * Returns the styles-relative paths written. */
export function writeBundles() {
  const written = [];
  for (const id of themeIds()) {
    writeFileSync(join(STYLES, id, "bundle.css"), flatten(join(STYLES, id, "index.css")));
    written.push(`${id}/bundle.css`);
  }
  writeFileSync(join(STYLES, "all.bundle.css"), flatten(join(STYLES, "all.css")));
  written.push("all.bundle.css");
  return written;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  const written = writeBundles();
  // stderr, not stdout: this runs at `styles` prepack, and `npm pack --json`
  // (which copy-license.test.mjs parses) captures stdout -- a progress line
  // there would corrupt that JSON.
  console.error(`bundle-css: wrote ${written.length} flattened bundles`);
}
