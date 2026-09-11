// The required class set, derived from what @rackbops/ui-react actually emits.
//
// styles/contract.json hand-lists, per component, the rb-* classes every theme
// must style (its `components[*].classes`). That list is what the theme-parity
// check in styles/test/contract.test.mjs reads. But the classes a consumer
// really gets are whatever the React components render -- so a class the
// components emit that contract.json forgot would never be required of any
// theme, and "a screen restyles by flipping data-rb-style" would silently
// break for it (issue #48, closing the React half of #29).
//
// This test binds the two: it renders every export across a matrix of its
// class-adding props to static markup (as the other *.test.tsx do) and asserts
// the emitted rb-* set equals contract.json's React-backed class set in both
// directions -- no emission missing from the contract, no contract entry that
// no render produces. The styles suite already binds contract.json -> every
// theme (each class styled, allowlisted, or an ariaPairs/dialog-blur exempt),
// so every class the matrix exercises is styled by every theme or is a
// documented omission -- without a second copy of the CSS parser over here in
// the React package.
//
// The matrix gap is closed two ways (issue #118), so RENDERS being
// hand-maintained is no longer a silent liability:
//  - Every static rb-* class literal anywhere in the component sources must be
//    exercised by the matrix (a plain regex scan, below) -- this alone catches
//    the #48 counterexample (`rb-btn--lg` behind a `size` value RENDERS never
//    renders).
//  - Every exported class-bearing prop union (Button's variant, the shared
//    SemanticVariant) is rendered from a `const ... as const satisfies
//    readonly <Union>[]` list paired with a compile-time `Exclude<...>
//    extends never` assertion, so widening the union without extending the
//    list fails `tsc --noEmit` (which the package test script runs first) --
//    the matrix cannot silently fall behind an exported type.
// The one residual: a dynamic template over a LOCAL, non-exported union --
// today only Stepper's three index-derived states -- has no type to check
// exhaustiveness against. It is pinned by its own test instead of hidden: the
// Stepper matrix entry must render all three derived states.
//
// (typescript@7.0.2, the version this package's devDependency resolves to,
// no longer ships the classic compiler API `import ts from "typescript"` used
// to expect -- `lib/typescript.js` is gone and the "." export is a version
// stub -- so the gap is closed with a source scan plus type-level
// exhaustiveness instead of a compiler-API-driven scan.)
//
// The CSS-only utilities (rb-table/--interactive, rb-num, rb-muted, rb-pre,
// rb-log) have no React wrapper, so no render can emit them; they stay listed
// in contract.json (react: null) and are covered only by the styles suite. This
// test asserts they are NOT emitted, so `react: null` stays honest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DataTableColumn } from "./DataTable.js";
import type { ButtonProps, SemanticVariant } from "./index.js";
import * as UI from "./index.js";

interface Row {
  id: string;
  name: string;
  group: string;
  count: number;
}
const DATATABLE_ROWS: Row[] = [
  { id: "a", name: "Alpha", group: "runtime", count: 1 },
  { id: "b", name: "Bravo", group: "build", count: 2 },
];
const DATATABLE_COLUMNS: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name, sortValue: (r) => r.name },
  { key: "count", header: "Count", render: (r) => r.count, numeric: true },
];

// -- The render matrix -------------------------------------------------------
// Every export, rendered with every prop combination that can add an rb-* class
// (a variant, a size, a state, an optional label/title/actions). Each entry is
// tagged with its export name so the coverage test below can prove no export
// was left out. Composition counts: NavRail renders NavLinks, LinksIndex
// renders Cards + Badges -- rendering the parent emits the children's classes,
// exactly as a consumer gets them.

/** Compile-time exhaustiveness: `Missing` must be `never`, i.e. every member of the
 * union appears in the list. Widening the union without extending the list fails
 * `tsc --noEmit`, which the package test script runs before any test (#118). */
type AssertNever<T extends never> = T;

type ButtonVariant = Exclude<NonNullable<ButtonProps["variant"]>, "default">;
const BUTTON_VARIANTS = ["primary", "accent", "danger", "ghost"] as const satisfies readonly ButtonVariant[];
type _ButtonVariantsExhaustive = AssertNever<Exclude<ButtonVariant, (typeof BUTTON_VARIANTS)[number]>>;

const SEMANTIC = ["info", "success", "warning", "danger"] as const satisfies readonly SemanticVariant[];
type _SemanticExhaustive = AssertNever<Exclude<SemanticVariant, (typeof SEMANTIC)[number]>>;

const RENDERS: Array<{ component: string; el: ReactElement }> = [
  // Button: base, every colour variant (exhaustive -- see BUTTON_VARIANTS above), compact size, icon-only.
  { component: "Button", el: <UI.Button>Go</UI.Button> },
  ...BUTTON_VARIANTS.map((v) => ({ component: "Button", el: <UI.Button variant={v}>Go</UI.Button> })),
  { component: "Button", el: <UI.Button size="sm">Go</UI.Button> },
  { component: "Button", el: <UI.Button iconOnly aria-label="Close" /> },
  // Card: base and raised.
  { component: "Card", el: <UI.Card>c</UI.Card> },
  { component: "Card", el: <UI.Card raised>c</UI.Card> },
  // NavLink: resting and active.
  { component: "NavLink", el: <UI.NavLink href="#">home</UI.NavLink> },
  { component: "NavLink", el: <UI.NavLink href="#" active>home</UI.NavLink> },
  // NavRail: an active item exercises the composed NavLink active state too.
  {
    component: "NavRail",
    el: (
      <UI.NavRail
        items={[
          { id: "a", label: "A", href: "#a" },
          { id: "b", label: "B", href: "#b" },
        ]}
        activeId="a"
      />
    ),
  },
  // Form controls.
  { component: "Input", el: <UI.Input /> },
  { component: "Textarea", el: <UI.Textarea /> },
  { component: "Select", el: <UI.Select /> },
  { component: "Label", el: <UI.Label>l</UI.Label> },
  { component: "Field", el: <UI.Field>f</UI.Field> },
  // Choice controls: with a label they wrap in .rb-choice, without they don't.
  { component: "Checkbox", el: <UI.Checkbox /> },
  { component: "Checkbox", el: <UI.Checkbox label="Agree" /> },
  { component: "Radio", el: <UI.Radio label="One" /> },
  { component: "Switch", el: <UI.Switch label="On" /> },
  // Badge + Alert, per semantic variant (Alert also with a title).
  { component: "Badge", el: <UI.Badge>b</UI.Badge> },
  ...SEMANTIC.map((v) => ({ component: "Badge", el: <UI.Badge variant={v}>b</UI.Badge> })),
  { component: "Alert", el: <UI.Alert>a</UI.Alert> },
  ...SEMANTIC.map((v) => ({
    component: "Alert",
    el: (
      <UI.Alert variant={v} title="T">
        body
      </UI.Alert>
    ),
  })),
  // Progress + Spinner.
  { component: "Progress", el: <UI.Progress value={50} max={100} /> },
  { component: "Spinner", el: <UI.Spinner /> },
  // Dialog with a title and actions (its body wrapper is always emitted).
  {
    component: "Dialog",
    el: (
      <UI.Dialog open onClose={() => {}} title="T" actions={<button type="button">ok</button>}>
        body
      </UI.Dialog>
    ),
  },
  // Tabs: the first tab is active by default -> emits --active and the panel.
  {
    component: "Tabs",
    el: (
      <UI.Tabs
        items={[
          { id: "a", label: "A", content: "CA" },
          { id: "b", label: "B", content: "CB" },
        ]}
      />
    ),
  },
  // Stepper: three steps at current:1 emit all of complete/current/upcoming.
  {
    component: "Stepper",
    el: (
      <UI.Stepper
        steps={[
          { id: "1", label: "one" },
          { id: "2", label: "two" },
          { id: "3", label: "three" },
        ]}
        current={1}
      />
    ),
  },
  // DataTable: a sortable numeric column (-> rb-table, rb-num, rb-table__sort), grouped
  // (-> rb-table__group-row), and sticky (-> rb-table-scroll) in separate renders, matching
  // how the other multi-prop components above are split.
  {
    component: "DataTable",
    el: (
      <UI.DataTable columns={DATATABLE_COLUMNS} rows={DATATABLE_ROWS} rowKey={(r) => r.id} />
    ),
  },
  {
    component: "DataTable",
    el: (
      <UI.DataTable
        columns={DATATABLE_COLUMNS}
        rows={DATATABLE_ROWS}
        rowKey={(r) => r.id}
        groupBy={(r) => r.group}
      />
    ),
  },
  {
    component: "DataTable",
    el: (
      <UI.DataTable columns={DATATABLE_COLUMNS} rows={DATATABLE_ROWS} rowKey={(r) => r.id} sticky />
    ),
  },
  // Tabstrip: the first tab active by default -> emits --active; a badge on one tab -> emits
  // __badge too.
  {
    component: "Tabstrip",
    el: (
      <UI.Tabstrip
        tabs={[
          { id: "a", label: "A", badge: 3 },
          { id: "b", label: "B" },
        ]}
        selected="a"
        onSelect={() => {}}
        label="Example"
      />
    ),
  },
  // LinksIndex: a monitored link emits its composed Card + success Badge.
  {
    component: "LinksIndex",
    el: (
      <UI.LinksIndex
        categories={[{ id: "c", label: "C" }]}
        links={[
          { name: "N", urls: [{ label: "u", url: "https://example.test" }], category: "c", monitored: true },
        ]}
      />
    ),
  },
];

/** Every rb-* class across all `class="..."` attributes in the markup -- not
 * just the root element, since Dialog/Tabs/Stepper/Alert/NavRail emit classes
 * on children too. renderToStaticMarkup always double-quotes attributes, so a
 * `class="..."` match is exhaustive over its output. */
function rbClassesIn(markup: string): string[] {
  const out: string[] = [];
  for (const m of markup.matchAll(/class="([^"]*)"/g)) {
    for (const c of m[1].split(/\s+/)) if (c.startsWith("rb-")) out.push(c);
  }
  return out;
}

const EMITTED = new Set<string>();
for (const { el } of RENDERS) {
  for (const c of rbClassesIn(renderToStaticMarkup(el))) EMITTED.add(c);
}

// -- #118: close the matrix gap -- source-literal scan + registered dynamic
// templates, no compiler API (typescript@7.0.2 no longer ships one; see the
// plan's decision 3). Every static rb-* class in the component sources must be
// exercised by the matrix (the #48 counterexample -- `rb-btn--lg` behind a
// size value RENDERS never renders -- fails here), and every dynamic
// `rb-...${x}` template must be registered with the mechanism that keeps its
// union exhaustive (the typed lists above).
//
// The scan reads RAW source -- no comment stripping. Two rounds of review
// tried progressively more careful character-by-character comment strippers
// (round 1's naive global regex silently deleted real class-bearing code
// sitting between an innocuous "//" comment and a later real comment; round
// 2's real tokenizer fixed that but still mis-tokenized a `//`-terminated
// regex literal ending in an escaped slash, e.g. LinksIndex.tsx's own
// `/^(https?:)?\/\//i`, silently deleting the code after it -- round-3 review
// finding on #118). A hand-rolled JS/TSX lexer is real-compiler-API territory,
// which #118 exists specifically to avoid (see decision 3). The constraint
// this scan enforces instead needs no parser: a BARE quoted rb-* name --
// `"rb-foo"`, `'rb-foo'`, or `` `rb-foo` ``, the ENTIRE quoted content and
// nothing else -- counts as a class the component can emit, wherever it
// appears in a non-test source file, comments included. A prose mention of a
// class inside a comment is written with a leading dot, `` `.rb-foo` `` or
// `.rb-foo`, exactly as every real comment in this package's sources already
// does (DataTable.tsx, Tabstrip.tsx, LinksIndex.tsx, Card.tsx) -- the dot
// means the quoted content is never a bare `rb-foo` match, so it is invisible
// to the scan by construction, not by parsing. If a comment ever needs fixing
// because this scan flags it, the fix is rewording that comment to the dotted
// form, never adding parser sophistication here.
const SRC = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILES = readdirSync(SRC).filter(
  (f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== "test-dom.ts",
);
const DYNAMIC_TEMPLATES: Record<string, string> = {
  "rb-btn--": "variant", // Button: exported union, exhaustive via BUTTON_VARIANTS
  "rb-badge--": "variant", // Badge: SemanticVariant, exhaustive via SEMANTIC
  "rb-alert--": "variant", // Alert: same
  "rb-stepper--": "state", // Stepper: local union derived from index arithmetic -- the residual; all three states rendered, asserted below
};

function scanSources() {
  const literals = new Set<string>();
  const templates: Record<string, string> = {};
  for (const f of SOURCE_FILES) {
    const src = readFileSync(join(SRC, f), "utf-8");
    for (const m of src.matchAll(/(["'`])(rb-[\w-]+)\1/g)) literals.add(m[2]);
    // Every backtick literal that mentions an rb-* class next to an
    // interpolation must match the STRICT single-interpolation-at-the-end
    // shape exactly -- checked against the whole literal, not found via a
    // regex that simply skips anything else. A trailing literal after the
    // interpolation (`` `rb-card--${tone}-tint` ``) used to be invisible to
    // both this scan and the static-literal one above -- a fully orphaned,
    // unstyled class shipping with neither test noticing (round-1 review
    // finding on #118, the same shape #118 itself exists to close). Failing
    // loudly here, rather than silently skipping, is deliberate: a shape the
    // scan can't enumerate must block until it is rewritten or the scan is
    // extended for it -- mirroring the original compiler-API design's
    // rejection of a non-string-literal-union interpolation.
    for (const m of src.matchAll(/`([^`]*)`/g)) {
      const content = m[1];
      if (!/rb-[\w-]*\$\{/.test(content)) continue;
      const strict = content.match(/^(rb-[\w-]+)\$\{([^}]+)\}$/);
      assert.ok(
        strict,
        `${basename(f)}: dynamic template \`${content}\` uses an rb-* class in a shape this scan can't enumerate (only a plain "rb-<prefix>\${expr}" template, nothing before or after, is supported) -- rewrite it to that shape or extend scanSources()`,
      );
      templates[strict[1]] = strict[2].trim();
    }
  }
  return { literals, templates };
}

test("scanSources's literal regex sees a bare quoted rb-* name anywhere, including inside a comment, but not a dotted prose mention (#118)", () => {
  // Not scanSources() itself (that reads real files by name) -- the same
  // literal regex it applies, exercised directly against synthetic input to
  // pin the no-parser rule this test's own header documents: a comment
  // naming a class must use the dotted form to stay invisible to the scan.
  //
  // Three tries at a character-by-character comment stripper each broke a
  // different way: round 1's naive global regex silently deleted real code
  // between an innocuous "//" comment and a later real one; round 2's real
  // tokenizer fixed that but still mis-tokenized a "//"-terminated regex
  // literal ending in an escaped slash (LinksIndex.tsx's own
  // `/^(https?:)?\/\//i`), silently deleting the code after it (round-3
  // review finding). Scanning raw, unstripped source instead needs no parser
  // and cannot have this class of false negative -- the tradeoff, accepted
  // on purpose, is that a BARE quoted mention in a comment now counts too.
  const literalRe = /(["'`])(rb-[\w-]+)\1/g;

  // A dotted prose mention, exactly the style every real comment in this
  // package already uses -- invisible to the scan because the quoted content
  // is never a bare "rb-foo" (the leading dot breaks the match), not because
  // anything parsed "this is a comment".
  assert.deepEqual([..."/** mentions `.rb-nav-rail--compact` in prose */".matchAll(literalRe)], []);

  // A bare quoted mention DOES count, deliberately, even inside a comment --
  // this is the documented cost of dropping the tokenizer. Rewording such a
  // comment to the dotted form (above) is the fix, not more parsing here.
  const bare = [..."// see `rb-nav-rail--compact` for details".matchAll(literalRe)];
  assert.equal(bare.length, 1);
  assert.equal(bare[0][2], "rb-nav-rail--compact");

  // The regex-literal shape that defeated round 2's tokenizer is inert here:
  // with no comment/string state machine to confuse, a real class literal
  // sitting after such a regex on the same line is seen correctly.
  const afterRegex = 'const isExternal = /^(https?:)?\\/\\//i.test(u); const c = "rb-should-be-visible";';
  const found = [...afterRegex.matchAll(literalRe)].map((m) => m[2]);
  assert.deepEqual(found, ["rb-should-be-visible"]);
});

test("every static rb-* class literal in the component sources is emitted by the render matrix (#118)", () => {
  const { literals } = scanSources();
  const unexercised = [...literals].filter((c) => !EMITTED.has(c)).sort();
  assert.deepEqual(unexercised, [], `in source but never rendered by RENDERS: ${unexercised.join(", ")} -- add the prop value to the matrix`);
});

test("every dynamic rb-* template in the sources is registered with an exhaustiveness mechanism (#118)", () => {
  const { templates } = scanSources();
  assert.deepEqual(templates, DYNAMIC_TEMPLATES, "a new `rb-...${x}` template must be registered here together with a typed, exhaustive value list for its union");
});

test("the Stepper matrix entry renders all three derived states (#118 residual)", () => {
  for (const s of ["complete", "current", "upcoming"]) assert.ok(EMITTED.has(`rb-stepper--${s}`), `rb-stepper--${s} not emitted`);
});

// -- contract.json's declared class set, split by whether React backs it ------
interface ContractComponent {
  react: string | string[] | null;
  classes: string[];
}
const contract = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../../styles/contract.json", import.meta.url)), "utf-8"),
) as { components: Record<string, ContractComponent> };

const contractReact = new Set<string>();
const contractCssOnly = new Set<string>();
for (const def of Object.values(contract.components)) {
  const target = def.react !== null ? contractReact : contractCssOnly;
  for (const c of def.classes) target.add(c);
}

test("every value export is exercised by the render matrix", () => {
  // If a new export is added but not rendered here, its classes never enter the
  // derivation -- fail loudly rather than silently under-deriving. (cx is a
  // helper, not a component, and emits no markup.)
  const rendered = new Set(RENDERS.map((r) => r.component));
  const missing = Object.keys(UI)
    .filter((k) => k !== "cx" && !rendered.has(k))
    .sort();
  assert.deepEqual(missing, [], `exports not rendered by the matrix: ${missing.join(", ")}`);
});

test("React emits no rb-* class outside contract.json's React-backed set", () => {
  // Ground-truth direction: a class a component renders must be declared under
  // some React-backed component in contract.json, or no theme is required to
  // style it and the data-rb-style guarantee silently breaks for it.
  const undocumented = [...EMITTED].filter((c) => !contractReact.has(c)).sort();
  assert.deepEqual(
    undocumented,
    [],
    `emitted by @rackbops/ui-react but not in any contract.json React-backed component: ${undocumented.join(
      ", ",
    )} -- add it to that component's classes (or it's a typo in the component)`,
  );
});

test("every React-backed class in contract.json is emitted by some render", () => {
  // Reverse direction: a class listed under a React-backed component that no
  // render produces is a stale or mistyped contract entry -- it makes every
  // theme carry a rule nothing renders.
  const unreached = [...contractReact].filter((c) => !EMITTED.has(c)).sort();
  assert.deepEqual(
    unreached,
    [],
    `listed under a React-backed component in contract.json but no render emits it: ${unreached.join(
      ", ",
    )} -- remove the stale entry, or add the prop combination that emits it`,
  );
});

test("classes marked react:null in contract.json are emitted by no component", () => {
  // Keeps the react:null annotation honest -- a CSS-only utility that a React
  // component actually emits should be reclassified with a real react target.
  const misclassified = [...EMITTED].filter((c) => contractCssOnly.has(c)).sort();
  assert.deepEqual(
    misclassified,
    [],
    `emitted by React but marked react:null in contract.json: ${misclassified.join(
      ", ",
    )} -- give it a real react target`,
  );
});
