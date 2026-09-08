import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { LinksIndex, type LinkCategory, type LinkItem } from "./LinksIndex.js";

const categories: LinkCategory[] = [
  { id: "apps", label: "Applications" },
  { id: "infra", label: "Infrastructure" },
];
const links: LinkItem[] = [
  {
    name: "Research Triage",
    category: "apps",
    monitored: true,
    host: "windows dev box",
    urls: [
      { label: "rt.rackbops.com", url: "https://rt.rackbops.com" },
      { label: "dev", url: "https://rtdev.rackbops.com" },
      { label: "cdn", url: "//cdn.rackbops.com" },
      { label: "email", url: "mailto:ops@rackbops.com" },
    ],
  },
  { name: "Local Thing", category: "apps", urls: [{ label: "home", url: "/home" }] },
  { name: "Kuma", category: "infra", monitored: false, urls: [{ label: "kuma", url: "https://kuma.rackbops.com" }] },
  { name: "Orphan", category: "misc", urls: [{ label: "x", url: "https://x.com" }] },
];

const html = renderToStaticMarkup(<LinksIndex categories={categories} links={links} />);

test("renders category headings in listed order", () => {
  const apps = html.indexOf("Applications");
  const infra = html.indexOf("Infrastructure");
  assert.ok(apps >= 0 && infra >= 0, "both category headings present");
  assert.ok(apps < infra, "categories render in the order given");
});

test("renders each link's name and all its urls", () => {
  assert.ok(html.includes("Research Triage"));
  assert.ok(html.includes("rt.rackbops.com"));
  assert.ok(html.includes(">dev</a>"), "the second url renders too");
});

test("the url list is structurally reset so it looks the same under every theme", () => {
  assert.ok(html.includes("list-style:none"), "the <ul> drops bullets inline, not per-theme");
});

test("external urls open in a new tab; other schemes stay plain links", () => {
  assert.match(html, /href="https:\/\/rt\.rackbops\.com"[^>]*target="_blank"/);
  assert.match(html, /href="https:\/\/rt\.rackbops\.com"[^>]*rel="noreferrer noopener"/);
  // a protocol-relative (//host) url counts as external too
  assert.match(html, /href="\/\/cdn\.rackbops\.com"[^>]*target="_blank"/);
  // relative and non-web schemes stay plain in-page links (no new tab)
  assert.ok(html.includes('href="/home"'), "internal link renders");
  assert.ok(!/href="\/home"[^>]*target="_blank"/.test(html), "relative link is not a new tab");
  assert.ok(html.includes('href="mailto:ops@rackbops.com"'), "mailto link renders");
  assert.ok(
    !/href="mailto:ops@rackbops\.com"[^>]*target="_blank"/.test(html),
    "mailto is not a new tab",
  );
});

test("the monitored marker shows only for monitored links", () => {
  const count = (html.match(/monitored/g) ?? []).length;
  assert.equal(count, 1, "only the one monitored link shows the marker");
});

test("links with an unlisted category go into an Other group", () => {
  assert.ok(html.includes("Other"), "the Other group heading is present");
  assert.ok(html.includes("Orphan"), "the uncategorized link renders under it");
});

test("a category with no links renders no heading", () => {
  const withEmpty = renderToStaticMarkup(
    <LinksIndex categories={[...categories, { id: "empty", label: "Nothing Here" }]} links={links} />,
  );
  assert.ok(!withEmpty.includes("Nothing Here"), "an empty category is skipped");
});

test("no Other group when every link has a listed category", () => {
  const noOrphans = links.filter((l) => l.category !== "misc");
  const out = renderToStaticMarkup(<LinksIndex categories={categories} links={noOrphans} />);
  assert.ok(!out.includes("Other"), "the Other group is absent when there are no orphans");
});

test("forwards className and other props onto the root element", () => {
  const out = renderToStaticMarkup(
    <LinksIndex categories={categories} links={links} className="my-index" id="links-root" />,
  );
  assert.match(out, /^<div[^>]*class="my-index"/, "className lands on the root div");
  assert.match(out, /^<div[^>]*id="links-root"/, "other props forward to the root div");
});

test("defaults to h2 category headings and h3 card headings", () => {
  assert.match(html, /<h2>Applications<\/h2>/);
  assert.match(html, /<h3>Research Triage/);
});

test("level shifts the category heading, and cards render one level deeper", () => {
  const out = renderToStaticMarkup(
    <LinksIndex categories={categories} links={links} level={3} />,
  );
  assert.match(out, /<h3>Applications<\/h3>/);
  assert.match(out, /<h4>Research Triage/);
});

test("level clamps at h6 instead of overflowing past a real heading tag", () => {
  const out = renderToStaticMarkup(
    <LinksIndex categories={categories} links={links} level={6} />,
  );
  assert.match(out, /<h6>Applications<\/h6>/);
  assert.match(out, /<h6>Research Triage/, "card heading clamps at h6 instead of h7");
});

test("keys url list items by label+url, so two links sharing a url render without a duplicate-key warning", () => {
  const originalError = console.error;
  const messages: string[] = [];
  console.error = (...args: unknown[]) => {
    messages.push(String(args[0]));
  };
  try {
    renderToStaticMarkup(
      <LinksIndex
        categories={[]}
        links={[
          {
            name: "app",
            category: "other",
            urls: [
              { label: "prod", url: "https://x.example" },
              { label: "canonical", url: "https://x.example" },
            ],
          },
        ]}
      />,
    );
  } finally {
    console.error = originalError;
  }
  assert.ok(
    !messages.some((m) => m.includes("same key")),
    "no React duplicate-key warning for two urls sharing an address",
  );
});
