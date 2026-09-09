#!/usr/bin/env node
// Scaffolds a new theme (issue #53, STANDARD.md 14.1 step 3): copies an
// existing theme's CSS layout, re-guards every selector, renames keyframes to
// a new short-name prefix, copies forward --from's contract.json exceptions
// (allowlist/dialogBackdropBlur/permittedLiterals -- a theme built by copying
// an existing one inherits its documented per-theme omissions too, e.g. the
// nazuraki ports' rb-dialog__body allowlist entry; a "theme": "*" allowlist
// row, like rb-stepper--upcoming's, already covers every theme including a
// new one and is never cloned), registers the theme everywhere
// (manifest.json, package.json, all.css, contract.json extras, README.md's
// themes table, and -- for --port -- a NOTICE bullet), and generates a
// design.md stub from the STANDARD.md section-11 template.
//
//   pnpm new-theme <id> --scheme dark|light --from <existing-theme>
//                       [--pair <sibling>] [--port <upstream-name>]
//                       [--short <short>] [--from-short <short>] [--force]
//
// The script does not invent a palette, typography, or design rationale --
// tokens.css ships with --from's literal values as a scaffold; design.md
// marks every prose section TODO and flags the whole file as a copy pending a
// real redesign (STANDARD.md 14.1 step 4 stays a manual follow-up).
import {
  cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { renderReact, renderClass } from "./generate-skill-table.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const STYLES = join(ROOT, "styles");
const TYPES_STUB = "./css-side-effect.d.ts";

// -- CLI parsing --------------------------------------------------------------

export function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") {
      args.force = true;
      continue;
    }
    if (a.startsWith("--")) {
      args[a.slice(2)] = argv[++i];
      continue;
    }
    args._.push(a);
  }
  return args;
}

function reEscape(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -- Validation ---------------------------------------------------------------

export function validateId(id) {
  if (!id || !/^[a-z][a-z0-9-]*$/.test(id)) {
    throw new Error(`invalid theme id "${id}" -- must match /^[a-z][a-z0-9-]*$/`);
  }
}

/** --from cannot equal <id>: with --force, main() rmSync's styles/<id>/ before
 * copying from styles/<from>/ -- if they're the same path, that deletes the
 * source it's about to read from, destroying the theme and crashing (ENOENT)
 * instead of scaffolding anything. */
export function validateNotSelfReferential(id, from) {
  if (id === from) throw new Error("--from cannot be the same as <id>");
}

// -- Short-name derivation ------------------------------------------------

/** Default keyframe short-name for a theme id: drop the first hyphen segment
 * (arcane-obsidian -> obsidian, concrete-signal-light -> signal-light,
 * mono-field -> field); a single-segment id returns itself. Matches 9 of the
 * 12 current themes -- the three nazuraki ports (lp/nb/sc) are hand-chosen
 * exceptions, see --short / --from-short. */
export function deriveShort(id) {
  const parts = id.split("-");
  return parts.length > 1 ? parts.slice(1).join("-") : id;
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Every distinct @keyframes name declared across a theme's CSS file contents. */
export function keyframeNames(cssContents) {
  const names = new Set();
  for (const css of cssContents) {
    for (const m of stripComments(css).matchAll(/@keyframes\s+(rb-[\w-]+)/g)) {
      names.add(m[1]);
    }
  }
  return [...names];
}

/** Resolve --from's real keyframe short-name prefix, verifying the cheap
 * default guess (or an explicit override) against the theme's actual CSS
 * before trusting it -- so a mismatch (e.g. luminous-precision's real prefix
 * is "lp", not the guessed "precision") fails loudly instead of silently
 * renaming nothing. Returns null if the theme declares no keyframes at all.
 *
 * Known limitation: verification is a literal `startsWith` prefix check, so
 * an explicit --from-short that is itself a strict prefix of the theme's real
 * short (e.g. "signal" for concrete-signal-light, whose real short is
 * "signal-light") would wrongly pass. The unverified default derivation never
 * produces this: deriveShort already resolves concrete-signal-light to the
 * full "signal-light". This only bites a hand-typed --from-short that's wrong
 * in exactly this way. */
export function resolveFromShort(fromId, cssContents, explicitShort) {
  const names = keyframeNames(cssContents);
  if (names.length === 0) return null;
  const candidate = explicitShort ?? deriveShort(fromId);
  const prefix = `rb-${candidate}-`;
  if (names.some((n) => n.startsWith(prefix))) return candidate;
  throw new Error(
    `could not verify keyframe short-name "${candidate}" for --from ${fromId} -- ` +
      `found: ${names.join(", ")} -- pass --from-short explicitly`
  );
}

// -- CSS rewriting --------------------------------------------------------

/** Rewrite one copied CSS file's text: every guard/comment mention of the
 * literal fromId token becomes toId, and every rb-<fromShort>-* keyframe
 * name/usage becomes rb-<toShort>-*.
 *
 * The fromId replace is word-boundary safe AND excludes a match immediately
 * followed by "-": a bare \b isn't enough, since e.g. "concrete-signal" is a
 * real word-bounded prefix of the real, different theme id
 * "concrete-signal-light" (concrete-signal/tokens.css:17 names it as its
 * light counterpart) -- without the trailing (?!-), scaffolding --from
 * concrete-signal would corrupt that reference into "<id>-light", silently
 * renaming a mention of an unrelated, still-existing theme. */
export function rewriteCss(css, { fromId, toId, fromShort, toShort }) {
  let out = css.replace(new RegExp(`\\b${reEscape(fromId)}\\b(?!-)`, "g"), toId);
  if (fromShort) {
    const re = new RegExp(`\\brb-${reEscape(fromShort)}-`, "g");
    out = out.replace(re, `rb-${toShort}-`);
  }
  return out;
}

// -- manifest.json / package.json / all.css / contract.json -------------------

export function upsertManifestTheme(manifest, id, scheme) {
  return { ...manifest, themes: { ...manifest.themes, [id]: { scheme, fonts: [] } } };
}

export function upsertPackageJson(pkg, id) {
  const files = pkg.files.includes(id) ? pkg.files : [...pkg.files, id];
  const exports = { ...pkg.exports };
  exports[`./${id}/bundle`] = { types: TYPES_STUB, default: `./${id}/bundle.css` };
  exports[`./${id}`] = { types: TYPES_STUB, default: `./${id}/index.css` };
  exports[`./${id}/tokens`] = { types: TYPES_STUB, default: `./${id}/tokens.css` };
  exports[`./${id}/base`] = { types: TYPES_STUB, default: `./${id}/base.css` };
  exports[`./${id}/components/*`] = { types: TYPES_STUB, default: `./${id}/components/*.css` };
  return { ...pkg, files, exports };
}

export function upsertAllCss(allCssText, id) {
  const line = `@import "./${id}/index.css";`;
  if (allCssText.includes(line)) return allCssText;
  return allCssText.replace(/\n?$/, "") + "\n" + line + "\n";
}

/** Compute what --from's contract.json extras/allowlist/dialogBackdropBlur
 * exempt/permittedLiterals entries need to be copied forward to toId (pure --
 * the actual JSON text edit is applyContractAdditions below, kept separate so
 * writing contract.json never requires parsing+re-serializing the whole
 * file -- see that function's own comment for why). Required, not cosmetic:
 *  - extras: the new theme's components/ dir is a verbatim copy of --from's,
 *    so any theme-specific extra class --from declares (e.g. arcane-obsidian's
 *    rb-wordmark, rb-tabstrip (+ modifiers), rb-eyebrow, from wordmark.css,
 *    tabstrip.css, eyebrow.css) is now ALSO present in the new theme's CSS --
 *    extras must mirror --from's list, not default to empty, or the new
 *    theme's own extra classes read as undocumented scope creep and fail
 *    class-parity.
 *  - allowlist: a per-theme documented-omission entry (e.g. the nazuraki
 *    ports' rb-dialog__body/rb-card--raised rows) names one specific theme,
 *    and a freshly scaffolded theme copied from one of those ports reproduces
 *    that exact gap since scaffolding adds no new component overrides --
 *    without copying it forward, the new theme fails class-parity the same
 *    way. A "theme": "*" row (e.g. rb-stepper--upcoming, the universal
 *    resting-state gap) is deliberately NOT copied forward: it already
 *    matches every theme, the new one included, so cloning it would only
 *    duplicate coverage the wildcard already provides. */
export function computeContractAdditions(contract, fromId, toId) {
  const extras = contract.extras[toId] ?? contract.extras[fromId] ?? [];

  const existingAllow = new Set(contract.allowlist.filter((e) => e.theme === toId).map((e) => e.class));
  const newAllowlist = contract.allowlist
    .filter((e) => e.theme === fromId && !existingAllow.has(e.class))
    .map((e) => ({ ...e, theme: toId }));

  const hasExempt = contract.dialogBackdropBlur.exempt.some((e) => e.theme === toId);
  const newExempt = hasExempt
    ? []
    : contract.dialogBackdropBlur.exempt.filter((e) => e.theme === fromId).map((e) => ({ ...e, theme: toId }));

  const permitted = contract.permittedLiterals ?? {};
  const newPermittedLiterals = {};
  for (const path of Object.keys(permitted)) {
    if (path === "//" || !path.startsWith(`${fromId}/`)) continue;
    const newPath = `${toId}${path.slice(fromId.length)}`;
    if (!(newPath in permitted)) newPermittedLiterals[newPath] = permitted[path];
  }

  return { extras, newAllowlist, newExempt, newPermittedLiterals };
}

/** Locate a top-level JSON object/array by its key -- or, given `within`
 * (an [openIdx, closeIdx] pair from a prior call), a container nested inside
 * it -- returning its own [openIdx, closeIdx]. String-literal-aware (a stray
 * bracket inside a JSON string value is never mistaken for real nesting), so
 * this is safe on the file's actual content, not just today's shape. */
function findJsonContainer(text, key, within) {
  const [searchStart, searchEnd] = within ?? [0, text.length];
  const m = new RegExp(`"${reEscape(key)}"\\s*:`).exec(text.slice(searchStart, searchEnd));
  if (!m) throw new Error(`contract.json: missing key "${key}"`);
  let i = searchStart + m.index + m[0].length;
  while (/\s/.test(text[i])) i++;
  const open = text[i];
  const close = open === "{" ? "}" : open === "[" ? "]" : null;
  if (!close) throw new Error(`contract.json: "${key}" is not an object/array`);
  let depth = 0;
  let inString = false;
  for (let j = i; j < text.length; j++) {
    const ch = text[j];
    if (inString) {
      if (ch === "\\") j++;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return [i, j];
    }
  }
  throw new Error(`contract.json: unterminated "${key}" container`);
}

/** Compact single-line JSON matching contract.json's existing hand-formatted
 * style (a space after ":" and after "," and inside "{ }"; plain
 * JSON.stringify has none of those). Only affects freshly-inserted lines.
 *
 * String-literal-aware (a single pass tracking in-string state, mirroring
 * findJsonContainer): a naive regex replace over the whole stringified text
 * would also "fix up" a ":" or "," that happens to occur INSIDE a string
 * value (a reason like `field "foo":bar` or `counts as 1,2,3`), inserting a
 * space into the value's actual content, not just its surrounding syntax. */
function compactJson(value) {
  const raw = JSON.stringify(value);
  let out = "";
  let inString = false;
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (inString) {
      out += ch;
      if (ch === "\\") out += raw[++i];
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      out += ch;
    } else if (ch === "{" && raw[i + 1] !== "}") out += "{ ";
    else if (ch === "}" && raw[i - 1] !== "{") out += " }";
    else if (ch === ":") out += ": ";
    else if (ch === ",") out += ", ";
    else out += ch;
  }
  return out;
}

function insertBeforeClose(text, [open, close], entryText, closeIndent) {
  const trimmed = text.slice(open + 1, close).replace(/\s+$/, "");
  const prefix = /\S/.test(trimmed) ? trimmed + ",\n" : trimmed ? trimmed + "\n" : "\n";
  return text.slice(0, open + 1) + prefix + entryText + "\n" + closeIndent + text.slice(close);
}

/** Apply computeContractAdditions' result directly to contract.json's raw
 * text, touching only the specific containers being added to -- never
 * parsing+JSON.stringify-ing the whole file. That round-trip is exactly what
 * this avoids: contract.json hand-formats short arrays/objects on one line
 * (`"classes": ["rb-btn", ...]`, `{ "theme": "x", "class": "y" }`), which
 * plain `JSON.stringify(data, null, 2)` explodes onto one element per line
 * everywhere -- turning a one-theme registration into a multi-hundred-line
 * diff of pure reformatting noise and clobbering the file's existing style
 * for every unrelated entry, not just the new one. */
export function applyContractAdditions(text, toId, additions) {
  let out = text;

  const [extrasOpen, extrasClose] = findJsonContainer(out, "extras");
  if (!new RegExp(`"${reEscape(toId)}"\\s*:`).test(out.slice(extrasOpen, extrasClose))) {
    out = insertBeforeClose(out, [extrasOpen, extrasClose], `    "${toId}": ${compactJson(additions.extras)}`, "  ");
  }

  if (additions.newAllowlist.length) {
    const container = findJsonContainer(out, "allowlist");
    const entries = additions.newAllowlist.map((e) => `    ${compactJson(e)}`).join(",\n");
    out = insertBeforeClose(out, container, entries, "  ");
  }

  if (additions.newExempt.length) {
    const outer = findJsonContainer(out, "dialogBackdropBlur");
    const inner = findJsonContainer(out, "exempt", outer);
    const entries = additions.newExempt.map((e) => `      ${compactJson(e)}`).join(",\n");
    out = insertBeforeClose(out, inner, entries, "    ");
  }

  for (const [path, hexes] of Object.entries(additions.newPermittedLiterals)) {
    const container = findJsonContainer(out, "permittedLiterals");
    if (new RegExp(`"${reEscape(path)}"\\s*:`).test(out.slice(container[0], container[1]))) continue;
    out = insertBeforeClose(out, container, `    "${path}": ${compactJson(hexes)}`, "  ");
  }

  return out;
}

// -- README.md themes table -------------------------------------------------

export function upsertReadmeRow(readme, { id, scheme, source }) {
  const newRow = `| \`${id}\` | ${scheme} | ${source} | TODO: describe this theme. |`;
  const rowRe = new RegExp(`^\\| \`${reEscape(id)}\` \\|.*$`, "m");
  if (rowRe.test(readme)) return readme.replace(rowRe, newRow);

  const lines = readme.split("\n");
  let lastRowIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^\| `/.test(lines[i])) lastRowIdx = i;
  }
  if (lastRowIdx === -1) throw new Error("README.md: could not find the themes table to insert a row into");
  lines.splice(lastRowIdx + 1, 0, newRow);
  return lines.join("\n");
}

// -- NOTICE ------------------------------------------------------------------

/** Append a "  - styles/<id>/" bullet to the existing NOTICE block whose
 * header line starts with upstreamName. Never invents a new block: if no
 * header matches, it errors out naming every header line it did find, rather
 * than guessing at unknown license/copyright text. */
export function insertNoticeBullet(notice, upstreamName, id) {
  const lines = notice.split("\n");
  const headerIdx = lines.findIndex((l) => l.trim().startsWith(upstreamName.trim()));
  if (headerIdx === -1) {
    // Each block's real header is the non-blank line right after one of the
    // "----...----" rules -- matching on that structural convention (rather
    // than the header text's own shape) keeps the decorative rule lines
    // themselves, and unrelated license-body text, out of the list.
    const candidates = lines
      .map((l, i) => (/^-{5,}$/.test(l.trim()) ? lines[i + 1]?.trim() : null))
      .filter((l) => l);
    throw new Error(
      `NOTICE has no block header matching "${upstreamName}" -- headers seen: ${candidates.join(", ") || "(none)"}. ` +
        `Add the license block by hand, or pass an existing upstream name.`
    );
  }
  const bulletLine = `  - styles/${id}/`;
  if (lines.includes(bulletLine)) return notice;
  let lastBulletIdx = -1;
  for (let i = headerIdx; i < lines.length; i++) {
    if (lines[i].startsWith("  - ")) lastBulletIdx = i;
    else if (lastBulletIdx !== -1) break;
  }
  if (lastBulletIdx === -1) {
    throw new Error(`NOTICE: found the "${upstreamName}" header but no "  - styles/..." bullet list under it`);
  }
  lines.splice(lastBulletIdx + 1, 0, bulletLine);
  return lines.join("\n");
}

// -- design.md ----------------------------------------------------------------

// Baseline color-role tokens that appear in every theme's design.md "## Color"
// table (STANDARD.md 11.5) -- excludes the non-color baseline tokens
// (typography/shape/spacing, covered by Typography and Shape & effects
// instead) and accent-grad, which every current design.md discusses in prose
// ("the ONE gradient") rather than as its own table row.
const COLOR_TOKEN_ROLES = [
  ["bg", "Background"],
  ["surface", "Surface"],
  ["surface-2", "Surface 2"],
  ["surface-sunken", "Surface sunken"],
  ["text", "Text"],
  ["text-soft", "Text soft"],
  ["text-faint", "Text faint"],
  ["border", "Border"],
  ["border-strong", "Border strong"],
  ["accent", "Accent"],
  ["accent-fg", "Accent fg"],
  ["accent-wash", "Accent wash"],
  ["info", "Info"],
  ["success", "Success"],
  ["warning", "Warning"],
  ["danger", "Danger"],
];

/** The literal value of one --rb-<name> declaration in a tokens.css (raw,
 * comments already irrelevant since the reduced-motion override only ever
 * touches --rb-transition, never a color token). */
function tokenValue(tokensCss, name) {
  const m = tokensCss.match(new RegExp(`--rb-${reEscape(name)}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

export function renderColorTable(tokensCss) {
  const rows = COLOR_TOKEN_ROLES.map(([name, label]) => {
    const value = tokenValue(tokensCss, name) ?? "TODO";
    return `| ${label} | \`${value}\` | TODO |`;
  });
  return ["| Role | Value | Usage |", "| --- | --- | --- |", ...rows].join("\n");
}

export function renderComponentsSection(contract) {
  const bullets = Object.entries(contract.components).map(([, def]) => {
    const label = renderReact(def.react);
    return `- **${label}** ${renderClass(def.classes)} -- TODO: describe how this theme styles it.`;
  });
  return ["## Components", "", ...bullets].join("\n");
}

/** STANDARD.md 11's item 10, "### Theme extras (if any)": the classes carried
 * over from --from that sit outside the shared baseline component set (e.g.
 * arcane-obsidian's rb-wordmark, rb-tabstrip (+ modifiers), rb-eyebrow).
 * Omitted entirely when the theme has none. */
export function renderThemeExtrasSection(extras) {
  if (!extras.length) return null;
  const items = extras.map((cls) => `\`.${cls}\``).join(", ");
  return ["### Theme extras", "", `TODO: describe ${items} (carried over from --from).`].join("\n");
}

export function renderDesignMd({ id, scheme, from, tokensCss, port, pair, contract, extras = [] }) {
  const sections = [`# ${id}`, ""];

  if (port) {
    sections.push(
      `> **Source & attribution.** Ported from [\`${port}\`](https://github.com/${port}) ` +
        `(MIT -- see the repo [\`NOTICE\`](../../NOTICE)), re-namespaced to the rackbops ` +
        `\`--rb-*\` contract. The aesthetic below is the upstream author's; only the ` +
        `token/class names changed.`,
      ""
    );
  }

  sections.push(
    `TODO: identity paragraph -- name the source (reverse-documented from a Rackbops app, ` +
      `ported from ${port ?? "<upstream>"}, or original), the primary scheme (${scheme}) and its ` +
      `sibling if paired (${pair ?? "none yet"}), three to five signature traits, the depth ` +
      `mechanism, the display voice, the label voice, and the accent philosophy in a sentence.`,
    "",
    `<!-- TODO(new-theme): every color/typography/rule below is copied verbatim from ` +
      `--from="${from}" -- design this theme's own palette and rewrite this file's prose ` +
      `before shipping. -->`,
    ""
  );

  if (port) {
    sections.push(
      "## Token mapping",
      "",
      "TODO: if this theme uses more accent voices than the single --rb-accent baseline, " +
        "table how each upstream role maps to a baseline token or a theme extra.",
      ""
    );
  }

  sections.push(
    "## Color",
    "",
    renderColorTable(tokensCss),
    "",
    "TODO: Rules paragraph -- how is colour spent in this theme.",
    "",
    "## Typography",
    "",
    "TODO: display, body, mono, labels, numerals, and the bare-tag treatment.",
    "",
    "## Shape & effects",
    "",
    "TODO: radii, depth mechanism, focus treatment, the gradient's places (if any), " +
      "transition duration and easing, spacing rhythm.",
    "",
    "## Accessibility",
    "",
    "TODO: run `pnpm --filter @rackbops/styles test` (styles/test/contract.test.mjs, " +
      "styles/test/contrast.test.mjs) and state every below-target ratio's compensating " +
      'rule, or "no deviations".',
    "",
    renderComponentsSection(contract),
    ""
  );

  const extrasSection = renderThemeExtrasSection(extras);
  if (extrasSection) sections.push(extrasSection, "");

  if (/--rb-code-\w/.test(tokensCss)) {
    sections.push(
      "## Code syntax",
      "",
      "TODO: describe the --rb-code-* palette (a per-theme extra, since only some themes " +
        "render code).",
      ""
    );
  }

  if (pair) {
    const heading = scheme === "dark" ? "Light counterpart" : "Dark counterpart";
    sections.push(
      `## ${heading}`,
      "",
      `The ${scheme === "dark" ? "light" : "dark"} counterpart ships as its own theme: ` +
        `\`${pair}\` (\`styles/${pair}/design.md\`).`,
      ""
    );
  }

  sections.push(
    "## Scoping",
    "",
    `Every rule is guarded by \`data-rb-style="${id}"\` (self or ancestor), wrapped in ` +
      "zero-specificity `:where()`. Set the attribute on `<html>` for a page or on a " +
      "container for an embedded island."
  );

  return sections.join("\n") + "\n";
}

// -- filesystem -----------------------------------------------------------

export function copyThemeDir(fromDir, toDir) {
  mkdirSync(toDir, { recursive: true });
  mkdirSync(join(toDir, "components"), { recursive: true });
  for (const f of ["tokens.css", "base.css", "index.css"]) {
    writeFileSync(join(toDir, f), readFileSync(join(fromDir, f), "utf-8"));
  }
  for (const f of readdirSync(join(fromDir, "components"))) {
    if (!f.endsWith(".css")) continue;
    writeFileSync(join(toDir, "components", f), readFileSync(join(fromDir, "components", f), "utf-8"));
  }
}

export function themeCssPaths(dir) {
  const paths = ["tokens.css", "base.css", "index.css"].map((f) => join(dir, f));
  for (const f of readdirSync(join(dir, "components"))) {
    if (f.endsWith(".css")) paths.push(join(dir, "components", f));
  }
  return paths;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

// -- main -----------------------------------------------------------------

function usageError(msg) {
  console.error(`new-theme: ${msg}`);
  console.error(
    "usage: pnpm new-theme <id> --scheme dark|light --from <existing-theme> " +
      "[--pair <sibling>] [--port <upstream-name>] [--short <s>] [--from-short <s>] [--force]"
  );
  process.exitCode = 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const id = args._[0];

  try {
    validateId(id);
    if (args.scheme !== "dark" && args.scheme !== "light") {
      throw new Error(`--scheme must be "dark" or "light", got "${args.scheme}"`);
    }
    if (!args.from) throw new Error("--from is required");
    validateNotSelfReferential(id, args.from);
  } catch (err) {
    usageError(err.message);
    return;
  }

  const manifestPath = join(STYLES, "manifest.json");
  const manifest = readJson(manifestPath);

  if (!manifest.themes[args.from]) {
    usageError(`--from "${args.from}" is not a registered theme (see styles/manifest.json)`);
    return;
  }
  if (args.pair && !manifest.themes[args.pair]) {
    usageError(`--pair "${args.pair}" is not a registered theme`);
    return;
  }

  const themeDir = join(STYLES, id);
  if (existsSync(themeDir) && !args.force) {
    usageError(`styles/${id}/ already exists -- pass --force to overwrite`);
    return;
  }

  const fromDir = join(STYLES, args.from);
  const fromCssContents = themeCssPaths(fromDir).map((p) => readFileSync(p, "utf-8"));

  let fromShort;
  try {
    fromShort = resolveFromShort(args.from, fromCssContents, args["from-short"]);
  } catch (err) {
    usageError(err.message);
    return;
  }
  const toShort = args.short ?? deriveShort(id);

  if (existsSync(themeDir)) rmSync(themeDir, { recursive: true, force: true });
  copyThemeDir(fromDir, themeDir);
  for (const path of themeCssPaths(themeDir)) {
    const rewritten = rewriteCss(readFileSync(path, "utf-8"), {
      fromId: args.from,
      toId: id,
      fromShort,
      toShort,
    });
    writeFileSync(path, rewritten);
  }
  console.log(`wrote styles/${id}/ from ${args.from} (short: ${fromShort ?? "(none)"} -> ${toShort})`);

  writeJson(manifestPath, upsertManifestTheme(manifest, id, args.scheme));
  console.log("updated styles/manifest.json");

  const pkgPath = join(STYLES, "package.json");
  writeJson(pkgPath, upsertPackageJson(readJson(pkgPath), id));
  console.log("updated styles/package.json");

  const allCssPath = join(STYLES, "all.css");
  writeFileSync(allCssPath, upsertAllCss(readFileSync(allCssPath, "utf-8"), id));
  console.log("updated styles/all.css");

  const contractPath = join(STYLES, "contract.json");
  const contractText = readFileSync(contractPath, "utf-8");
  const contract = JSON.parse(contractText);
  const additions = computeContractAdditions(contract, args.from, id);
  writeFileSync(contractPath, applyContractAdditions(contractText, id, additions));
  console.log("updated styles/contract.json (extras + copied-forward exceptions)");

  const readmePath = join(ROOT, "README.md");
  const source = args.port ?? "TODO";
  writeFileSync(readmePath, upsertReadmeRow(readFileSync(readmePath, "utf-8"), { id, scheme: args.scheme, source }));
  console.log("updated README.md themes table");

  if (args.port) {
    const noticePath = join(ROOT, "NOTICE");
    try {
      writeFileSync(noticePath, insertNoticeBullet(readFileSync(noticePath, "utf-8"), args.port, id));
      console.log("updated NOTICE");
    } catch (err) {
      usageError(err.message);
      return;
    }
  }

  const designMdPath = join(themeDir, "design.md");
  writeFileSync(
    designMdPath,
    renderDesignMd({
      id,
      scheme: args.scheme,
      from: args.from,
      tokensCss: readFileSync(join(themeDir, "tokens.css"), "utf-8"),
      port: args.port,
      pair: args.pair,
      contract,
      extras: additions.extras,
    })
  );
  console.log(`wrote styles/${id}/design.md (stub -- fill in the TODOs)`);

  console.log("running: pnpm --filter @rackbops/styles test");
  // A single command string (not a separate args array) run through the
  // shell -- required on Windows to resolve the pnpm.cmd shim, and avoids
  // Node's shell+args escaping warning since there is nothing here to escape
  // (every token is a static literal, never derived from CLI input).
  const result = spawnSync("pnpm --filter @rackbops/styles test", { cwd: ROOT, stdio: "inherit", shell: true });
  process.exitCode = result.status ?? 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) main();
