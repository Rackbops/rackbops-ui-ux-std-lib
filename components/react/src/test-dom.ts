import { JSDOM } from "jsdom";

// Shared jsdom bootstrap for the test files that need a real client render
// (refs.test.tsx, Dialog.test.tsx) -- react-dom/server's renderToStaticMarkup
// (used by every other *.test.tsx here) never runs a commit phase, so it can
// prove neither that a ref attaches nor that an effect re-runs across
// renders. Importing this file for its side effect installs jsdom's
// `document`/`window` etc. onto globalThis before react-dom/client loads.

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
// Object.assign uses [[Set]], which throws on globals Node itself already
// defines as getter-only (e.g. `navigator`, since Node 21). defineProperties
// uses [[DefineOwnProperty]] instead, which replaces the descriptor outright.
// `performance` and `queueMicrotask` are excluded: jsdom's implementations
// of both resolve back through whatever object they're installed on, so
// overwriting the globals with them here makes each call itself and blow the
// stack. jsdom also has no MessageChannel, which is what React's scheduler
// prefers for task scheduling in a browser-like environment -- without it,
// the scheduler falls back to setTimeout, so jsdom's setTimeout/clearTimeout
// (and interval siblings) are excluded too, on the same "resolves back
// through its own installation" suspicion, since they're the same category
// of global as the two known-recursive ones. Node's own native versions
// (all React's scheduler needs from any of these) stay in place instead.
const {
  performance: _perf,
  queueMicrotask: _qmt,
  setTimeout: _setTimeout,
  clearTimeout: _clearTimeout,
  setInterval: _setInterval,
  clearInterval: _clearInterval,
  ...rest
} = Object.getOwnPropertyDescriptors(dom.window);
Object.defineProperties(globalThis, rest);

// jsdom implements <dialog> as a plain element with a reflected `open`
// attribute, but neither of its imperative methods -- calling either throws
// "not a function". Dialog.tsx calls both, so tests that mount it with
// open={true} (or toggle open) need working stand-ins. These mirror the
// real methods' only behavior React's Dialog actually depends on: flipping
// `.open` and (for close) firing the same `close` event the browser does.
if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
}
if (typeof HTMLDialogElement.prototype.close !== "function") {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new dom.window.Event("close"));
  };
}
