import { test } from "node:test";
import assert from "node:assert/strict";
import { useState, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Tabstrip, type TabstripTab } from "./Tabstrip.js";

const TABS: TabstripTab[] = [
  { id: "a", label: "Alpha" },
  { id: "b", label: "Beta" },
  { id: "c", label: "Gamma" },
];

test("renders one tab per entry, marking only the selected one", () => {
  const html = renderToStaticMarkup(
    <Tabstrip tabs={TABS} selected="a" onSelect={() => {}} label="Example" />,
  );
  const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  assert.equal(buttons.length, 3);
  assert.match(buttons[0] ?? "", /aria-selected="true"/, "Alpha (selected)");
  assert.match(buttons[1] ?? "", /aria-selected="false"/, "Beta (not selected)");
});

test("the strip is a single tab stop -- only the selected tab is reachable by Tab", () => {
  const html = renderToStaticMarkup(
    <Tabstrip tabs={TABS} selected="a" onSelect={() => {}} label="Example" />,
  );
  const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  assert.equal(buttons.length, 3);
  assert.match(buttons[0] ?? "", /tabindex="0"/);
  assert.match(buttons[0] ?? "", /aria-selected="true"/);
  assert.match(buttons[1] ?? "", /tabindex="-1"/);
  assert.match(buttons[1] ?? "", /aria-selected="false"/);
});

test("the active tab gets rb-tabstrip__tab--active, others don't", () => {
  const html = renderToStaticMarkup(
    <Tabstrip tabs={TABS} selected="b" onSelect={() => {}} label="Example" />,
  );
  const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  assert.doesNotMatch(buttons[0] ?? "", /rb-tabstrip__tab--active/);
  assert.match(buttons[1] ?? "", /class="rb-tabstrip__tab rb-tabstrip__tab--active"/);
});

test("the tablist is named for assistive tech", () => {
  const html = renderToStaticMarkup(
    <Tabstrip tabs={TABS} selected="a" onSelect={() => {}} label="Example" />,
  );
  assert.match(html, /role="tablist" aria-label="Example"/);
});

test("a badge renders beside its label", () => {
  const html = renderToStaticMarkup(
    <Tabstrip
      tabs={[{ id: "a", label: "Alpha", badge: 7 }]}
      selected="a"
      onSelect={() => {}}
      label="Example"
    />,
  );
  assert.match(html, /Alpha<span class="rb-tabstrip__badge">7<\/span>/);
});

test("a zero badge still renders -- it is a real count, not an absent one", () => {
  // `badge && ...` would hide 0, which is exactly the count a user most wants to see on an
  // empty tab.
  const html = renderToStaticMarkup(
    <Tabstrip
      tabs={[{ id: "a", label: "Alpha", badge: 0 }]}
      selected="a"
      onSelect={() => {}}
      label="Example"
    />,
  );
  assert.match(html, /rb-tabstrip__badge">0</);
});

test("no badge prop renders no rb-tabstrip__badge span", () => {
  const html = renderToStaticMarkup(
    <Tabstrip tabs={TABS} selected="a" onSelect={() => {}} label="Example" />,
  );
  assert.ok(!html.includes("rb-tabstrip__badge"));
});

test("a selected id not present in tabs still leaves the strip reachable by Tab", () => {
  // Review round 1 (Kenzen, K4-8b), MEDIUM: with tabIndex tied directly to isSelected, an
  // unmatched `selected` gave EVERY tab tabIndex=-1, so a keyboard user tabbing the page skipped
  // the tablist entirely -- a worse failure than the inert arrow keys below. Exactly one tab
  // stop must survive.
  const html = renderToStaticMarkup(
    <Tabstrip tabs={TABS} selected="gone" onSelect={() => {}} label="Example" />,
  );
  const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
  const stops = buttons.filter((b) => b.includes('tabindex="0"'));
  assert.equal(stops.length, 1);
  assert.match(buttons[0] ?? "", /tabindex="0"/, "falls back to the first tab");
});

// The tests below need a real client render -- selection only changes in response to a click or
// keydown, which a rendered HTML string can't simulate. See test-dom.ts for what installing
// jsdom here involves.
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
    rerender: (next: ReactElement) => flushSync(() => root.render(next)),
    cleanup: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
}

/** A controlled host, since Tabstrip deliberately holds no state of its own. */
function Harness({ initial = "a" }: { initial?: string }) {
  const [selected, setSelected] = useState(initial);
  return <Tabstrip tabs={TABS} selected={selected} onSelect={setSelected} label="Example" />;
}

function tabNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find((b) =>
    (b.textContent ?? "").includes(name),
  );
  assert.ok(button, `no tab named ${name}`);
  return button as HTMLButtonElement;
}

function clickTab(container: HTMLElement, name: string) {
  flushSync(() => {
    tabNamed(container, name).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

function pressKey(container: HTMLElement, key: string) {
  const tablist = container.querySelector('[role="tablist"]');
  assert.ok(tablist, "no tablist rendered");
  flushSync(() => {
    tablist?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
}

test("clicking a tab reports it", () => {
  let reported: string | undefined;
  const { container, cleanup } = mount(
    <Tabstrip tabs={TABS} selected="a" onSelect={(id) => { reported = id; }} label="Example" />,
  );
  clickTab(container, "Beta");
  assert.equal(reported, "b");
  cleanup();
});

test("arrow keys move between tabs and wrap at both ends", () => {
  const { container, cleanup } = mount(<Harness />);

  pressKey(container, "ArrowRight");
  assert.equal(tabNamed(container, "Beta").getAttribute("aria-selected"), "true");

  pressKey(container, "ArrowLeft");
  assert.equal(tabNamed(container, "Alpha").getAttribute("aria-selected"), "true");

  // Wraps backwards off the first tab to the last, rather than doing nothing.
  pressKey(container, "ArrowLeft");
  assert.equal(tabNamed(container, "Gamma").getAttribute("aria-selected"), "true");

  // ...and forwards off the last back to the first.
  pressKey(container, "ArrowRight");
  assert.equal(tabNamed(container, "Alpha").getAttribute("aria-selected"), "true");
  cleanup();
});

test("Home and End jump to the first and last tab", () => {
  const { container, cleanup } = mount(<Harness initial="b" />);

  pressKey(container, "End");
  assert.equal(tabNamed(container, "Gamma").getAttribute("aria-selected"), "true");

  pressKey(container, "Home");
  assert.equal(tabNamed(container, "Alpha").getAttribute("aria-selected"), "true");
  cleanup();
});

test("an unrelated key changes nothing", () => {
  let calls = 0;
  const { container, cleanup } = mount(
    <Tabstrip tabs={TABS} selected="a" onSelect={() => { calls++; }} label="Example" />,
  );
  pressKey(container, "x");
  assert.equal(calls, 0);
  cleanup();
});

test("a selected id not present in tabs leaves the keyboard handler inert", () => {
  // Defensive: a caller mid-reload could pass a stale id. Moving from "nowhere" would otherwise
  // land on an arbitrary tab.
  let calls = 0;
  const { container, cleanup } = mount(
    <Tabstrip tabs={TABS} selected="gone" onSelect={() => { calls++; }} label="Example" />,
  );
  pressKey(container, "ArrowRight");
  assert.equal(calls, 0);
  cleanup();
});
