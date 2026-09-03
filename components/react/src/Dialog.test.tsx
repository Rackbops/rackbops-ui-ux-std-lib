import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Dialog } from "./Dialog.js";

test("forwards rest props (id, data-*, aria-describedby) onto the native <dialog>", () => {
  const html = renderToStaticMarkup(
    <Dialog open={false} id="confirm" data-testid="confirm-dialog" aria-describedby="hint" />,
  );
  assert.match(html, /id="confirm"/);
  assert.match(html, /data-testid="confirm-dialog"/);
  assert.match(html, /aria-describedby="hint"/);
});

// The two tests below need a real client render (open/close is imperative
// DOM state, not something a rendered HTML string carries) -- see
// test-dom.ts for what installing jsdom for that involves, and why Dialog's
// showModal/close specifically need stubbing there.
await import("./test-dom.js");
const { createRoot } = await import("react-dom/client");
const { flushSync } = await import("react-dom");

function mount(el: ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  flushSync(() => root.render(el));
  return {
    container,
    rerender: (next: ReactElement) => flushSync(() => root.render(next)),
    cleanup: () => {
      flushSync(() => root.unmount());
      container.remove();
    },
  };
}

test("onCancel reaches the native <dialog> and can preventDefault() the close", () => {
  let cancelFired = false;
  const { container, cleanup } = mount(
    <Dialog
      open
      onCancel={(e) => {
        cancelFired = true;
        e.preventDefault();
      }}
    />,
  );
  const el = container.querySelector("dialog");
  assert.ok(el?.open, "opened via showModal on mount");

  const cancelEvent = new Event("cancel", { cancelable: true });
  el?.dispatchEvent(cancelEvent);
  assert.ok(cancelFired, "the consumer's onCancel handler fired");
  assert.ok(cancelEvent.defaultPrevented, "preventDefault() inside it took effect on the event");
  cleanup();
});

test("reopens via the open prop after a native close strands it out of sync (issue #31)", () => {
  // Every prop VALUE is identical between the two renders below, including
  // `open` itself -- but each is its own JSX element (not the same object
  // reused), since React bails out of even calling a component's render
  // function again when the exact same element reference is passed to
  // render() twice, which would make this pass for the wrong reason (never
  // re-rendering at all) rather than the right one (re-rendering but
  // reconciling regardless of what changed). A narrower fix that lists
  // `open` (plus whatever else happened to change) as a dependency would
  // also pass a test whose re-render changes some other prop alongside
  // `open` staying stuck -- that dependency array would just as validly
  // re-fire. Only a fix with no dependency array at all -- reconciling on
  // literally every render, not just one where some listed value changed --
  // passes when no observable prop value changed either.
  const renderDialog = () => (
    <Dialog open title="Same">
      Body
    </Dialog>
  );
  const { container, rerender, cleanup } = mount(renderDialog());
  const el = container.querySelector("dialog");
  assert.equal(el?.open, true, "showModal ran on mount");

  // Simulate what the browser does on a native Escape close, independent of
  // anything Dialog.tsx itself does: flip .open and fire the same event a
  // real close does. Nothing reacts, same as before #31 -- there's no
  // onClose wired here, matching the issue's own failure scenario.
  el!.open = false;
  el!.dispatchEvent(new Event("close"));
  assert.equal(el?.open, false, "native close took effect; the open prop is untouched");

  // The parent re-renders for some unrelated reason -- nothing Dialog
  // receives is different. Before #31 the sync effect's dependency array
  // was `[open]`, so an unchanged `open` value meant it never re-ran and the
  // dialog stayed closed no matter how many more times the parent rendered.
  rerender(renderDialog());
  assert.equal(
    el?.open,
    true,
    "re-synced and reopened even though no prop value Dialog received changed at all",
  );
  cleanup();
});

test("closing via the open prop calls the native close(), firing onClose", () => {
  let closed = false;
  const { container, rerender, cleanup } = mount(
    <Dialog open onClose={() => (closed = true)}>
      Body
    </Dialog>,
  );
  const el = container.querySelector("dialog");
  assert.equal(el?.open, true, "showModal ran on mount");

  rerender(
    <Dialog open={false} onClose={() => (closed = true)}>
      Body
    </Dialog>,
  );
  assert.equal(el?.open, false, "the sync effect called the native close()");
  assert.ok(closed, "close() firing a real close event reached onClose");
  cleanup();
});
