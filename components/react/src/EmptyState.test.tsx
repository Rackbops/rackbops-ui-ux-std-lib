import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./Button.js";
import { EmptyState } from "./EmptyState.js";

test('renders a Card with role="status" and the title as an h3 by default', () => {
  const html = renderToStaticMarkup(<EmptyState title="No cards yet" />);
  assert.match(html, /^<div class="rb-card" role="status"><h3>No cards yet<\/h3><\/div>$/);
});

test("renders children as guidance and action last; nothing extra when both are omitted", () => {
  const full = renderToStaticMarkup(
    <EmptyState title="No cards yet" action={<Button>Add a card</Button>}>
      <p>Add one from the rack.</p>
    </EmptyState>,
  );
  const pAt = full.indexOf("<p>");
  const buttonAt = full.indexOf("<button");
  assert.ok(pAt >= 0 && buttonAt >= 0, "both the guidance and the action render");
  assert.ok(pAt < buttonAt, "guidance precedes the action");
  assert.match(full, /<button[^>]*>Add a card<\/button><\/div>$/, "the action is the last child");

  const bare = renderToStaticMarkup(<EmptyState title="No cards yet" />);
  assert.match(bare, /^<div class="rb-card" role="status"><h3>No cards yet<\/h3><\/div>$/);
});

test("level sets the heading element", () => {
  assert.match(renderToStaticMarkup(<EmptyState title="x" level={2} />), /<h2>x<\/h2>/);
  assert.match(renderToStaticMarkup(<EmptyState title="x" level={4} />), /<h4>x<\/h4>/);
});

test("className is appended after rb-card and arbitrary props reach the card root", () => {
  // role="status" is set before {...rest} in EmptyState (so a consumer's own role in rest can
  // override it), which puts it ahead of data-testid in the rendered attribute order.
  const html = renderToStaticMarkup(
    <EmptyState title="x" className="mine" data-testid="empty" />,
  );
  assert.match(html, /^<div class="rb-card mine" role="status" data-testid="empty">/);
});

test("never renders a spinner or progress element", () => {
  const html = renderToStaticMarkup(
    <EmptyState title="No cards yet" action={<Button>Add a card</Button>}>
      <p>Add one from the rack.</p>
    </EmptyState>,
  );
  assert.ok(!html.includes("rb-spinner"));
  assert.ok(!html.includes("<progress"));
});
