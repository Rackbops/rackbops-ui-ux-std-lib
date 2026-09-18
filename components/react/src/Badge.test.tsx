import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Badge } from "./feedback.js";

/** The single class="..." value of the rendered <span>. */
function classOf(el: ReactElement): string {
  return renderToStaticMarkup(el).match(/class="([^"]*)"/)?.[1] ?? "";
}

test("default renders the base class only — no size or variant modifier", () => {
  const cls = classOf(<Badge>b</Badge>);
  assert.deepEqual(cls.split(" "), ["rb-badge"], "unchanged from today's rendering");
});

test('size="sm" is the default and emits no size class', () => {
  const cls = classOf(<Badge size="sm">b</Badge>).split(" ");
  assert.deepEqual(cls, ["rb-badge"], "sm is a no-op, same as omitting size");
});

test('size="md" adds rb-badge--md', () => {
  const cls = classOf(<Badge size="md">b</Badge>).split(" ");
  assert.ok(cls.includes("rb-badge"), "keeps the base class");
  assert.ok(cls.includes("rb-badge--md"), "adds the row-text size class");
});

test("size composes with variant (both classes present, order-independent)", () => {
  const cls = classOf(
    <Badge size="md" variant="danger">
      b
    </Badge>,
  ).split(" ");
  assert.ok(cls.includes("rb-badge"));
  assert.ok(cls.includes("rb-badge--danger"), "the semantic variant still applies");
  assert.ok(cls.includes("rb-badge--md"), "the size modifier still applies");
});

test("forwards className after the component's own classes, and other props", () => {
  const html = renderToStaticMarkup(
    <Badge size="md" className="mine" id="tag">
      b
    </Badge>,
  );
  assert.match(html, /class="rb-badge rb-badge--md mine"/, "className is appended last");
  assert.match(html, /id="tag"/, "arbitrary props forward to the element");
});
