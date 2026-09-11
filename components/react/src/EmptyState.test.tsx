import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Button } from "./Button.js";
import { EmptyState } from "./EmptyState.js";

// Review round 2, MAJOR: `title: NonNullable<ReactNode>` (round 1's fix for the empty-heading
// bug) is a type-only change -- no runtime assertion can distinguish it from plain `ReactNode`,
// since both compile the same markup once a value is actually supplied. Reverting it to
// `ReactNode` left the entire suite green. `tsc -p tsconfig.json --noEmit` runs before this file
// (package.json's test script), so this function's body must fail to COMPILE if the type ever
// regresses -- that failure IS the guard. It is never called (only type-checked, never executed),
// so it has no runtime effect on the suite.
function _titleTypeGuards() {
  const maybeLabel: string | undefined = undefined;
  // @ts-expect-error an optional value must not satisfy the required, NonNullable `title`
  const g1 = <EmptyState title={maybeLabel} />;
  // @ts-expect-error an explicit undefined must not satisfy it either
  const g2 = <EmptyState title={undefined} />;
  return [g1, g2];
}
void _titleTypeGuards;

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

test("an out-of-range level (reached through an untyped caller) falls back to h3 instead of an invalid tag", () => {
  // level is typed 2 | 3 | 4; the cast simulates a plain-JS caller or a value computed elsewhere
  // and passed through untyped, bypassing that at compile time the way a real bad input would.
  const props = { title: "x", level: 7 } as unknown as { title: string };
  const html = renderToStaticMarkup(createElement(EmptyState, props));
  assert.match(html, /<h3>x<\/h3>/);
});

test("title accepts an inline element, not just a string -- the ReactNode value renders as itself", () => {
  // Review round 1, MAJOR: nothing previously exercised a non-string title, so a regression that
  // stringified it first (String(title), producing "[object Object]") passed every other test.
  const html = renderToStaticMarkup(<EmptyState title={<code>rack-01</code>} />);
  assert.match(html, /^<div class="rb-card" role="status"><h3><code>rack-01<\/code><\/h3><\/div>$/);
});

test("raised reaches the composed Card, since EmptyStateProps now extends Card's own props", () => {
  // Review round 1, MINOR: EmptyStateProps previously extended HTMLAttributes directly, so
  // `raised` type-checked as an error even though it worked once forced through at runtime
  // (Card destructures it from {...rest}). Extending Omit<CardProps, "title"> makes the type
  // match what already worked.
  const html = renderToStaticMarkup(<EmptyState title="x" raised />);
  assert.match(html, /^<div class="rb-card rb-card--raised" role="status">/);
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
