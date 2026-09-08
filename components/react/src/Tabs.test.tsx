import { test } from "node:test";
import assert from "node:assert/strict";
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
