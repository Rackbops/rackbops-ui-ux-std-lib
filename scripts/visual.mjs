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
//
// Each section is snapped to an integer document offset before capture (#186):
// otherwise a tile's antialiasing depends on the fractional phase left by
// everything above it, so an unrelated layout change elsewhere on the page
// perturbs tiles whose own content never changed.
//
// #198: the whole run lives in main(), guarded below, so scripts/visual-control.mjs
// and scripts/visual-diff-probe.mjs can `import { PIXEL_THRESHOLD, MAX_DIFF_RATIO }
// from "./visual.mjs"` without launching a browser as an import side effect.
// Four env vars, all no-ops when unset (default behaviour is unchanged):
//   RB_VISUAL_SHOTS_DIR    -- baselines dir, instead of site/__screenshots__
//                             (visual-control.mjs points this at a scratch copy
//                             so a control run never touches committed baselines).
//   RB_VISUAL_THEMES       -- comma-separated theme allowlist, instead of every
//                             manifest theme.
//   RB_VISUAL_LAUNCH_ARGS  -- space-separated flags passed to chromium.launch()
//                             (the #192 compositor-pin experiment hook).
//   RB_VISUAL_KEEP_GLASS   -- "1" skips the #190 backdrop-filter override, for
//                             experiments that need the glass effect captured.
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { chromium } from "playwright-core";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { server } from "../site/serve.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SHOTS = process.env.RB_VISUAL_SHOTS_DIR ? resolve(process.env.RB_VISUAL_SHOTS_DIR) : join(ROOT, "site", "__screenshots__");
const UPDATE = process.argv.includes("--update");
const LAUNCH_ARGS = process.env.RB_VISUAL_LAUNCH_ARGS ? process.env.RB_VISUAL_LAUNCH_ARGS.split(/\s+/).filter(Boolean) : [];
const KEEP_GLASS = process.env.RB_VISUAL_KEEP_GLASS === "1";

// pixelmatch per-pixel colour tolerance, and the fraction of pixels allowed to
// differ before a tile counts as regressed -- small, to absorb sub-pixel AA
// noise within one environment without masking a real visual change.
export const PIXEL_THRESHOLD = 0.1;
export const MAX_DIFF_RATIO = 0.001;

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function main() {
  const manifest = JSON.parse(await readFile(join(ROOT, "styles", "manifest.json"), "utf-8"));
  const allThemes = Object.keys(manifest.themes);
  let themes = allThemes;
  if (process.env.RB_VISUAL_THEMES) {
    const wanted = process.env.RB_VISUAL_THEMES.split(",").map((s) => s.trim()).filter(Boolean);
    const unknown = wanted.filter((t) => !allThemes.includes(t));
    if (unknown.length) {
      console.error(`visual: RB_VISUAL_THEMES names unknown theme(s): ${unknown.join(", ")}`);
      process.exit(1);
    }
    themes = wanted;
  }

  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address();
  const url = `http://127.0.0.1:${port}/site/`;

  const browser = await chromium.launch({ args: LAUNCH_ARGS });
  const page = await browser.newPage({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
  // Freeze every running animation, including ones on vendor-prefixed pseudo-
  // elements a CSS override can't reach (`*, *::before, *::after` misses
  // ::-webkit-progress-bar / ::-moz-progress-bar, which the indeterminate
  // <progress> sweep (#86) animates -- a CSS-side fix was tried and measured to
  // have no effect on Chromium's headless-shell build: 0 of many attempted
  // selector/specificity/injection-timing combinations stopped it, screenshots
  // 700ms apart kept differing every time even with a statically-present,
  // tied-specificity, later-in-source `animation: none !important` rule).
  // Set BEFORE goto, not after: playbackRate applies to the target's animation
  // engine and persists across navigation, so the default theme's sweep starts
  // into an already-frozen (rate 0) timeline the instant it's created, at
  // progress 0 -- not whatever arbitrary frame page.goto's variable load time
  // happened to reach before a post-load freeze caught up to it.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Animation.enable");
  await cdp.send("Animation.setPlaybackRate", { playbackRate: 0 });
  await page.goto(url, { waitUntil: "networkidle" });
  // Park the pointer in the sticky header's top-left padding (.sc-head,
  // nothing interactive there) so no element captures a hover state that
  // would otherwise be baked into every baseline for the rest of the run
  // (#123).
  await page.mouse.move(0, 0);
  // Freeze transitions + the caret too -- `*` reaches every element and named
  // pseudo (::before/::after) for this, which is all it needs to reach.
  await page.addStyleTag({
    content: "*, *::before, *::after { transition: none !important; caret-color: transparent !important; }",
  });
  // #190: Chromium picks the compositor's backdrop-filter path per session, not
  // per element -- glass-card tiles on luminous-precision and summer-cloud
  // (.rb-card / the nav rail, backdrop-filter over the ports' .rb-bg canvas)
  // therefore render in one of two stable ways depending on which path a given
  // session lands in, with the differing-pixel count recurring exactly across
  // sessions (not noise). Confirmed with ten no-edit control pairs, each pair
  // two separate browser launches (phase 1, #190): disabling backdrop-filter
  // entirely was 10/10 pixel-clean; CI caught the bimodality directly when
  // #191's bot regen landed one mode and the next compare run landed the
  // other, failing `main` outright. #192 investigated pinning a deterministic
  // compositor path (a candidate flag set was 10/10 clean locally) to restore
  // the effect to these baselines instead, but did not adopt it: measured IN
  // THE MODE where an on-vs-off capture came out identical at this job's own
  // threshold on every glass-bearing tile in all three affected themes, the
  // blur's own contribution is at most one unit in 255 per channel -- so what
  // this override actually forfeits is the mode-dependent antialiasing
  // artifact above, not a blur effect the job could otherwise photograph.
  // #192's own audit reconfirmed the mode-flip is real and still present with
  // the filter on (neon-butterfly's Cards tile differed in 6 of 10 on-vs-on
  // session pairs, up to 1.68%, above the job's 0.1% threshold) -- so the
  // filter's own rendering stays reviewed by eye, not by baseline.
  // RB_VISUAL_KEEP_GLASS skips this for #198's control runner, which needs to
  // measure the glass effect itself rather than the (deliberately disabled)
  // default job behaviour.
  if (!KEEP_GLASS) {
    await page.addStyleTag({ content: "* { backdrop-filter: none !important; }" });
  }

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

  // A baseline with no section is dead weight `--update` can never remove (it
  // only writes) -- a renamed section would leave the old tile green forever.
  const orphans = [];
  for (const theme of themes) {
    const dir = join(SHOTS, theme);
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      if (!f.endsWith(".png") || f.endsWith(".actual.png") || f.endsWith(".diff.png")) continue;
      if (!slugs.includes(f.slice(0, -4))) orphans.push(join(theme, f));
    }
  }
  if (orphans.length) {
    console.error(`visual: ${orphans.length} orphaned baseline(s) with no matching section -- delete them:`);
    for (const o of orphans) console.error(`  ${o}`);
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

    // #186: a tile's antialiasing and clip rounding depend on the sub-pixel phase
    // of its section's document offset, so any height change ABOVE a section used
    // to re-render every tile below it (PR C: 128 of 156 changed tiles were phase
    // noise). Give each section an inline margin-top that lifts its top to an
    // integer, in document order so each snap accounts for the previous one; the
    // margin sits outside the border box a screenshot captures, so tiles do not
    // change. Cleared first: every theme has different heights.
    const fractional = await page.evaluate(() => {
      const sections = [...document.querySelectorAll("main > section")];
      for (const s of sections) s.style.marginTop = "";
      for (const s of sections) {
        const top = s.getBoundingClientRect().top + window.scrollY;
        const frac = top - Math.floor(top);
        if (frac > 0) s.style.marginTop = `${1 - frac}px`;
      }
      return sections
        .map((s) => s.getBoundingClientRect().top + window.scrollY)
        .filter((t) => Math.abs(t - Math.round(t)) > 1e-6);
    });
    if (fractional.length) {
      console.error(`visual: ${theme}: ${fractional.length} section(s) still at a fractional offset after snapping: ${fractional.join(", ")}`);
      process.exit(1);
    }

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
        // The dialog's close button sat under the pointer -- park it again so
        // the remainder of this theme's sections, and every theme after it,
        // don't capture a resting :hover there (#123).
        await page.mouse.move(0, 0);
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
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) await main();
