import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Checkbox, Radio, Switch } from "./form.js";

// Scoped to the #84 fix (the .rb-choice wrapper becoming reachable) -- Input/Textarea/Select/
// Label/Field have no test coverage of their own yet, but that's pre-existing and out of scope.

function labelTag(html: string): string {
  return html.match(/<label[^>]*>/)?.[0] ?? "";
}
function inputTag(html: string): string {
  return html.match(/<input[^>]*>/)?.[0] ?? "";
}
function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
}

test("Checkbox: wrapperClassName/wrapperStyle style the .rb-choice row; className/style/rest still target the input", () => {
  const html = renderToStaticMarkup(
    <Checkbox
      label="Ship it"
      className="mt-4"
      style={{ accentColor: "red" }}
      wrapperClassName="row"
      wrapperStyle={{ marginTop: 4 }}
      data-testid="ship"
    />,
  );
  const label = labelTag(html);
  const input = inputTag(html);
  assert.equal(attr(label, "class"), "rb-choice row", "wrapperClassName appends onto rb-choice");
  assert.equal(attr(label, "style"), "margin-top:4px", "wrapperStyle applies to the row");
  assert.equal(attr(input, "class"), "rb-checkbox mt-4", "className still styles the control");
  assert.equal(attr(input, "style"), "accent-color:red", "style still styles the control");
  assert.equal(attr(input, "data-testid"), "ship", "rest still forwards onto the control");
});

test("Radio: wrapperClassName reaches the .rb-choice row, not the input", () => {
  const html = renderToStaticMarkup(<Radio label="Option A" wrapperClassName="row" />);
  assert.equal(attr(labelTag(html), "class"), "rb-choice row");
  assert.equal(attr(inputTag(html), "class"), "rb-radio");
});

test("Switch: wrapperClassName reaches the .rb-choice row, not the input", () => {
  const html = renderToStaticMarkup(<Switch label="Live" wrapperClassName="row" />);
  assert.equal(attr(labelTag(html), "class"), "rb-choice row");
  assert.equal(attr(inputTag(html), "class"), "rb-switch");
});

test("wrapperClassName has nowhere to land without a label -- no .rb-choice wrapper renders", () => {
  const html = renderToStaticMarkup(<Checkbox wrapperClassName="row" data-testid="bare" />);
  assert.doesNotMatch(html, /<label/, "no wrapper renders without a label");
});
