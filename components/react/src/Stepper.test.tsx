import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Stepper } from "./Stepper.js";

const steps = [
  { id: "design", label: "Design" },
  { id: "build", label: "Build" },
  { id: "ship", label: "Ship" },
  { id: "monitor", label: "Monitor" },
];

/** Pull each <li ...> tag (open tag only, attrs order-independent) out of the
 * rendered HTML, in document order. */
function stepTags(html: string): string[] {
  return [...html.matchAll(/<li\b[^>]*>/g)].map((m) => m[0]);
}
function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];
}

test("renders <ol class=\"rb-stepper\">", () => {
  const html = renderToStaticMarkup(<Stepper steps={steps} current={0} />);
  assert.match(html, /<ol class="rb-stepper"/);
});

test("derives complete/current/upcoming from `current`, never a fourth state", () => {
  const html = renderToStaticMarkup(<Stepper steps={steps} current={1} />);
  const classes = stepTags(html).map((t) => attr(t, "class"));
  assert.deepEqual(classes, [
    "rb-stepper__step rb-stepper--complete",
    "rb-stepper__step rb-stepper--current",
    "rb-stepper__step rb-stepper--upcoming",
    "rb-stepper__step rb-stepper--upcoming",
  ]);
});

test("current=0 marks every later step upcoming, none complete", () => {
  const html = renderToStaticMarkup(<Stepper steps={steps} current={0} />);
  const classes = stepTags(html).map((t) => attr(t, "class"));
  assert.deepEqual(classes, [
    "rb-stepper__step rb-stepper--current",
    "rb-stepper__step rb-stepper--upcoming",
    "rb-stepper__step rb-stepper--upcoming",
    "rb-stepper__step rb-stepper--upcoming",
  ]);
});

test("current at the last index marks every earlier step complete, none upcoming", () => {
  const html = renderToStaticMarkup(<Stepper steps={steps} current={3} />);
  const classes = stepTags(html).map((t) => attr(t, "class"));
  assert.deepEqual(classes, [
    "rb-stepper__step rb-stepper--complete",
    "rb-stepper__step rb-stepper--complete",
    "rb-stepper__step rb-stepper--complete",
    "rb-stepper__step rb-stepper--current",
  ]);
});

test("aria-current=\"step\" is set on the current step only", () => {
  const html = renderToStaticMarkup(<Stepper steps={steps} current={2} />);
  const tags = stepTags(html);
  assert.equal(tags.filter((t) => attr(t, "aria-current") === "step").length, 1);
  assert.equal(attr(tags[2], "aria-current"), "step");
  assert.equal(attr(tags[0], "aria-current"), undefined);
  assert.equal(attr(tags[3], "aria-current"), undefined);
});

test("a complete step's node always renders the checkmark, not its own icon", () => {
  const withIcon = [{ id: "a", label: "A", icon: "★" }, { id: "b", label: "B" }];
  const html = renderToStaticMarkup(<Stepper steps={withIcon} current={1} />);
  assert.ok(html.includes("<svg"), "complete step renders the built-in checkmark svg");
  assert.ok(!html.includes("★"), "the step's own icon is not shown once complete");
});

test("an upcoming/current step without an icon falls back to its 1-based position", () => {
  const html = renderToStaticMarkup(<Stepper steps={steps} current={1} />);
  const nodes = [...html.matchAll(/<span class="rb-stepper__node">(.*?)<\/span>/g)].map(
    (m) => m[1],
  );
  assert.equal(nodes[2], "3", "the third (upcoming) step falls back to its position, 1-based");
});

test("a single-step stepper still renders without error (no divide-by-zero-shaped logic left to trip on)", () => {
  const html = renderToStaticMarkup(<Stepper steps={[{ id: "only", label: "Only" }]} current={0} />);
  assert.match(html, /rb-stepper--current/);
});

test("forwards className after rb-stepper, and other props onto the ol element", () => {
  const html = renderToStaticMarkup(
    <Stepper steps={steps} current={0} className="mine" aria-label="Release pipeline" />,
  );
  assert.match(html, /<ol class="rb-stepper mine"[^>]*aria-label="Release pipeline"/);
});
