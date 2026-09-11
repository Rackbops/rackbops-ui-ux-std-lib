import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  parseArgs,
  validateId,
  validateNotSelfReferential,
  deriveShort,
  keyframeNames,
  resolveFromShort,
  rewriteCss,
  upsertManifestTheme,
  upsertPackageJson,
  upsertAllCss,
  computeContractAdditions,
  applyContractAdditions,
  upsertReadmeRow,
  insertNoticeBullet,
  renderColorTable,
  renderComponentsSection,
  renderThemeExtrasSection,
  renderDesignMd,
  copyThemeDir,
  themeCssPaths,
} from "./new-theme.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const STYLES = join(ROOT, "styles");
const manifest = JSON.parse(readFileSync(join(STYLES, "manifest.json"), "utf-8"));
const contractText = readFileSync(join(STYLES, "contract.json"), "utf-8");
const contract = JSON.parse(contractText);
const readme = readFileSync(join(ROOT, "README.md"), "utf-8");
const notice = readFileSync(join(ROOT, "NOTICE"), "utf-8");

// -- parseArgs / validateId ---------------------------------------------------

test("parseArgs reads the positional id, flags, and the --force boolean", () => {
  const args = parseArgs(["scratch-test", "--scheme", "dark", "--from", "arcane-obsidian", "--force"]);
  assert.deepEqual(args._, ["scratch-test"]);
  assert.equal(args.scheme, "dark");
  assert.equal(args.from, "arcane-obsidian");
  assert.equal(args.force, true);
});

test("validateId accepts kebab-case ids and rejects the rest", () => {
  assert.doesNotThrow(() => validateId("scratch-test"));
  assert.doesNotThrow(() => validateId("mono"));
  for (const bad of [undefined, "", "Scratch", "scratch_test", "1scratch", "-scratch"]) {
    assert.throws(() => validateId(bad), /invalid theme id/);
  }
});

test("validateNotSelfReferential rejects --from equal to <id> (would destroy the source theme under --force)", () => {
  assert.throws(() => validateNotSelfReferential("concrete-signal", "concrete-signal"), /cannot be the same/);
  assert.doesNotThrow(() => validateNotSelfReferential("scratch-test", "concrete-signal"));
});

// -- deriveShort ---------------------------------------------------------

test("deriveShort drops the first hyphen segment, matching 9 of the 12 current themes", () => {
  assert.equal(deriveShort("arcane-obsidian"), "obsidian");
  assert.equal(deriveShort("arcane-parchment"), "parchment");
  assert.equal(deriveShort("concrete-signal"), "signal");
  assert.equal(deriveShort("concrete-signal-light"), "signal-light");
  assert.equal(deriveShort("amber-hearth"), "hearth");
  assert.equal(deriveShort("amber-ember"), "ember");
  assert.equal(deriveShort("rackbops-studio"), "studio");
  assert.equal(deriveShort("rackbops-noir"), "noir");
  assert.equal(deriveShort("mono-field"), "field");
});

test("deriveShort returns a single-segment id unchanged", () => {
  assert.equal(deriveShort("mono"), "mono");
});

// -- keyframeNames / resolveFromShort -----------------------------------------

function realCss(theme) {
  return themeCssPaths(join(STYLES, theme)).map((p) => readFileSync(p, "utf-8"));
}

/** Remove @keyframes blocks (one level of step nesting) so a naive selector
 * scan doesn't mistake a keyframe step ("to { ... }") for an unguarded rule. */
function stripKeyframeBlocks(css) {
  return css.replace(/@keyframes\s+[\w-]+\s*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
}

test("keyframeNames finds every distinct @keyframes name, ignoring commented-out ones", () => {
  assert.deepEqual(keyframeNames(["@keyframes rb-x-spin { from {} to {} }"]), ["rb-x-spin"]);
  assert.deepEqual(
    keyframeNames(["/* @keyframes rb-dead-spin {} */\n@keyframes rb-live-spin {}"]),
    ["rb-live-spin"]
  );
});

test("keyframeNames only ever returns rb-* names, even though its shared scanner (extractKeyframeNames) is general-purpose (#93)", () => {
  assert.deepEqual(
    keyframeNames(["@keyframes fade { to { opacity: 0; } }\n@keyframes rb-y-spin { to {} }"]),
    ["rb-y-spin"]
  );
});

test("resolveFromShort verifies its guess against real theme CSS: arcane-obsidian", () => {
  assert.equal(resolveFromShort("arcane-obsidian", realCss("arcane-obsidian"), undefined), "obsidian");
});

test("resolveFromShort verifies its guess against real theme CSS: rackbops-noir (multiple keyframes)", () => {
  assert.equal(resolveFromShort("rackbops-noir", realCss("rackbops-noir"), undefined), "noir");
});

test("resolveFromShort rejects an unverifiable default guess and names the real keyframes found", () => {
  // luminous-precision's real short is "lp" -- the default guess ("precision")
  // must fail loudly rather than silently rewriting nothing.
  assert.throws(
    () => resolveFromShort("luminous-precision", realCss("luminous-precision"), undefined),
    /could not verify keyframe short-name "precision".*rb-lp-pulse-glow/s
  );
});

test("resolveFromShort accepts an explicit --from-short override that matches reality", () => {
  assert.equal(resolveFromShort("luminous-precision", realCss("luminous-precision"), "lp"), "lp");
});

test("resolveFromShort returns null for a theme with no keyframes at all", () => {
  assert.equal(resolveFromShort("whatever", ["/* no keyframes here */\n.a { color: red; }"], undefined), null);
});

// -- rewriteCss ---------------------------------------------------------

test("rewriteCss rewrites the guard attribute and header-comment mentions of the theme id", () => {
  const css = `/* arcane-obsidian — design tokens\n * Consume via @import "@rackbops/styles/arcane-obsidian/tokens";\n */\n:where([data-rb-style="arcane-obsidian"]) { --rb-bg: #000; }`;
  const out = rewriteCss(css, { fromId: "arcane-obsidian", toId: "scratch-test" });
  assert.ok(out.includes('data-rb-style="scratch-test"'));
  assert.ok(!out.includes("arcane-obsidian"), "no occurrence of the old id should survive");
  assert.ok(out.includes("scratch-test/tokens"), "the header comment's example import path should also be rewritten");
});

test("rewriteCss does not touch an unrelated id that happens to share a hyphenated word", () => {
  // "amber-hearth" and "amber-ember" share the "amber-" prefix; rewriting one
  // must never touch a mention of the other id.
  const css = `/* amber-hearth */\n.x { color: red; } /* see also amber-ember */`;
  const out = rewriteCss(css, { fromId: "amber-hearth", toId: "amber-dawn" });
  assert.ok(out.includes("amber-dawn"));
  assert.ok(out.includes("amber-ember"), "an unrelated id must survive untouched");
});

test("rewriteCss does not corrupt a real theme id that is a strict prefix of another real theme id", () => {
  // concrete-signal/tokens.css genuinely names "concrete-signal-light" (its
  // real light counterpart) in its header comment. A bare \b boundary treats
  // "concrete-signal" as fully matched right before that "-light" (a hyphen
  // is a non-word char, so \b fires there too) and would corrupt the
  // reference into "<id>-light" -- scaffolding from concrete-signal must
  // never touch that unrelated, still-existing theme's name.
  const css = readFileSync(join(STYLES, "concrete-signal", "tokens.css"), "utf-8");
  const out = rewriteCss(css, { fromId: "concrete-signal", toId: "scratch-test" });
  assert.ok(out.includes("scratch-test"));
  assert.ok(out.includes("concrete-signal-light"), "the real sibling theme's name must survive untouched");
  assert.ok(!out.includes('"concrete-signal"'), "the guard itself must still be rewritten");
});

test("rewriteCss renames every rb-<fromShort>-* keyframe reference to rb-<toShort>-*", () => {
  const css = `@keyframes rb-obsidian-spin { from { opacity: 0; } }\n.x { animation: rb-obsidian-spin 1s linear; }`;
  const out = rewriteCss(css, { fromId: "arcane-obsidian", toId: "arcane-dawn", fromShort: "obsidian", toShort: "dawn" });
  assert.ok(out.includes("@keyframes rb-dawn-spin"));
  assert.ok(out.includes("animation: rb-dawn-spin"));
  assert.ok(!out.includes("rb-obsidian-spin"));
});

test("resolveFromShort resolves concrete-signal-light to its real, longer short -- not the shorter false-positive prefix 'signal'", () => {
  // deriveShort's drop-first-segment default must produce "signal-light" here,
  // not "signal" (which is ALSO technically a valid string-prefix of the real
  // "rb-signal-light-spin" keyframe, but is not the theme's actual short).
  // This is the concrete guarantee that keeps rewriteCss's fromShort-based
  // rename safe on the real default path -- an explicit, wrong --from-short
  // typed by a human could still collide this way; that is a documented
  // limitation of the override, not something the derivation can rule out.
  assert.equal(resolveFromShort("concrete-signal-light", realCss("concrete-signal-light"), undefined), "signal-light");
});

// -- manifest / package.json / all.css upserts -------------------------------

test("upsertManifestTheme adds a new theme entry without disturbing existing ones", () => {
  const out = upsertManifestTheme(manifest, "scratch-test", "dark");
  assert.deepEqual(out.themes["scratch-test"], { scheme: "dark", fonts: [] });
  assert.deepEqual(out.themes["arcane-obsidian"], manifest.themes["arcane-obsidian"]);
  assert.equal(Object.keys(manifest.themes).includes("scratch-test"), false, "input must not be mutated");
});

test("upsertPackageJson adds the theme to files and all 5 exports keys, matching every existing theme's shape", () => {
  const pkg = JSON.parse(readFileSync(join(STYLES, "package.json"), "utf-8"));
  const out = upsertPackageJson(pkg, "scratch-test");
  assert.ok(out.files.includes("scratch-test"));
  for (const suffix of ["", "/tokens", "/base", "/components/*", "/bundle"]) {
    assert.ok(out.exports[`./scratch-test${suffix}`], `missing exports key ./scratch-test${suffix}`);
  }
  // Shape matches an existing theme's real exports entries exactly.
  assert.deepEqual(Object.keys(out.exports["./scratch-test"]), Object.keys(pkg.exports["./arcane-obsidian"]));
});

test("upsertPackageJson is idempotent: re-running on its own output does not duplicate files", () => {
  const pkg = JSON.parse(readFileSync(join(STYLES, "package.json"), "utf-8"));
  const once = upsertPackageJson(pkg, "scratch-test");
  const twice = upsertPackageJson(once, "scratch-test");
  assert.equal(twice.files.filter((f) => f === "scratch-test").length, 1);
});

test("upsertAllCss appends the import once and is idempotent on re-run", () => {
  const allCss = readFileSync(join(STYLES, "all.css"), "utf-8");
  const once = upsertAllCss(allCss, "scratch-test");
  assert.ok(once.includes('@import "./scratch-test/index.css";'));
  const twice = upsertAllCss(once, "scratch-test");
  assert.equal(twice, once, "a second run must not duplicate the import line");
});

// -- computeContractAdditions (pure) -----------------------------------------

test("computeContractAdditions copies luminous-precision's rb-dialog__body allowlist entry forward", () => {
  const additions = computeContractAdditions(contract, "luminous-precision", "scratch-test");
  const entry = additions.newAllowlist.find((e) => e.class === "rb-dialog__body");
  assert.ok(entry, "a per-theme documented-omission entry must be copied forward");
  assert.equal(entry.theme, "scratch-test");
  const source = contract.allowlist.find((e) => e.theme === "luminous-precision" && e.class === "rb-dialog__body");
  assert.equal(entry.reason, source.reason);
});

test("computeContractAdditions does NOT clone a wildcard allowlist row (theme: \"*\") -- it already covers every theme, including a new one", () => {
  const wildcard = contract.allowlist.find((e) => e.theme === "*" && e.class === "rb-stepper--upcoming");
  assert.ok(wildcard, "rb-stepper--upcoming must still be present as a universal wildcard row");

  const additions = computeContractAdditions(contract, "arcane-obsidian", "scratch-test");
  const cloned = additions.newAllowlist.find((e) => e.class === "rb-stepper--upcoming");
  assert.equal(cloned, undefined, "a wildcard row must never be duplicated into a per-theme row for the new theme");
});

test("computeContractAdditions mirrors --from's extras, since the copied CSS carries the same extra classes", () => {
  const additions = computeContractAdditions(contract, "arcane-obsidian", "scratch-test");
  assert.deepEqual(additions.extras, contract.extras["arcane-obsidian"]);
});

test("computeContractAdditions defaults extras to [] when --from has none", () => {
  const additions = computeContractAdditions(contract, "mono-field", "scratch-test");
  assert.deepEqual(additions.extras, []);
});

test("computeContractAdditions copies permittedLiterals forward under the new theme's path", () => {
  const additions = computeContractAdditions(contract, "summer-cloud", "scratch-test");
  assert.deepEqual(additions.newPermittedLiterals["scratch-test/alert.css"], contract.permittedLiterals["summer-cloud/alert.css"]);
});

test("computeContractAdditions copies dialogBackdropBlur.exempt forward for a flat-scrim theme", () => {
  const additions = computeContractAdditions(contract, "concrete-signal", "scratch-test");
  const entry = additions.newExempt.find((e) => e.theme === "scratch-test");
  assert.ok(entry, "concrete-signal's permanent flat-scrim exemption must copy forward");
});

test("computeContractAdditions does not mutate its input contract object", () => {
  const before = JSON.stringify(contract);
  computeContractAdditions(contract, "arcane-obsidian", "scratch-test");
  assert.equal(JSON.stringify(contract), before);
});

// -- applyContractAdditions (surgical text edit) -----------------------------

test("applyContractAdditions edits contract.json's real text without reformatting anything else", () => {
  const additions = computeContractAdditions(contract, "luminous-precision", "scratch-test");
  const out = applyContractAdditions(contractText, "scratch-test", additions);

  assert.ok(JSON.parse(out), "result must still be valid JSON");
  const parsed = JSON.parse(out);
  assert.deepEqual(parsed.extras["scratch-test"], contract.extras["luminous-precision"]);
  assert.ok(parsed.allowlist.some((e) => e.theme === "scratch-test" && e.class === "rb-dialog__body"));

  // The whole point: untouched content survives byte-for-byte, including
  // contract.json's hand-formatted compact single-line arrays/objects (the
  // exact thing a JSON.stringify(parsed, null, 2) round-trip would explode).
  assert.ok(out.includes('"classes": ["rb-btn", "rb-btn--primary"'), "unrelated compact arrays must survive untouched");
  assert.ok(
    out.includes('{ "theme": "luminous-precision", "class": "rb-card--raised"'),
    "unrelated compact allowlist objects must survive untouched"
  );
  // Only the two touched containers (extras, allowlist) should differ from
  // the original text -- everything else, including the untouched
  // dialogBackdropBlur/permittedLiterals blocks, must be byte-identical.
  assert.equal(
    out.slice(out.indexOf('"dialogBackdropBlur"')),
    contractText.slice(contractText.indexOf('"dialogBackdropBlur"')),
    "content after the last touched container must be untouched"
  );
});

test("applyContractAdditions produces new entries in the file's own compact style (space after : and inside { })", () => {
  const additions = computeContractAdditions(contract, "arcane-obsidian", "scratch-test");
  const out = applyContractAdditions(contractText, "scratch-test", additions);
  assert.ok(out.includes('"scratch-test": ["rb-eyebrow"]'));
});

test("applyContractAdditions's compact-style formatting never alters a ':' or ',' that occurs inside a string VALUE", () => {
  // A naive whole-string regex-based spacer would "fix up" punctuation
  // inside a reason string too, e.g. inserting a space right after an
  // embedded quote+colon or splitting "1,2,3" into "1, 2, 3". Neither of
  // today's real reason strings happens to contain this, so the synthetic
  // case here is what actually proves the fix, not an incidental pass.
  const synthetic = {
    extras: { x: [] },
    allowlist: [{ theme: "x", class: "rb-foo", reason: 'field "foo":bar and counts 1,2,3 with no spaces' }],
    dialogBackdropBlur: { token: "--rb-blur", exempt: [] },
    permittedLiterals: {},
  };
  const text = JSON.stringify(synthetic, null, 2); // a plain round-trip is fine as INPUT text for this test
  const additions = { extras: [], newAllowlist: [{ theme: "y", class: "rb-foo", reason: 'field "foo":bar and counts 1,2,3 with no spaces' }], newExempt: [], newPermittedLiterals: {} };
  const out = applyContractAdditions(text, "y", additions);
  const parsed = JSON.parse(out);
  const entry = parsed.allowlist.find((e) => e.theme === "y");
  assert.equal(entry.reason, 'field "foo":bar and counts 1,2,3 with no spaces', "string content must survive byte-for-byte");
});

test("applyContractAdditions is idempotent: re-running does not duplicate the extras or allowlist entry", () => {
  const additions = computeContractAdditions(contract, "luminous-precision", "scratch-test");
  const once = applyContractAdditions(contractText, "scratch-test", additions);
  const onceParsed = JSON.parse(once);
  const additions2 = computeContractAdditions(onceParsed, "luminous-precision", "scratch-test");
  assert.equal(additions2.newAllowlist.length, 0, "the second pass must see scratch-test's entries as already present");
  const twice = applyContractAdditions(once, "scratch-test", additions2);
  assert.equal(twice, once, "a second run with nothing new to add must be a no-op");
});

test("applyContractAdditions copies dialogBackdropBlur.exempt into its correctly nested container", () => {
  const additions = computeContractAdditions(contract, "concrete-signal", "scratch-test");
  const out = applyContractAdditions(contractText, "scratch-test", additions);
  const parsed = JSON.parse(out);
  assert.ok(parsed.dialogBackdropBlur.exempt.some((e) => e.theme === "scratch-test"));
});

// -- README row --------------------------------------------------------------

test("upsertReadmeRow appends a new row after the last existing theme row", () => {
  const out = upsertReadmeRow(readme, { id: "scratch-test", scheme: "dark", source: "TODO" });
  assert.ok(out.includes("| `scratch-test` | dark | TODO | TODO: describe this theme. |"));
  const lines = out.split("\n");
  const newRowIdx = lines.findIndex((l) => l.includes("scratch-test"));
  const monoFieldIdx = lines.findIndex((l) => l.includes("`mono-field`"));
  assert.ok(newRowIdx > monoFieldIdx, "the new row must come after the existing table rows");
});

test("upsertReadmeRow replaces an existing row for the same id instead of duplicating it (re-run with --force)", () => {
  const once = upsertReadmeRow(readme, { id: "scratch-test", scheme: "dark", source: "TODO" });
  const twice = upsertReadmeRow(once, { id: "scratch-test", scheme: "light", source: "nazuraki/ui-std-lib" });
  const matches = twice.split("\n").filter((l) => l.includes("`scratch-test`"));
  assert.equal(matches.length, 1);
  assert.ok(matches[0].includes("| light |"));
});

// -- NOTICE --------------------------------------------------------------

test("insertNoticeBullet appends after the last existing bullet in the matching upstream block", () => {
  const out = insertNoticeBullet(notice, "nazuraki/ui-std-lib", "scratch-port");
  const lines = out.split("\n");
  const newIdx = lines.indexOf("  - styles/scratch-port/");
  const summerCloudIdx = lines.indexOf("  - styles/summer-cloud/");
  assert.equal(newIdx, summerCloudIdx + 1);
});

test("insertNoticeBullet is idempotent on re-run", () => {
  const once = insertNoticeBullet(notice, "nazuraki/ui-std-lib", "scratch-port");
  const twice = insertNoticeBullet(once, "nazuraki/ui-std-lib", "scratch-port");
  assert.equal(twice, once);
});

test("insertNoticeBullet errors, naming the real headers, when the upstream doesn't match any block", () => {
  assert.throws(
    () => insertNoticeBullet(notice, "example/does-not-exist", "scratch-port"),
    /no block header matching "example\/does-not-exist".*nazuraki\/ui-std-lib/s
  );
});

test("insertNoticeBullet's error candidate list excludes the decorative dash rules and license-body text", () => {
  // The candidate filter used to match on "does this line look like an
  // identifier" (word chars, dots, @, /, -), which also matched the
  // "----...----" separator rules (all hyphens) and license-body fragments
  // like "SOFTWARE." -- both real content of the actual NOTICE file.
  try {
    insertNoticeBullet(notice, "example/does-not-exist", "scratch-port");
    assert.fail("expected a throw");
  } catch (err) {
    assert.ok(!/^-+,|, -+$|, -+,/.test(err.message), `dash-rule line leaked into: ${err.message}`);
    assert.ok(!err.message.includes("SOFTWARE."), `license-body fragment leaked into: ${err.message}`);
  }
});

// -- design.md rendering --------------------------------------------------

test("renderColorTable pulls real values out of tokens.css, in the baseline color-role order", () => {
  const tokensCss = readFileSync(join(STYLES, "arcane-obsidian", "tokens.css"), "utf-8");
  const table = renderColorTable(tokensCss);
  assert.ok(table.includes("| Background | `#0c0f14` | TODO |"));
  assert.ok(table.includes("| Accent | `#8b7cf6` | TODO |"));
  const bgIdx = table.indexOf("Background");
  const accentIdx = table.indexOf("| Accent |");
  assert.ok(bgIdx < accentIdx, "rows must follow COLOR_TOKEN_ROLES order");
});

test("renderComponentsSection lists one bullet per contract.json component, in declared order", () => {
  const section = renderComponentsSection(contract);
  const names = Object.keys(contract.components);
  let lastIdx = -1;
  for (const name of names) {
    const label = contract.components[name].classes[0];
    const idx = section.indexOf(`.${label}`);
    assert.ok(idx > lastIdx, `${name}'s bullet is out of order`);
    lastIdx = idx;
  }
});

test("renderDesignMd emits the STANDARD.md section-11 heading order for a plain (non-ported, non-paired) theme", () => {
  const md = renderDesignMd({
    id: "scratch-test",
    scheme: "dark",
    from: "arcane-obsidian",
    tokensCss: readFileSync(join(STYLES, "arcane-obsidian", "tokens.css"), "utf-8"),
    port: undefined,
    pair: undefined,
    contract,
  });
  assert.ok(md.startsWith("# scratch-test"));
  const headings = [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]);
  assert.deepEqual(headings, [
    "Color",
    "Typography",
    "Shape & effects",
    "Accessibility",
    "Components",
    "Code syntax", // arcane-obsidian's tokens.css declares --rb-code-*
    "Scoping",
  ]);
  assert.ok(md.includes("TODO(new-theme)"), "must carry the copied-verbatim warning banner");
});

test("renderDesignMd includes the attribution block and Token mapping section only when --port is given", () => {
  const md = renderDesignMd({
    id: "scratch-port",
    scheme: "dark",
    from: "luminous-precision",
    tokensCss: readFileSync(join(STYLES, "luminous-precision", "tokens.css"), "utf-8"),
    port: "nazuraki/ui-std-lib",
    pair: undefined,
    contract,
  });
  assert.ok(md.includes("Ported from"));
  assert.ok(md.includes("## Token mapping"));
});

test("renderThemeExtrasSection returns null for no extras, and a bulleted TODO for real ones", () => {
  assert.equal(renderThemeExtrasSection([]), null);
  const section = renderThemeExtrasSection(["rb-chip", "rb-eyebrow"]);
  assert.ok(section.startsWith("### Theme extras"));
  assert.ok(section.includes(".rb-chip"));
  assert.ok(section.includes(".rb-eyebrow"));
});

test("renderDesignMd includes a '### Theme extras' subheading (STANDARD.md 11 item 10) between Components and Code syntax when --from carries extras", () => {
  // arcane-obsidian's own extra (rb-eyebrow; rb-wordmark and rb-tabstrip* were
  // extras too before they joined the shared set) is copied verbatim into the
  // new theme's CSS, so a scaffold from it must document it -- otherwise the
  // acceptance bullet "design.md matches the STANDARD.md section-11 section
  // order" silently drops an applicable item.
  const md = renderDesignMd({
    id: "scratch-test",
    scheme: "dark",
    from: "arcane-obsidian",
    tokensCss: readFileSync(join(STYLES, "arcane-obsidian", "tokens.css"), "utf-8"),
    port: undefined,
    pair: undefined,
    contract,
    extras: contract.extras["arcane-obsidian"],
  });
  const headings = [...md.matchAll(/^(##|###)\s+(.+)$/gm)].map((m) => m[2]);
  const componentsIdx = headings.indexOf("Components");
  const extrasIdx = headings.indexOf("Theme extras");
  const codeSyntaxIdx = headings.indexOf("Code syntax");
  assert.ok(componentsIdx !== -1 && extrasIdx !== -1 && codeSyntaxIdx !== -1);
  assert.ok(componentsIdx < extrasIdx && extrasIdx < codeSyntaxIdx, "Theme extras must sit between Components and Code syntax");
  const extrasBody = md.slice(md.indexOf("### Theme extras"), md.indexOf("## Code syntax"));
  assert.ok(extrasBody.includes(".rb-eyebrow"), "the source theme's real extra must be listed");
  assert.ok(!extrasBody.includes(".rb-wordmark"), "a shared component must not be re-listed as an extra");
});

test("renderDesignMd includes a counterpart pointer heading only when --pair is given", () => {
  const md = renderDesignMd({
    id: "scratch-dark",
    scheme: "dark",
    from: "amber-ember",
    tokensCss: readFileSync(join(STYLES, "amber-ember", "tokens.css"), "utf-8"),
    port: undefined,
    pair: "scratch-light",
    contract,
  });
  assert.ok(md.includes("## Light counterpart"));
  assert.ok(md.includes("scratch-light"));
});

// -- copyThemeDir (real filesystem, temp dirs only) --------------------------

test("copyThemeDir copies tokens/base/index/components but not design.md or bundle.css", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "new-theme-copy-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const toDir = join(dir, "scratch-test");

  copyThemeDir(join(STYLES, "arcane-obsidian"), toDir);

  for (const f of ["tokens.css", "base.css", "index.css"]) {
    assert.ok(readFileSync(join(toDir, f), "utf-8").length > 0);
  }
  const components = readdirSync(join(toDir, "components"));
  assert.ok(components.includes("button.css"));
  assert.equal(readdirSync(toDir).includes("design.md"), false);
  assert.equal(readdirSync(toDir).includes("bundle.css"), false);
});

test("end-to-end: copy + rewrite arcane-obsidian into a temp theme produces a fully re-guarded, keyframe-renamed tree", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "new-theme-e2e-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const toDir = join(dir, "scratch-test");

  copyThemeDir(join(STYLES, "arcane-obsidian"), toDir);
  const fromShort = resolveFromShort("arcane-obsidian", realCss("arcane-obsidian"), undefined);
  const toShort = deriveShort("scratch-test");
  for (const path of themeCssPaths(toDir)) {
    writeFileSync(path, rewriteCss(readFileSync(path, "utf-8"), {
      fromId: "arcane-obsidian",
      toId: "scratch-test",
      fromShort,
      toShort,
    }));
  }

  const allText = themeCssPaths(toDir).map((p) => readFileSync(p, "utf-8")).join("\n");
  assert.ok(!allText.includes("arcane-obsidian"), "no trace of the source id should remain");
  assert.ok(allText.includes('data-rb-style="scratch-test"'));
  assert.ok(allText.includes("rb-test-spin"), "keyframe must be renamed to the new short (scratch-test -> test)");
  assert.ok(!allText.includes("rb-obsidian-"), "no trace of the source short name should remain");

  // Every selector in every file must carry the new guard -- the same shape
  // styles/test/contract.test.mjs itself asserts for a real theme.
  for (const path of themeCssPaths(toDir)) {
    const css = stripKeyframeBlocks(readFileSync(path, "utf-8").replace(/\/\*[\s\S]*?\*\//g, ""));
    for (const m of css.matchAll(/([^{}]+)\{/g)) {
      const prelude = m[1].trim();
      if (prelude.startsWith("@")) continue;
      assert.ok(prelude.includes('[data-rb-style="scratch-test"]'), `unguarded selector in ${path}: ${prelude}`);
    }
  }
});
