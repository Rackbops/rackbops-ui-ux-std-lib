import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./Button.js";

/** The single class="..." value of the rendered <button>. */
function classOf(el: ReactElement): string {
  return renderToStaticMarkup(el).match(/class="([^"]*)"/)?.[1] ?? "";
}

test("default renders the base class only — no size or variant modifier", () => {
  const cls = classOf(<Button>Go</Button>);
  assert.deepEqual(cls.split(" "), ["rb-btn"]);
});

test('size="sm" adds rb-btn--sm', () => {
  const cls = classOf(<Button size="sm">Go</Button>).split(" ");
  assert.ok(cls.includes("rb-btn"), "keeps the base class");
  assert.ok(cls.includes("rb-btn--sm"), "adds the compact size class");
});

test('size="md" is the default and emits no size class', () => {
  const cls = classOf(<Button size="md">Go</Button>).split(" ");
  assert.deepEqual(cls, ["rb-btn"], "md is a no-op, same as omitting size");
});

test("size composes with variant (both classes present, order-independent)", () => {
  const cls = classOf(
    <Button size="sm" variant="primary">
      Go
    </Button>,
  ).split(" ");
  assert.ok(cls.includes("rb-btn"));
  assert.ok(cls.includes("rb-btn--primary"), "the color variant still applies");
  assert.ok(cls.includes("rb-btn--sm"), "the size variant still applies");
});

test('defaults to type="button" so it never submits a form implicitly', () => {
  assert.match(renderToStaticMarkup(<Button>Go</Button>), /type="button"/);
});

test('type is overridable to "submit"', () => {
  assert.match(renderToStaticMarkup(<Button type="submit">Go</Button>), /type="submit"/);
});

test("forwards className after the component's own classes, and other props", () => {
  const html = renderToStaticMarkup(
    <Button size="sm" className="mine" id="save" disabled>
      Go
    </Button>,
  );
  assert.match(html, /class="rb-btn rb-btn--sm mine"/, "className is appended last");
  assert.match(html, /id="save"/, "arbitrary props forward to the element");
  assert.match(html, /disabled/, "disabled forwards");
});
