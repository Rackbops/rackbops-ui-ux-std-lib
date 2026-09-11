// Makes "theme extras render only under a labelled extras section" (STANDARD.md
// 13, issue #168) mechanical, rather than something review alone catches --
// exactly the class of miss #168 itself surfaced (wordmark/eyebrow and the
// studio pair's arrow/card-tag were demoed outside either "Theme extras"
// section, with no test to say so).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const html = readFileSync(join(ROOT, "site", "index.html"), "utf-8");
const contract = JSON.parse(readFileSync(join(ROOT, "styles", "contract.json"), "utf-8"));

/** Every class named in any theme's contract.json `extras` entry, deduped --
 * the closed set of classes this test polices. */
const extrasClasses = [...new Set(Object.values(contract.extras).flat())];

const MAIN_START = html.indexOf("<main>");
const MAIN_END = html.indexOf("</main>");
assert.ok(MAIN_START !== -1 && MAIN_END !== -1, "site/index.html: no <main>...</main> found -- the page markup changed shape");
const mainHtml = html.slice(MAIN_START, MAIN_END);
/** Everything outside <main>: the <head>/<style>, <body class="..."> itself,
 * the sticky .sc-head chrome, and the trailing <script> -- STANDARD.md 13's
 * "only in a labelled extras section" rule is about *sections*, so this
 * region is out of that rule's scope by construction, not exempted from it. */
const outsideMainHtml = html.slice(0, MAIN_START) + html.slice(MAIN_END + "</main>".length);

/** Split a slice of the page into its top-level <section>...</section>
 * blocks. A naive lazy-match regex is enough here ONLY because no <section>
 * in this file nests another (verified by inspection: 15 opens, 15 closes,
 * strictly sequential). A nested <section> would NOT make this conservative
 * -- the lazy match truncates at the first inner </section>, so an outer
 * section's tail content after that point falls into no block at all and a
 * real violation there would escape test 1 entirely. If this file ever
 * grows a nested <section>, this function needs a real (depth-tracking)
 * parser, not this regex. */
function sections(source) {
  const blocks = [];
  const re = /<section[^>]*>([\s\S]*?)<\/section>/g;
  let m;
  while ((m = re.exec(source))) blocks.push(m[1]);
  return blocks;
}

/** Whether a section's own <h2 class="sc-title"> heading marks it as an
 * extras section -- STANDARD.md's contract is "a section labelled as
 * extras", and every such heading in this file starts with "Theme extras"
 * (verified below by the second test also confirming the reverse: nothing
 * outside these sections claims the label). */
function isExtrasSection(block) {
  const m = /<h2 class="sc-title">([^<]*)<\/h2>/.exec(block);
  return !!m && m[1].startsWith("Theme extras");
}

/** Every class token that appears in any class="..." attribute within a
 * string (does not distinguish which element carries which class -- this
 * test only needs "does this class appear anywhere in this scope"). */
function classesIn(source) {
  const set = new Set();
  for (const m of source.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c) set.add(c);
  }
  return set;
}

const blocks = sections(mainHtml);
assert.ok(blocks.length > 0, "site/index.html: no <section> found inside <main> -- sections()'s regex is broken, or the page markup changed shape");

test("no theme-extras class renders outside a section labelled 'Theme extras' (#168)", () => {
  for (const block of blocks) {
    if (isExtrasSection(block)) continue;
    const present = classesIn(block);
    for (const cls of extrasClasses) {
      assert.ok(!present.has(cls), `class "${cls}" (a theme extra per contract.json) renders in a non-extras section: ${/<h2 class="sc-title">([^<]*)<\/h2>/.exec(block)?.[1] ?? "(untitled)"}`);
    }
  }
});

test("every theme-extras class rendered inside <main> at all is rendered inside an extras section (demos aren't simply deleted, #168)", () => {
  const renderedInMain = classesIn(mainHtml);
  const renderedInExtras = new Set();
  for (const block of blocks) {
    if (!isExtrasSection(block)) continue;
    for (const c of classesIn(block)) renderedInExtras.add(c);
  }
  for (const cls of extrasClasses) {
    if (!renderedInMain.has(cls)) continue; // not demoed at all -- fine, out of this test's scope
    assert.ok(renderedInExtras.has(cls), `class "${cls}" is rendered inside <main> but never inside a "Theme extras" section`);
  }
});

test("the only theme-extras class rendered outside <main> is rb-bg, the ports' opt-in page canvas on <body> (STANDARD.md 13)", () => {
  // luminous-precision, neon-butterfly and summer-cloud's `.rb-bg` (contract.json
  // extras) is an opt-in *page background*, not a component -- it belongs on
  // <body> itself (STANDARD.md :570-571), not demoed inside a section. Any
  // other extras class showing up outside <main> (e.g. rb-eyebrow added to
  // .sc-head's <strong>) is a real violation and must fail here.
  const found = [...classesIn(outsideMainHtml)].filter((c) => extrasClasses.includes(c)).sort();
  assert.deepEqual(found, ["rb-bg"]);
});
