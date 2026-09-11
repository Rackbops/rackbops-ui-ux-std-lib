// Committed reduced-motion render check (STANDARD.md 7, issue #125).
//
//   pnpm visual:reduced
//
// #51 collapses every transition through one --rb-transition: 0s token block
// per theme, and keeps a per-file transform: none override wherever a theme
// wants a decorative hover/press/focus transform gone entirely (not merely
// instant) -- summer-cloud's card lift, link slide, button scale. Neither of
// those guarantees was checkable by parsing CSS text alone (a dropped
// transform's end-state, and a live keyframe's actual slowed duration, only
// exist once the browser computes style), so #51's own review left them held
// by review + faithful restoration only. This script renders the showcase
// under real emulated prefers-reduced-motion and asserts them directly.
//
// Every assertion is made under BOTH modes -- "reduce" and "no-preference" --
// and required to DIFFER where the contract says they differ. That is the
// guard against a vacuous pass: if emulation silently stopped applying, "the
// transition is 0s under reduce" could pass because it was 0s regardless.
//
// A SEPARATE CI job (browser dependency), mirroring `visual` -- no browser
// dependency enters `pnpm test`. Unlike scripts/visual.mjs this reads
// computed style, never pixels: no animation freeze (freezing would defeat
// the whole point -- the spinner's slowed *rate* is exactly what's checked),
// no #186 section-offset snap, no pointer park (pseudo-states are forced via
// CDP, not a real pointer).
import { chromium } from "playwright-core";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { server } from "../site/serve.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

const manifest = JSON.parse(await readFile(join(ROOT, "styles", "manifest.json"), "utf-8"));
const contract = JSON.parse(await readFile(join(ROOT, "styles", "contract.json"), "utf-8"));
const themes = Object.keys(manifest.themes);

if (themes.length === 0) {
  console.error("reduced-motion: no themes in manifest.json -- nothing to check");
  process.exit(1);
}

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/site/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
const cdp = await page.context().newCDPSession(page);
await cdp.send("DOM.enable");
await cdp.send("CSS.enable");
await page.goto(url, { waitUntil: "networkidle" });

// Some declared selectors are too broad to safely resolve to the SPECIFIC
// showcase element a check needs -- the showcase renders more than one
// .rb-link, and the first in DOM order is the active nav item, whose ::after
// has `content: none` and would trivially satisfy any transform assertion
// without ever exercising the real rule. Narrowed here, not in contract.json:
// this is a showcase-fixture detail, not part of the contract the CSS makes.
function resolveSelector(selector) {
  if (selector === ".rb-link") return ".rb-link:not(.rb-link--active)";
  return selector;
}

// The floating card is a summer-cloud extra with no showcase demo (STANDARD.md
// 13 lists .rb-card--floating among the "Theme extras", not the base
// component set every theme's showcase section renders) -- inject one on
// demand, remove it once a theme's suppressions are checked.
async function ensureFloatingCard() {
  await page.evaluate(() => {
    if (document.querySelector(".rb-card--floating")) return;
    const el = document.createElement("div");
    el.className = "rb-card rb-card--floating";
    el.textContent = "probe";
    document.querySelector("main").appendChild(el);
  });
}
async function removeFloatingCard() {
  await page.evaluate(() => document.querySelector(".rb-card--floating")?.remove());
}

/** The CDP nodeId for `selector`, re-resolved from a fresh DOM.getDocument
 * each call rather than cached -- cheap, and avoids any risk of a stale
 * nodeId after the floating-card injection/removal mutates the tree. */
async function nodeIdFor(selector) {
  const { root } = await cdp.send("DOM.getDocument", { depth: -1, pierce: true });
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector });
  if (!nodeId) throw new Error(`reduced-motion: CDP DOM.querySelector found no node for "${selector}"`);
  return nodeId;
}

// Chromium versions vary on whether CSS.forcePseudoState accepts
// "focus-visible" in forcedPseudoClasses. Probed once, not per-call: a real
// Tab keypress is what makes :focus-visible match at all (a programmatic
// .focus() does not), so the fallback drives the keyboard instead of CDP.
let focusVisibleForceable = true;
try {
  const probeId = await nodeIdFor(".rb-btn:not(:disabled)");
  await cdp.send("CSS.forcePseudoState", { nodeId: probeId, forcedPseudoClasses: ["focus-visible"] });
  await cdp.send("CSS.forcePseudoState", { nodeId: probeId, forcedPseudoClasses: [] });
} catch {
  focusVisibleForceable = false;
  console.log("reduced-motion: CSS.forcePseudoState rejects focus-visible on this Chromium -- falling back to a real Tab keypress for that state");
}

/** Force `state` (hover/active/focus-visible) on the element matching
 * `selector`, run `fn`, then always reset -- forcePseudoState with an empty
 * list clears it (decision 4); the keyboard fallback blurs afterward. */
async function withForcedState(selector, state, fn) {
  const resolved = resolveSelector(selector);
  if (state === "focus-visible" && !focusVisibleForceable) {
    await page.focus(resolved);
    try {
      return await fn();
    } finally {
      await page.evaluate(() => document.activeElement?.blur());
    }
  }
  const nodeId = await nodeIdFor(resolved);
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [state] });
  try {
    return await fn();
  } finally {
    await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
  }
}

async function readTransform(selector, target) {
  return page.evaluate(
    ({ selector, target }) => {
      const el = document.querySelector(selector);
      const style = target === "self" ? getComputedStyle(el) : getComputedStyle(el, target);
      return style.transform;
    },
    { selector: resolveSelector(selector), target },
  );
}

async function switchTheme(theme) {
  // Switch through the page's own picker so fonts inject and the
  // sc-switching transition-suppression flip commits, exactly as a user
  // sees it (mirrors scripts/visual.mjs).
  await page.selectOption("#theme", theme);
  await page.waitForFunction((t) => document.documentElement.getAttribute("data-rb-style") === t, theme);
  await page.waitForFunction(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')].every((l) => l.sheet),
  );
  await page.evaluate(() => document.fonts.ready);
  // The picker's own setTheme() forces transitions off for one frame (adds
  // "sc-switching", commits, then removes it in a requestAnimationFrame) so
  // the flip itself doesn't visibly tween between palettes. visual.mjs never
  // has to wait for that frame -- it freezes every animation/transition
  // globally before this script would even care. This script reads
  // transition-duration directly, so reading it mid-suppression reports every
  // theme's .rb-btn as instantaneous regardless of prefers-reduced-motion,
  // masking the real value it exists to check.
  await page.waitForFunction(() => !document.documentElement.classList.contains("sc-switching"));
}

async function readTheme(theme) {
  await switchTheme(theme);

  const btnDurations = await page.evaluate(() => {
    const el = document.querySelector(".rb-btn:not([disabled])");
    return getComputedStyle(el)
      .transitionDuration.split(",")
      .map((s) => s.trim());
  });
  const spin = await page.evaluate(() => {
    const s = getComputedStyle(document.querySelector(".rb-spinner"));
    return { name: s.animationName, duration: s.animationDuration };
  });
  // Not every theme animates the checked state via a custom ::after thumb --
  // 5 of 14 do (a translateX slide); the rest style the native checkbox
  // directly (accent-color), which generates no ::after box at all (content:
  // none) and so has no transform of its own to keep. Detected at runtime,
  // not a hardcoded theme list, so a theme adding or dropping a custom thumb
  // later doesn't silently stop being checked.
  const thumb = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector(".rb-switch:checked"), "::after");
    return { content: style.content, transform: style.transform };
  });

  const declared = contract.reducedMotion?.suppressions?.[theme] ?? [];
  const suppressions = [];
  for (const entry of declared) {
    if (entry.selector === ".rb-card--floating") await ensureFloatingCard();
    const transform = await withForcedState(entry.selector, entry.state, () =>
      readTransform(entry.selector, entry.target),
    );
    suppressions.push({ ...entry, transform });
  }
  await removeFloatingCard();

  return { btnDurations, spin, thumb, suppressions };
}

const suppressionLabel = (s) => `${s.file} ${s.selector}:${s.state}${s.target === "self" ? "" : s.target}`;
const IDENTITY = "matrix(1, 0, 0, 1, 0, 0)";

const records = {};
for (const mode of ["reduce", "no-preference"]) {
  await page.emulateMedia({ reducedMotion: mode });
  records[mode] = {};
  for (const theme of themes) {
    records[mode][theme] = await readTheme(theme);
  }
}

await browser.close();
server.close();

let anyFailed = false;
const rows = [];
for (const theme of themes) {
  const reduce = records.reduce[theme];
  const noPref = records["no-preference"][theme];
  const problems = [];

  if (!reduce.btnDurations.every((d) => d === "0s")) {
    problems.push(`reduce: .rb-btn transition-duration not all 0s (${reduce.btnDurations.join(", ")})`);
  }
  if (noPref.btnDurations.every((d) => d === "0s")) {
    problems.push("no-preference: .rb-btn transition-duration is all 0s (emulation may not be live, or the token itself never varies)");
  }

  if (reduce.spin.name === "none") problems.push("reduce: spinner animation-name is none (must keep turning, slowed)");
  if (reduce.spin.duration !== "2s") {
    problems.push(`reduce: spinner animation-duration is ${reduce.spin.duration}, expected 2s`);
  }
  if (noPref.spin.name === "none") problems.push("no-preference: spinner animation-name is none");
  if (noPref.spin.duration === "2s") {
    problems.push("no-preference: spinner animation-duration is already 2s (emulation may not be live)");
  }

  if (reduce.thumb.content !== "none") {
    // Only themes with a real custom thumb (a generated ::after box) have a
    // functional transform to keep -- a native accent-color checkbox has
    // nothing here to check.
    if (reduce.thumb.transform === "none" || reduce.thumb.transform === IDENTITY) {
      problems.push(`reduce: switch thumb transform is "${reduce.thumb.transform}" -- a functional transform must be kept, never dropped`);
    }
  }

  for (const s of reduce.suppressions) {
    if (s.transform !== "none") {
      problems.push(`reduce: ${suppressionLabel(s)} transform is "${s.transform}", expected none`);
    }
  }
  for (const s of noPref.suppressions) {
    if (s.transform === "none") {
      problems.push(`no-preference: ${suppressionLabel(s)} transform is already none (the rule may not be reduce-gated, or the emulation reset didn't take)`);
    }
  }

  rows.push({ theme, problems });
  if (problems.length) anyFailed = true;
}

console.log("reduced-motion: per-theme results (reduce / no-preference)\n");
for (const { theme, problems } of rows) {
  console.log(`${problems.length === 0 ? "OK" : "FAIL"}  ${theme}`);
  for (const p of problems) console.log(`  - ${p}`);
}

if (anyFailed) {
  const failedCount = rows.filter((r) => r.problems.length).length;
  console.error(`\nreduced-motion: ${failedCount} of ${themes.length} theme(s) failed`);
  process.exit(1);
} else {
  console.log(`\nreduced-motion: all ${themes.length} themes pass under both reduce and no-preference`);
}
