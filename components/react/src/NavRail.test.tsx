import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { NavRail } from "./NavRail.js";

const items = [
  { id: "overview", label: "Overview", href: "/overview" },
  { id: "artifacts", label: "Artifacts", href: "/artifacts" },
  { id: "issues", label: "Issues", href: "/issues" },
];

test("renders the rb-nav-rail container as a nav landmark", () => {
  const html = renderToStaticMarkup(<NavRail items={items} />);
  assert.match(html, /<nav class="rb-nav-rail"/);
});

test("renders one NavLink per item, in order", () => {
  const html = renderToStaticMarkup(<NavRail items={items} />);
  const hrefs = [...html.matchAll(/<a[^>]*href="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, ["/overview", "/artifacts", "/issues"]);
});

/** Attribute order isn't guaranteed (aria-current only renders on the active
 * link, shifting where class= falls) -- pull each <a ...> tag out whole, then
 * read class/href from within it independently of order. */
function anchorTags(html: string): string[] {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
}
function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
}

test("activeId marks the matching item active, no second active-state convention", () => {
  const html = renderToStaticMarkup(<NavRail items={items} activeId="artifacts" />);
  const tags = anchorTags(html);
  const artifacts = tags.find((t) => attr(t, "href") === "/artifacts");
  const overview = tags.find((t) => attr(t, "href") === "/overview");
  assert.ok(attr(artifacts ?? "", "class")?.split(" ").includes("rb-link--active"), "the matching item is active");
  assert.ok(
    !attr(overview ?? "", "class")?.split(" ").includes("rb-link--active"),
    "non-matching items are not active",
  );
});

test("no activeId (or one matching nothing) marks no item active", () => {
  const html = renderToStaticMarkup(<NavRail items={items} activeId="not-an-item" />);
  assert.ok(!html.includes("rb-link--active"));
});

test("aria-current tracks the active item, via NavLink's own contract", () => {
  const html = renderToStaticMarkup(<NavRail items={items} activeId="issues" />);
  const links = [...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>/g)];
  const issues = links.find(([, href]) => href === "/issues")?.[0];
  const overview = links.find(([, href]) => href === "/overview")?.[0];
  assert.match(issues ?? "", /aria-current="page"/);
  assert.doesNotMatch(overview ?? "", /aria-current/);
});

test("forwards className after rb-nav-rail, and other props onto the nav element", () => {
  const html = renderToStaticMarkup(
    <NavRail items={items} className="mine" aria-label="Primary" />,
  );
  assert.match(html, /<nav class="rb-nav-rail mine" aria-label="Primary"/);
});
