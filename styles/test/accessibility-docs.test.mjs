// The documentation half of the contrast contract (STANDARD.md 9; issues #64,
// #120, #163). contrast.test.mjs computes the ratios; this file guards the
// prose those ratios lean on:
//
//   1. every theme's design.md carries an `## Accessibility` section that
//      cites the contrast test -- the section STANDARD.md 9 requires "even if
//      it reads 'the computed pairs pass; no deviations'";
//   2. every contract.json `contrast.allowlist` entry names a theme that is in
//      the manifest and a pair that `contrast.pairs` still checks -- without
//      this, deleting a pair leaves its allowlist entries orphaned and the
//      suite stays green (contrast.test.mjs only consults the allowlist for
//      pairs it is iterating);
//   3. every allowlist entry's `doc` citation is a `<theme>/design.md:a-b`
//      range that sits inside that theme's `## Accessibility` section, so the
//      line the entry cites is the sentence documenting the deviation rather
//      than wherever the prose drifted to after an edit above it.
//
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { ROOT, themeDirs } from "./css.mjs";

const contract = JSON.parse(readFileSync(join(ROOT, "contract.json"), "utf-8"));

const HEADING = "## Accessibility";
const CONTRAST_TEST = "styles/test/contrast.test.mjs";

/** A file's lines, 0-indexed, without the trailing newline's phantom empty
 * line -- so `lines.length` is the line count `wc -l` would report. */
function linesOf(path) {
  return readFileSync(path, "utf-8").replace(/\r?\n$/, "").split(/\r?\n/);
}

/** The 1-based, inclusive line span of the `## Accessibility` section: the
 * heading line through the line before the next `## ` heading (or the last
 * line of the file). null when no line reads exactly `## Accessibility`. */
function accessibilitySpan(lines) {
  const at = lines.findIndex((l) => l === HEADING);
  if (at === -1) return null;
  let end = lines.length;
  for (let i = at + 1; i < lines.length; i++) {
    if (lines[i].startsWith("## ")) {
      end = i; // 0-based index of the next heading == 1-based line before it
      break;
    }
  }
  return { start: at + 1, end };
}

test("every theme's design.md carries an ## Accessibility section that cites the contrast test (STANDARD.md 9, #64)", () => {
  for (const theme of themeDirs) {
    const path = join(ROOT, theme, "design.md");
    assert.ok(existsSync(path), `${theme}: styles/${theme}/design.md is missing`);
    const lines = linesOf(path);
    const span = accessibilitySpan(lines);
    assert.ok(span, `${theme}: design.md has no line reading exactly "${HEADING}"`);
    const section = lines.slice(span.start - 1, span.end).join("\n");
    assert.ok(
      section.includes(CONTRAST_TEST),
      `${theme}: the ${HEADING} section (design.md:${span.start}-${span.end}) never cites ${CONTRAST_TEST}`,
    );
  }
});

test("every contrast allowlist entry names a live pair and a real theme", () => {
  const { pairs, allowlist } = contract.contrast;
  for (const entry of allowlist) {
    const id = `${entry.theme} ${entry.fg}/${entry.bg}`;
    assert.ok(
      themeDirs.includes(entry.theme),
      `contrast allowlist entry "${id}" names a theme that is not in manifest.json`,
    );
    assert.ok(
      pairs.some((p) => p.fg === entry.fg && p.bg === entry.bg),
      `contrast allowlist entry "${id}" names a pair that contrast.pairs no longer checks -- drop the entry or restore the pair`,
    );
  }
});

test("every contrast allowlist doc citation points inside that theme's ## Accessibility section", () => {
  for (const entry of contract.contrast.allowlist) {
    const id = `${entry.theme} ${entry.fg}/${entry.bg}`;
    const m = /^([\w-]+)\/design\.md:(\d+)-(\d+)$/.exec(entry.doc ?? "");
    assert.ok(m, `contrast allowlist entry "${id}": doc "${entry.doc}" is not of the form <theme>/design.md:<a>-<b>`);
    const [, docTheme, aStr, bStr] = m;
    const a = Number(aStr);
    const b = Number(bStr);
    assert.equal(docTheme, entry.theme, `contrast allowlist entry "${id}": doc cites ${docTheme}/design.md, not its own theme`);
    assert.ok(a <= b, `contrast allowlist entry "${id}": doc range ${a}-${b} is inverted`);
    const path = join(ROOT, entry.theme, "design.md");
    assert.ok(existsSync(path), `contrast allowlist entry "${id}": styles/${entry.theme}/design.md is missing`);
    const lines = linesOf(path);
    assert.ok(b <= lines.length, `contrast allowlist entry "${id}": doc range ends at line ${b} but design.md has ${lines.length} lines`);
    const span = accessibilitySpan(lines);
    assert.ok(span, `contrast allowlist entry "${id}": design.md has no line reading exactly "${HEADING}"`);
    assert.ok(
      a >= span.start && b <= span.end,
      `contrast allowlist entry "${id}": doc range ${a}-${b} falls outside the ${HEADING} section (design.md:${span.start}-${span.end})`,
    );
  }
});
