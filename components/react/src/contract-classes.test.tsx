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
// The matrix (RENDERS) is maintained by hand, so this does not by itself prove
// every prop VALUE is covered: a class reachable only through a prop the matrix
// omits is caught not here but downstream -- by the reverse-direction check
// once it reaches contract.json, or by the styles closed-world "no undocumented
// class" check once any theme styles it. A class that is emitted, in no theme's
// CSS, and absent from contract.json is the residual gap; keep RENDERS
// exhaustive as class-adding props are added.
//
// The CSS-only utilities (rb-table/--interactive, rb-num, rb-muted, rb-pre,
// rb-log) have no React wrapper, so no render can emit them; they stay listed
// in contract.json (react: null) and are covered only by the styles suite. This
// test asserts they are NOT emitted, so `react: null` stays honest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { DataTableColumn } from "./DataTable.js";
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
const SEMANTIC = ["info", "success", "warning", "danger"] as const;

const RENDERS: Array<{ component: string; el: ReactElement }> = [
  // Button: base, each colour variant, compact size, icon-only.
  { component: "Button", el: <UI.Button>Go</UI.Button> },
  { component: "Button", el: <UI.Button variant="primary">Go</UI.Button> },
  { component: "Button", el: <UI.Button variant="accent">Go</UI.Button> },
  { component: "Button", el: <UI.Button variant="danger">Go</UI.Button> },
  { component: "Button", el: <UI.Button variant="ghost">Go</UI.Button> },
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
