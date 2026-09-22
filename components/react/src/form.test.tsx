import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Checkbox, Radio, Switch, Label, FieldHelp, FieldError } from "./form.js";

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

// #210: the required marker, help text, and error text.

test("Label required renders exactly one aria-hidden .rb-label__required span with the * glyph, after the children", () => {
  const html = renderToStaticMarkup(<Label required>Project name</Label>);
  const matches = [...html.matchAll(/<span class="rb-label__required" aria-hidden="true">\*<\/span>/g)];
  assert.equal(matches.length, 1, "exactly one required-marker span");
  assert.ok(html.indexOf("Project name") < html.indexOf('class="rb-label__required"'), "the marker renders after the children");
});

test("Label without required renders no .rb-label__required span", () => {
  const html = renderToStaticMarkup(<Label>Project name</Label>);
  assert.doesNotMatch(html, /rb-label__required/, "no marker renders without the prop");
});

test("FieldHelp renders .rb-field__help, forwards id, and passes through as a <p>", () => {
  const html = renderToStaticMarkup(
    <FieldHelp id="project-help" className="extra">
      Use the repository name.
    </FieldHelp>,
  );
  assert.match(html, /^<p /, "renders a <p>");
  assert.match(html, /class="rb-field__help extra"/);
  assert.match(html, /id="project-help"/);
  assert.match(html, />Use the repository name\.<\/p>$/);
});

test("FieldError renders .rb-field__error, forwards id, and carries no ARIA live-region role", () => {
  const html = renderToStaticMarkup(
    <FieldError id="project-error" className="extra">
      Enter a project name.
    </FieldError>,
  );
  assert.match(html, /^<p /, "renders a <p>");
  assert.match(html, /class="rb-field__error extra"/);
  assert.match(html, /id="project-error"/);
  // Mutation guard: the plan explicitly decided against role="alert" -- a re-render on every
  // keystroke would announce on every keystroke. This must never regain a role.
  assert.doesNotMatch(html, /\brole=/, "FieldError must carry no ARIA role");
});
