import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Tabs } from "./Tabs.js";

const items = [
  { id: "a", label: "A", content: "Content A" },
  { id: "b", label: "B", content: "Content B" },
];

/** The opening tag of the role="tablist" element -- the themed .rb-tabs div, distinct from
 * the outer structural wrapper that also holds the tabpanels. */
function tablistTag(html: string): string {
  return html.match(/<div[^>]*role="tablist"[^>]*>/)?.[0] ?? "";
}
// \b before the name, so "id" doesn't match inside "data-testid".
function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

test("default renders rb-tabs on the tablist, and no class on the outer wrapper", () => {
  const html = renderToStaticMarkup(<Tabs items={items} />);
  assert.match(html, /^<div><div class="rb-tabs" role="tablist"/, "outer wrapper carries no class");
  assert.equal(attr(tablistTag(html), "class"), "rb-tabs");
});

test("forwards className after rb-tabs, and arbitrary props, onto the tablist -- not the outer wrapper", () => {
  const html = renderToStaticMarkup(
    <Tabs items={items} className="mine" aria-label="Settings" data-testid="tabs" id="settings-tabs" />,
  );
  const tag = tablistTag(html);
  assert.equal(attr(tag, "class"), "rb-tabs mine", "className is appended last");
  assert.equal(attr(tag, "aria-label"), "Settings", "gives the tablist an accessible name");
  assert.equal(attr(tag, "data-testid"), "tabs", "gives the tablist a test hook");
  assert.equal(attr(tag, "id"), "settings-tabs");
  assert.match(html, /^<div><div/, "the outer wrapper stays a bare <div>, none of this lands there");
});

// The tests below need a real client render -- the selection only changes in response to a
// click, a keydown, or a controlled parent re-rendering with a new activeId, none of which a
// rendered HTML string can simulate. See test-dom.ts for what installing jsdom here involves.
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
    // Kept so a test can play the controlled parent: re-render with a new activeId.
    root,
    cleanup: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
}

/** Text of the one tab carrying aria-selected="true"; fails unless there is exactly one. */
function selectedTab(container: HTMLElement): string {
  const selected = Array.from(container.querySelectorAll('[role="tab"][aria-selected="true"]'));
  assert.equal(selected.length, 1, "exactly one tab is selected");
  return selected[0]?.textContent ?? "";
}

function tabNamed(container: HTMLElement, name: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll("button")).find(
    (b) => (b.textContent ?? "") === name,
  );
  assert.ok(button, `no tab named ${name}`);
  return button as HTMLButtonElement;
}

function clickTab(container: HTMLElement, name: string) {
  flushSync(() => {
    tabNamed(container, name).dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

/** Tabs attaches onKeyDown to each tab button (not the tablist), so the key goes to a tab. */
function pressKeyOn(container: HTMLElement, name: string, key: string) {
  flushSync(() => {
    tabNamed(container, name).dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
    );
  });
}

test("controlled: aria-selected follows activeId across parent re-renders", () => {
  const { container, root, cleanup } = mount(<Tabs items={items} activeId="b" />);
  assert.equal(selectedTab(container), "B");

  flushSync(() => root.render(<Tabs items={items} activeId="a" />));
  assert.equal(selectedTab(container), "A");
  cleanup();
});

test("controlled: ArrowRight calls onChange with the next id and leaves aria-selected unchanged until the parent re-renders", () => {
  const calls: string[] = [];
  const onChange = (id: string) => {
    calls.push(id);
  };
  const { container, root, cleanup } = mount(<Tabs items={items} activeId="a" onChange={onChange} />);

  pressKeyOn(container, "A", "ArrowRight");
  assert.deepEqual(calls, ["b"]);
  assert.equal(selectedTab(container), "A", "the selection waits for the parent");
  assert.equal(
    document.activeElement,
    tabNamed(container, "B"),
    "the roving focus moved even though the selection waited",
  );

  flushSync(() => root.render(<Tabs items={items} activeId="b" onChange={onChange} />));
  assert.equal(selectedTab(container), "B");
  cleanup();
});

test("controlled: a click calls onChange and does not change the selection by itself", () => {
  const calls: string[] = [];
  const { container, cleanup } = mount(
    <Tabs items={items} activeId="a" onChange={(id) => { calls.push(id); }} />,
  );

  clickTab(container, "B");
  assert.deepEqual(calls, ["b"]);
  assert.equal(selectedTab(container), "A");
  cleanup();
});

test("controlled: an activeId matching no item selects the first tab", () => {
  const { container, cleanup } = mount(<Tabs items={items} activeId="zzz" />);
  assert.equal(selectedTab(container), "A");
  assert.equal(container.querySelectorAll('[aria-selected="true"]').length, 1);
  cleanup();
});

test("uncontrolled: onChange also fires and the selection updates internally", () => {
  const calls: string[] = [];
  const { container, cleanup } = mount(<Tabs items={items} onChange={(id) => { calls.push(id); }} />);

  clickTab(container, "B");
  assert.deepEqual(calls, ["b"]);
  assert.equal(selectedTab(container), "B");
  cleanup();
});

test("uncontrolled: defaultId still picks the initial tab and is ignored once activeId is set", () => {
  const alone = mount(<Tabs items={items} defaultId="b" />);
  assert.equal(selectedTab(alone.container), "B");
  alone.cleanup();

  const overridden = mount(<Tabs items={items} defaultId="b" activeId="a" />);
  assert.equal(selectedTab(overridden.container), "A", "activeId wins over defaultId");
  overridden.cleanup();
});

const threeItems = [
  { id: "a", label: "A", content: "Content A" },
  { id: "b", label: "B", content: "Content B" },
  { id: "c", label: "C", content: "Content C" },
];

test("controlled: consecutive ArrowRights advance correctly even when the parent never commits the new activeId", () => {
  // Review round 1, MAJOR: computing the next index from `activeId` (rather than from the tab
  // that actually received the keydown) got stuck repeating the same "next" tab whenever a
  // controlled parent doesn't re-render synchronously after onChange -- a router transition or
  // a debounce, exactly the use case activeId's own JSDoc advertises. This parent ignores
  // onChange entirely (the worst case: activeId never changes), which must not stop each
  // keypress from advancing from wherever focus actually is.
  const calls: string[] = [];
  const { container, cleanup } = mount(
    <Tabs items={threeItems} activeId="a" onChange={(id) => { calls.push(id); }} />,
  );
  pressKeyOn(container, "A", "ArrowRight");
  pressKeyOn(container, "B", "ArrowRight");
  assert.deepEqual(calls, ["b", "c"], "each press advances from the focused tab, not a stale activeId");
  cleanup();
});

test("controlled: ArrowLeft, ArrowUp, ArrowDown, Home and End all call onChange with the correct id", () => {
  const calls: string[] = [];
  const onChange = (id: string) => {
    calls.push(id);
  };

  const left = mount(<Tabs items={threeItems} activeId="b" onChange={onChange} />);
  pressKeyOn(left.container, "B", "ArrowLeft");
  left.cleanup();

  const up = mount(<Tabs items={threeItems} activeId="b" onChange={onChange} />);
  pressKeyOn(up.container, "B", "ArrowUp");
  up.cleanup();

  const down = mount(<Tabs items={threeItems} activeId="b" onChange={onChange} />);
  pressKeyOn(down.container, "B", "ArrowDown");
  down.cleanup();

  const home = mount(<Tabs items={threeItems} activeId="c" onChange={onChange} />);
  pressKeyOn(home.container, "C", "Home");
  home.cleanup();

  const end = mount(<Tabs items={threeItems} activeId="a" onChange={onChange} />);
  pressKeyOn(end.container, "A", "End");
  end.cleanup();

  assert.deepEqual(calls, ["a", "a", "c", "a", "c"], "Left->a, Up->a (both 'previous'), Down->c (same as Right), Home->a, End->c");
});

test("an unrelated key (Tab, Enter) does not call onChange", () => {
  const calls: string[] = [];
  const { container, cleanup } = mount(
    <Tabs items={items} activeId="a" onChange={(id) => { calls.push(id); }} />,
  );
  pressKeyOn(container, "A", "Tab");
  pressKeyOn(container, "A", "Enter");
  assert.deepEqual(calls, []);
  cleanup();
});
