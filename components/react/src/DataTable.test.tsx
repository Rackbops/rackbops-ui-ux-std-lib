import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { DataTable, type DataTableColumn } from "./DataTable.js";

interface Row {
  id: string;
  name: string;
  group: string;
  count: number;
}

const ROWS: Row[] = [
  { id: "a", name: "Bravo", group: "runtime", count: 2 },
  { id: "b", name: "Alpha", group: "runtime", count: 5 },
  { id: "c", name: "Charlie", group: "build", count: 1 },
];

const COLUMNS: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name, sortValue: (r) => r.name },
  {
    key: "count",
    header: "Count",
    render: (r) => r.count,
    numeric: true,
    sortValue: (r) => r.count,
  },
];

test("renders every row and column", () => {
  const html = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
  assert.ok(html.includes("Bravo"));
  assert.ok(html.includes("Alpha"));
  assert.ok(html.includes("Charlie"));
});

test("renders the empty message instead of a table when there are no rows", () => {
  const html = renderToStaticMarkup(
    <DataTable columns={COLUMNS} rows={[]} rowKey={(r) => r.id} emptyMessage="Nothing here." />,
  );
  assert.ok(html.includes("Nothing here."));
  assert.ok(!html.includes("<table"));
});

test("a numeric column applies rb-num on its cells", () => {
  const html = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
  assert.match(html, /<td class="rb-num">2<\/td>/);
});

test("a column with no sortValue renders as plain text, not a button", () => {
  const unsortable: DataTableColumn<Row>[] = [{ key: "name", header: "Name", render: (r) => r.name }];
  const html = renderToStaticMarkup(<DataTable columns={unsortable} rows={ROWS} rowKey={(r) => r.id} />);
  assert.ok(!html.includes("<button"));
});

test("groupBy renders a labelled group row per distinct group, in groupOrder", () => {
  const html = renderToStaticMarkup(
    <DataTable
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(r) => r.id}
      groupBy={(r) => r.group}
      groupOrder={["runtime", "build"]}
    />,
  );
  const runtimeAt = html.indexOf("runtime");
  const buildAt = html.indexOf("build");
  assert.ok(runtimeAt >= 0 && buildAt >= 0, "both group labels render");
  assert.ok(runtimeAt < buildAt, "groups render in groupOrder");
});

test("a group not listed in groupOrder is appended after, alphabetically", () => {
  const rows: Row[] = [...ROWS, { id: "d", name: "Delta", group: "ci", count: 9 }];
  const html = renderToStaticMarkup(
    <DataTable
      columns={COLUMNS}
      rows={rows}
      rowKey={(r) => r.id}
      groupBy={(r) => r.group}
      groupOrder={["runtime"]}
    />,
  );
  const order = ["runtime", "build", "ci"].map((label) => html.indexOf(`>${label}<`));
  assert.ok(order.every((i) => i >= 0), "all three group labels render");
  assert.ok(order[0] !== undefined && order[1] !== undefined && order[2] !== undefined && order[0] < order[1] && order[1] < order[2], "runtime (listed) first, then build/ci alphabetically");
});

test("aria-sort is omitted on every header when unsorted", () => {
  const html = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
  assert.ok(!html.includes("aria-sort"));
})

test("#175: every sortable header shows an affordance -- the neutral glyph when inactive, the arrow when active", () => {
  // "name" pre-sorted (active): arrow, no neutral glyph. "count" is sortable but inactive: the
  // neutral glyph, no arrow. Both are real DataTableColumn entries with a sortValue -- this is
  // not the unsortable case (already covered by "renders as plain text, not a button" above).
  const html = renderToStaticMarkup(
    <DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} defaultSortKey="name" />,
  );
  assert.equal(
    (html.match(/rb-table__sort-icon/g) ?? []).length,
    1,
    "exactly one inactive sortable header (Count) carries the neutral-glyph class",
  );
  assert.match(html, /Count<span class="rb-table__sort-icon" aria-hidden="true"> ⇅<\/span>/);
  assert.doesNotMatch(html, /Name<span class="rb-table__sort-icon"/);
  assert.match(html, /Name<span aria-hidden="true"> ▲<\/span>/);
});

test("defaultSortKey/defaultSortDirection pre-sorts without any click", () => {
  const html = renderToStaticMarkup(
    <DataTable
      columns={COLUMNS}
      rows={ROWS}
      rowKey={(r) => r.id}
      defaultSortKey="name"
      defaultSortDirection="asc"
    />,
  );
  const alphaAt = html.indexOf("Alpha");
  const bravoAt = html.indexOf("Bravo");
  const charlieAt = html.indexOf("Charlie");
  assert.ok(alphaAt < bravoAt && bravoAt < charlieAt, "pre-sorted ascending by name");
  assert.match(html, /aria-sort="ascending"/);
});

test("sticky wraps the table in rb-table-scroll; not sticky renders no wrapper", () => {
  const stickyHtml = renderToStaticMarkup(
    <DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} sticky />,
  );
  assert.match(stickyHtml, /^<div class="rb-table-scroll"><table class="rb-table"/);

  const plainHtml = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
  assert.ok(!plainHtml.includes("rb-table-scroll"));
});

const WIDTH_COLUMNS: DataTableColumn<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name, width: "20%" },
  { key: "count", header: "Count", render: (r) => r.count, numeric: true },
];

test("columns with a width render a colgroup ahead of thead and switch the table to fixed layout", () => {
  const html = renderToStaticMarkup(<DataTable columns={WIDTH_COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
  // One <col> per column in column order -- a column without a width gets a bare <col> so it
  // shares the remaining space -- and the table itself goes fixed so the widths are honoured.
  assert.match(
    html,
    /^<table class="rb-table" style="table-layout:fixed"><colgroup><col style="width:20%"\/><col\/><\/colgroup><thead>/,
  );
});

test("no column declares a width: no colgroup and no inline style, exactly as before", () => {
  const html = renderToStaticMarkup(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
  assert.match(html, /^<table class="rb-table"><thead>/);
  assert.ok(!html.includes("<colgroup"));
});

// The tests below need a real client render -- sort state only changes in response to a click,
// which a rendered HTML string can't simulate. See test-dom.ts for what installing jsdom here
// involves.
await import("./test-dom.js");
const { createRoot } = await import("react-dom/client");
const { flushSync } = await import("react-dom");

function mount(el: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(el));
  return {
    container,
    cleanup: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
}

function clickButton(container: HTMLElement, name: RegExp) {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    name.test(b.textContent ?? ""),
  );
  assert.ok(button, `no button matching ${name}`);
  flushSync(() => {
    button?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

test("clicking a sortable header sorts ascending, then descending on a second click", () => {
  const { container, cleanup } = mount(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
  const nameCells = () =>
    Array.from(container.querySelectorAll("tbody tr td:first-child")).map((td) => td.textContent);

  clickButton(container, /Name/);
  assert.deepEqual(nameCells(), ["Alpha", "Bravo", "Charlie"]);

  clickButton(container, /Name/);
  assert.deepEqual(nameCells(), ["Charlie", "Bravo", "Alpha"]);
  cleanup();
});

test("a numeric column sorts numerically, not lexicographically", () => {
  const { container, cleanup } = mount(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
  clickButton(container, /Count/);
  const counts = Array.from(container.querySelectorAll("tbody tr td:last-child")).map(
    (td) => td.textContent,
  );
  assert.deepEqual(counts, ["1", "2", "5"]);
  cleanup();
});

test("sorting within a grouped table sorts each group independently, not across groups", () => {
  const { container, cleanup } = mount(
    <DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} groupBy={(r) => r.group} />,
  );
  clickButton(container, /Name/);
  // runtime group (Bravo, Alpha) sorts to Alpha, Bravo; build group (Charlie) is unaffected, and
  // the two groups' rows never mix.
  const rowTexts = Array.from(container.querySelectorAll("tbody > tr")).map((tr) => tr.textContent);
  assert.deepEqual(rowTexts, ["build", "Charlie1", "runtime", "Alpha5", "Bravo2"]);
  cleanup();
});

test("aria-sort is set on a sorted header when not grouped, omitted when grouped", () => {
  const flat = mount(<DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} />);
  clickButton(flat.container, /Name/);
  assert.equal(flat.container.querySelector("th[aria-sort]")?.getAttribute("aria-sort"), "ascending");
  flat.cleanup();

  const grouped = mount(
    <DataTable columns={COLUMNS} rows={ROWS} rowKey={(r) => r.id} groupBy={(r) => r.group} />,
  );
  clickButton(grouped.container, /Name/);
  assert.equal(grouped.container.querySelector("th[aria-sort]"), null);
  grouped.cleanup();
});
