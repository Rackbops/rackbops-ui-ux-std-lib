// Visual-regression baselines for the showcase (STANDARD.md 13, issue #50).
//
//   pnpm visual            compare every showcase section, per theme, to its
//                          committed baseline; exit non-zero + write *.diff.png
//                          on any regression.
//   pnpm visual --update   (re)generate the baselines.
//
// This is the ONLY browser dependency in the repo and is deliberately NOT part
// of `pnpm test` -- it runs as a separate CI job so the node:test suites stay
// fast and dependency-free (the three top review findings -- #28 progress fill,
// #29 unstyled classes, #37 disabled-hover -- were invisible to text parsing
// and obvious on screen; this catches that class).
//
// Screenshots are pixel-sensitive to OS/browser/font rendering, so baselines
// MUST be generated in the same environment CI runs -- the official Playwright
// container (mcr.microsoft.com/playwright). A baseline shot on another OS fails
// against CI on antialiasing alone. See README "Developing".
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { server } from "../site/serve.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SHOTS = join(ROOT, "site", "__screenshots__");
const UPDATE = process.argv.includes("--update");

// pixelmatch per-pixel colour tolerance, and the fraction of pixels allowed to
// differ before a tile counts as regressed -- small, to absorb sub-pixel AA
// noise within one environment without masking a real visual change.
const PIXEL_THRESHOLD = 0.1;
const MAX_DIFF_RATIO = 0.001;

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const manifest = JSON.parse(await readFile(join(ROOT, "styles", "manifest.json"), "utf-8"));
const themes = Object.keys(manifest.themes);

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const { port } = server.address();
const url = `http://127.0.0.1:${port}/site/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
await page.goto(url, { waitUntil: "networkidle" });
// Freeze transitions + the caret so every tile is deterministic run-to-run.
// `*` reaches every element and named pseudo (::before/::after), but NOT the
// vendor-prefixed ::-webkit-progress-bar / ::-moz-progress-bar the
// indeterminate <progress> sweep (#86) animates -- a CSS override targeting
// those specifically was tried and measured to have no effect on Chromium's
// headless-shell build (0 of many attempted selector/specificity/injection-
// timing combinations stopped it; two screenshots 700ms apart kept differing
// even with a statically-present, tied-specificity, later-in-source
// `animation: none !important` rule). `animation: none` is dropped from this
// stylesheet-based freeze entirely; every running animation, including ones
// on that pseudo-element, is stopped below the CSS cascade instead, via CDP.
await page.addStyleTag({
  content: "*, *::before, *::after { transition: none !important; caret-color: transparent !important; }",
});
const cdp = await page.context().newCDPSession(page);
await cdp.send("Animation.enable");
await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });

// Section identity is its sc-title, slugified -- stable across reorders.
const sections = await page.$$eval("main > section", (els) =>
  els.map((el, i) => [i, el.querySelector(".sc-title")?.textContent ?? `section-${i}`]),
);

// Never let an empty matrix (a showcase refactor that renames <main>/<section>,
// or an empty manifest) pass green having compared nothing.
if (themes.length === 0 || sections.length === 0) {
  console.error(`visual: nothing to capture (${themes.length} themes x ${sections.length} sections)`);
  process.exit(1);
}
// A slug collision would silently make two sections share one baseline.
const slugs = sections.map(([, title]) => slugify(title));
const dupes = [...new Set(slugs.filter((s, i) => slugs.indexOf(s) !== i))];
if (dupes.length) {
  console.error(`visual: duplicate section slug(s): ${dupes.join(", ")}`);
  process.exit(1);
}

const failures = [];
let compared = 0;

for (const theme of themes) {
  // Switch through the page's own picker so fonts inject and the sc-switching
  // transition-suppression flip commits, exactly as a user sees it.
  await page.selectOption("#theme", theme);
  await page.waitForFunction((t) => document.documentElement.getAttribute("data-rb-style") === t, theme);
  // Wait for every stylesheet <link> to finish loading -- a webfont theme
  // injects a Google Fonts <link> on switch, and its @font-face rules must be
  // parsed before document.fonts sees the faces -- then for the faces to load.
  // A fixed timeout would race the CDN and silently capture the fallback font,
  // whose different metrics change tile height and fail the whole theme.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('link[rel="stylesheet"]')].every((l) => l.sheet),
  );
  await page.evaluate(() => document.fonts.ready);

  for (const [i, title] of sections) {
    const rel = join(theme, `${slugify(title)}.png`);
    const baseline = join(SHOTS, rel);
    let buf;
    if (slugify(title) === "dialog") {
      // The dialog is a top-layer native modal -- open it and shoot the dialog
      // itself, not the section (which holds only the trigger button).
      await page.click("#open-dialog");
      await page.waitForSelector("#demo-dialog[open]");
      buf = await page.locator("#demo-dialog").screenshot();
      await page.click("#close-dialog");
      await page.waitForSelector("#demo-dialog[open]", { state: "detached" }).catch(() => {});
    } else {
      buf = await page.locator("main > section").nth(i).screenshot();
    }

    if (UPDATE) {
      await mkdir(dirname(baseline), { recursive: true });
      await writeFile(baseline, buf);
      continue;
    }
    if (!existsSync(baseline)) {
      failures.push(`${rel}: no baseline (run \`pnpm visual --update\`)`);
      continue;
    }
    const actual = PNG.sync.read(buf);
    const expected = PNG.sync.read(await readFile(baseline));
    if (actual.width !== expected.width || actual.height !== expected.height) {
      failures.push(`${rel}: size ${actual.width}x${actual.height} vs baseline ${expected.width}x${expected.height}`);
      await writeFile(baseline.replace(/\.png$/, ".actual.png"), buf);
      continue;
    }
    const { width, height } = expected;
    const diff = new PNG({ width, height });
    const differing = pixelmatch(actual.data, expected.data, diff.data, width, height, { threshold: PIXEL_THRESHOLD });
    compared++;
    if (differing / (width * height) > MAX_DIFF_RATIO) {
      failures.push(`${rel}: ${differing} px differ`);
      await writeFile(baseline.replace(/\.png$/, ".diff.png"), PNG.sync.write(diff));
    }
  }
}

await browser.close();
server.close();

if (UPDATE) {
  console.log(`visual: updated ${themes.length} themes x ${sections.length} sections`);
} else if (failures.length) {
  console.error(`visual: ${failures.length} tile(s) regressed:`);
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
} else {
  console.log(`visual: ${compared} tiles match their baselines`);
}
