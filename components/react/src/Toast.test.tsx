import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Toast, ToastRegion } from "./index.js";
import type { SemanticVariant } from "./index.js";

// react-dom/server needs no browser env (like contract-classes.test.tsx), so the
// SSR assertions below import it statically; the one behaviour test that needs a
// real click installs jsdom + react-dom/client afterward (the refs.test.tsx shape).

// -- SSR: class, role-by-variant, dismiss affordance, region is not a live region.

test("Toast renders .rb-toast with the variant modifier", () => {
  const html = renderToStaticMarkup(<Toast variant="success">Saved</Toast>);
  assert.match(html, /class="rb-toast rb-toast--success"/);
});

test("Toast without a variant is .rb-toast alone and polite", () => {
  const html = renderToStaticMarkup(<Toast>Saved</Toast>);
  assert.match(html, /class="rb-toast"/);
  assert.doesNotMatch(html, /rb-toast--/);
  assert.match(html, /role="status"/);
});

test("role is polite for info/success, assertive for warning/danger (#211)", () => {
  const roleOf = (v: SemanticVariant) =>
    renderToStaticMarkup(<Toast variant={v}>m</Toast>).match(/role="(\w+)"/)?.[1];
  assert.equal(roleOf("info"), "status");
  assert.equal(roleOf("success"), "status");
  assert.equal(roleOf("warning"), "alert");
  assert.equal(roleOf("danger"), "alert");
});

test("the dismiss button renders only with onDismiss, as a real labelled button", () => {
  const without = renderToStaticMarkup(<Toast>Saved</Toast>);
  assert.doesNotMatch(without, /rb-toast__close/);
  const withIt = renderToStaticMarkup(<Toast onDismiss={() => {}}>Saved</Toast>);
  assert.match(
    withIt,
    /<button[^>]*type="button"[^>]*class="rb-toast__close"[^>]*aria-label="Dismiss"/,
  );
});

test("dismissLabel overrides the button's aria-label", () => {
  const html = renderToStaticMarkup(
    <Toast onDismiss={() => {}} dismissLabel="Close">
      m
    </Toast>,
  );
  assert.match(html, /aria-label="Close"/);
});

test("ToastRegion is .rb-toast-region and is NOT itself a live region (#211)", () => {
  const html = renderToStaticMarkup(<ToastRegion />);
  assert.match(html, /class="rb-toast-region"/);
  assert.doesNotMatch(html, /role=/);
  assert.doesNotMatch(html, /aria-live/);
});

// -- client render: the dismiss button actually fires onDismiss. It is a real
//    <button type="button">, so Enter/Space activate it -- "dismissible by keyboard".
await import("./test-dom.js");
const { createRoot } = await import("react-dom/client");
const { flushSync } = await import("react-dom");

test("clicking the dismiss button fires onDismiss", () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  let dismissed = 0;
  flushSync(() =>
    root.render(
      <Toast
        onDismiss={() => {
          dismissed++;
        }}
      >
        Saved
      </Toast>,
    ),
  );
  const btn = container.querySelector<HTMLButtonElement>(".rb-toast__close");
  assert.ok(btn instanceof HTMLButtonElement);
  assert.equal(btn?.type, "button");
  btn?.click();
  assert.equal(dismissed, 1);
  flushSync(() => root.unmount());
  container.remove();
});
