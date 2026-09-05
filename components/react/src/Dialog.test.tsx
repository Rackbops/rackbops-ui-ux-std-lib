import { test } from "node:test";
import assert from "node:assert/strict";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Dialog } from "./Dialog.js";

test("forwards rest props (id, data-*, aria-describedby) onto the native <dialog>", () => {
  const html = renderToStaticMarkup(
    <Dialog
      open={false}
      onClose={() => {}}
      id="confirm"
      data-testid="confirm-dialog"
      aria-describedby="hint"
    />,
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
      onClose={() => {}}
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

test("a stranded open=true render does not spontaneously reopen; a false->true transition does (issue #83, completing #31)", () => {
  // The controlled-component contract after #83: `open` is the parent's single
  // source of truth, and `onClose` (now required) is how the parent learns the
  // platform closed the dialog itself, so it can set open=false. That makes
  // `[open]` the correct dependency -- reconcile only when the desired state
  // changes -- which fixes both halves #31 left open: the dialog no longer
  // reopens on its own, and it still reopens on a genuine false->true change.
  let closeCount = 0;
  const renderDialog = (open: boolean) => (
    <Dialog open={open} onClose={() => closeCount++} title="Same">
      Body
    </Dialog>
  );
  const { container, rerender, cleanup } = mount(renderDialog(true));
  const el = container.querySelector("dialog");
  assert.equal(el?.open, true, "showModal ran on mount");

  // Simulate what the browser does on a native Escape close, independent of
  // anything Dialog.tsx does: flip .open and fire the same event a real close
  // fires. With onClose required, that event notifies the parent.
  el!.open = false;
  el!.dispatchEvent(new Event("close"));
  assert.equal(el?.open, false, "native close took effect");
  assert.equal(closeCount, 1, "onClose fired, so a real parent would set open=false");

  // The `open` prop is momentarily still true (the parent hasn't processed the
  // close yet) and an unrelated re-render happens. The dialog must NOT reopen
  // on its own: with `[open]` the sync effect only runs when the desired state
  // changes, and open (true) did not. A dependency-less effect -- what #31
  // shipped -- would call showModal() here and reopen it.
  rerender(renderDialog(true));
  assert.equal(el?.open, false, "a stranded open=true render did not reopen it");

  // The parent processes the close (open=false), then genuinely reopens.
  rerender(renderDialog(false));
  assert.equal(el?.open, false, "still closed while the parent holds open=false");
  rerender(renderDialog(true));
  assert.equal(el?.open, true, "reopened via a real false->true transition on the open prop");
  cleanup();
});

test("forwards a cleanup-returning callback ref: attaches once across re-renders and open toggles, cleans up on unmount (issue #83)", () => {
  // A React 19 cleanup-style consumer ref. The old per-render merge callback
  // re-attached every render and, returning undefined, let React fall back to
  // nulling the ref on the next render -- so this cleanup never ran. The
  // useImperativeHandle fix attaches exactly once and runs the cleanup on
  // unmount. refCb has a stable identity (declared once), isolating the
  // component's own internal ref churn from ordinary inline-callback re-attach.
  const attachArgs: (HTMLDialogElement | null)[] = [];
  let cleanupCount = 0;
  const refCb = (node: HTMLDialogElement | null) => {
    attachArgs.push(node);
    return () => {
      cleanupCount++;
    };
  };
  const renderDialog = (open: boolean) => (
    <Dialog ref={refCb} open={open} onClose={() => {}}>
      Body
    </Dialog>
  );
  // Identical-prop re-renders must not re-attach (guards against a per-render
  // ref identity), and neither must `open` toggles: the <dialog> node is
  // stable, so `useImperativeHandle`'s `[]` deps attach it exactly once for the
  // component's whole life. A non-empty deps array (e.g. `[open]`) would
  // detach+re-attach on every toggle -- firing the consumer's cleanup and
  // re-running its ref -- which the toggles below would catch.
  const { rerender, cleanup } = mount(renderDialog(false));
  rerender(renderDialog(false));
  rerender(renderDialog(true));
  rerender(renderDialog(false));
  rerender(renderDialog(true));
  assert.equal(
    attachArgs.filter((n) => n instanceof HTMLDialogElement).length,
    1,
    "the consumer ref attached exactly once across re-renders and open toggles",
  );
  assert.ok(!attachArgs.includes(null), "React never re-called the ref with null mid-life");
  assert.equal(cleanupCount, 0, "cleanup has not run while still mounted");

  cleanup();
  assert.equal(cleanupCount, 1, "the consumer ref's cleanup ran exactly once on unmount");
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
