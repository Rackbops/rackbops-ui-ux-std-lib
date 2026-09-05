import { test } from "node:test";
import assert from "node:assert/strict";
import { createRef, type ReactElement } from "react";

// react-dom/client and react-dom (for flushSync) check for a browser
// environment at import time -- renderToStaticMarkup (used by every other
// *.test.tsx in this package) never runs a real commit phase, so it can't
// prove a ref actually reaches the DOM. A real client render needs a real
// `document`, which is why this file needs jsdom in place before react-dom
// loads (issue #30) -- see test-dom.ts for what installing it involves.
await import("./test-dom.js");

const { createRoot } = await import("react-dom/client");
const { flushSync } = await import("react-dom");
const {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  Field,
  Input,
  Label,
  LinksIndex,
  NavLink,
  NavRail,
  Progress,
  Radio,
  Select,
  Spinner,
  Stepper,
  Switch,
  Tabs,
  Textarea,
} = await import("./index.js");

/** Mounts `el` with a real client render (a real commit, unlike SSR) and
 * returns the ref-populating node plus a cleanup callback. */
function mount(el: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(el));
  return () => {
    flushSync(() => root.unmount());
    container.remove();
  };
}

test("Button forwards ref to the <button>", () => {
  const ref = createRef<HTMLButtonElement>();
  const cleanup = mount(<Button ref={ref}>Go</Button>);
  assert.ok(ref.current instanceof HTMLButtonElement);
  cleanup();
});

test("Card forwards ref to the <div>", () => {
  const ref = createRef<HTMLDivElement>();
  const cleanup = mount(<Card ref={ref} />);
  assert.ok(ref.current instanceof HTMLDivElement);
  cleanup();
});

test("NavLink forwards ref to the <a>", () => {
  const ref = createRef<HTMLAnchorElement>();
  const cleanup = mount(<NavLink ref={ref} href="/x" />);
  assert.ok(ref.current instanceof HTMLAnchorElement);
  cleanup();
});

test("NavRail forwards ref to the <nav>", () => {
  const ref = createRef<HTMLElement>();
  const cleanup = mount(<NavRail ref={ref} items={[{ id: "a", label: "A" }]} />);
  assert.ok(ref.current instanceof HTMLElement);
  cleanup();
});

test("Input forwards ref to the <input>", () => {
  const ref = createRef<HTMLInputElement>();
  const cleanup = mount(<Input ref={ref} />);
  assert.ok(ref.current instanceof HTMLInputElement);
  cleanup();
});

test("Textarea forwards ref to the <textarea>", () => {
  const ref = createRef<HTMLTextAreaElement>();
  const cleanup = mount(<Textarea ref={ref} />);
  assert.ok(ref.current instanceof HTMLTextAreaElement);
  cleanup();
});

test("Select forwards ref to the <select>", () => {
  const ref = createRef<HTMLSelectElement>();
  const cleanup = mount(<Select ref={ref} />);
  assert.ok(ref.current instanceof HTMLSelectElement);
  cleanup();
});

test("Label forwards ref to the <label>", () => {
  const ref = createRef<HTMLLabelElement>();
  const cleanup = mount(<Label ref={ref} />);
  assert.ok(ref.current instanceof HTMLLabelElement);
  cleanup();
});

test("Field forwards ref to the <div>", () => {
  const ref = createRef<HTMLDivElement>();
  const cleanup = mount(<Field ref={ref} />);
  assert.ok(ref.current instanceof HTMLDivElement);
  cleanup();
});

test("Checkbox forwards ref to the <input>, not the .rb-choice label wrapper", () => {
  const ref = createRef<HTMLInputElement>();
  const cleanup = mount(<Checkbox ref={ref} label="Ship it" />);
  assert.ok(ref.current instanceof HTMLInputElement);
  assert.equal(ref.current?.type, "checkbox");
  cleanup();
});

test("Radio forwards ref to the <input>, not the .rb-choice label wrapper", () => {
  const ref = createRef<HTMLInputElement>();
  const cleanup = mount(<Radio ref={ref} label="Option A" />);
  assert.ok(ref.current instanceof HTMLInputElement);
  assert.equal(ref.current?.type, "radio");
  cleanup();
});

test("Switch forwards ref to the <input>, not the .rb-choice label wrapper", () => {
  const ref = createRef<HTMLInputElement>();
  const cleanup = mount(<Switch ref={ref} label="Live" />);
  assert.ok(ref.current instanceof HTMLInputElement);
  assert.equal(ref.current?.getAttribute("role"), "switch");
  cleanup();
});

test("Badge forwards ref to the <span>", () => {
  const ref = createRef<HTMLSpanElement>();
  const cleanup = mount(<Badge ref={ref}>new</Badge>);
  assert.ok(ref.current instanceof HTMLSpanElement);
  cleanup();
});

test("Alert forwards ref to the <div>", () => {
  const ref = createRef<HTMLDivElement>();
  const cleanup = mount(<Alert ref={ref}>Heads up</Alert>);
  assert.ok(ref.current instanceof HTMLDivElement);
  cleanup();
});

test("Progress forwards ref to the <progress>", () => {
  const ref = createRef<HTMLProgressElement>();
  const cleanup = mount(<Progress ref={ref} value={0.5} />);
  assert.ok(ref.current instanceof HTMLProgressElement);
  cleanup();
});

test("Spinner forwards ref to the <span>", () => {
  const ref = createRef<HTMLSpanElement>();
  const cleanup = mount(<Spinner ref={ref} />);
  assert.ok(ref.current instanceof HTMLSpanElement);
  cleanup();
});

test("Dialog forwards ref to the <dialog>, alongside its own internal show/close ref", () => {
  const ref = createRef<HTMLDialogElement>();
  const cleanup = mount(<Dialog ref={ref} open={false} onClose={() => {}} />);
  assert.ok(ref.current instanceof HTMLDialogElement);
  cleanup();
});

test("Tabs forwards ref to the outer wrapper <div>", () => {
  const ref = createRef<HTMLDivElement>();
  const cleanup = mount(
    <Tabs ref={ref} items={[{ id: "a", label: "A", content: "content" }]} />,
  );
  assert.ok(ref.current instanceof HTMLDivElement);
  cleanup();
});

test("Stepper forwards ref to the <ol>", () => {
  const ref = createRef<HTMLOListElement>();
  const cleanup = mount(<Stepper ref={ref} steps={[{ id: "a", label: "A" }]} current={0} />);
  assert.ok(ref.current instanceof HTMLOListElement);
  cleanup();
});

test("LinksIndex forwards ref to the <div>", () => {
  const ref = createRef<HTMLDivElement>();
  const cleanup = mount(<LinksIndex ref={ref} categories={[]} links={[]} />);
  assert.ok(ref.current instanceof HTMLDivElement);
  cleanup();
});
