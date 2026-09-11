import assert from "node:assert/strict";
import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  REAL_SHOTS,
  buildEnv,
  formatHardError,
  formatPairLine,
  formatSummary,
  parseArgs,
  parseCompareResult,
  prepareRun,
  runPair,
} from "./visual-control.mjs";

test("parseArgs: defaults with no flags", () => {
  assert.deepEqual(parseArgs([]), { pairs: 3, themes: null, launchArgs: null, keepGlass: false });
});

test("parseArgs: every flag", () => {
  assert.deepEqual(
    parseArgs(["--pairs", "5", "--themes", "a,b", "--launch-args", "--disable-gpu", "--keep-glass"]),
    { pairs: 5, themes: "a,b", launchArgs: "--disable-gpu", keepGlass: true },
  );
});

test("parseArgs: --pairs must be a positive integer", () => {
  assert.throws(() => parseArgs(["--pairs", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--pairs", "abc"]), /positive integer/);
});

test("parseArgs: an unrecognized flag throws", () => {
  assert.throws(() => parseArgs(["--bogus"]), /unrecognized/);
});

test("parseCompareResult: exit 0 is clean regardless of stray output", () => {
  assert.deepEqual(parseCompareResult(0, "visual: 16 tiles match their baselines\n"), { clean: true, tiles: [], hardError: false });
});

test("parseCompareResult: exit 1 with visual.mjs's own regressed-tile format parses the tile lines, dropping the summary line", () => {
  const output = [
    "visual: 2 tile(s) regressed:",
    "  amber-ember/cards.png: 120 px differ",
    "  amber-ember/alerts.png: size 952x410 vs baseline 952x412",
    "",
  ].join("\n");
  assert.deepEqual(parseCompareResult(1, output), {
    clean: false,
    tiles: ["amber-ember/cards.png: 120 px differ", "amber-ember/alerts.png: size 952x410 vs baseline 952x412"],
    hardError: false,
  });
});

// A crash (uncaught exception, or one of visual.mjs's own non-regression
// exit-1 messages -- "nothing to capture", "duplicate section slug(s)", etc.)
// must never be reported as a regression: none of these start with
// visual.mjs's own "visual: N tile(s) regressed:" header.
test("parseCompareResult: exit 1 WITHOUT the regressed-tile header is a hard error, not a regression", () => {
  const stackTrace = "TypeError: Cannot read properties of undefined (reading 'width')\n    at file:///scripts/visual.mjs:210:20";
  const result = parseCompareResult(1, stackTrace);
  assert.equal(result.hardError, true);
  assert.equal(result.clean, false);
  assert.deepEqual(result.tiles, []);
  assert.equal(result.raw, stackTrace);
});

test("parseCompareResult: exit 1 with visual.mjs's own non-regression hard-fail message is a hard error too", () => {
  const result = parseCompareResult(1, "visual: 2 orphaned baseline(s) with no matching section -- delete them:\n  amber-ember/old-tile.png\n");
  assert.equal(result.hardError, true);
  assert.equal(result.clean, false);
});

test("formatPairLine: clean and regressed", () => {
  assert.equal(formatPairLine(1, { clean: true, tiles: [] }), "pair 1: CLEAN");
  assert.equal(
    formatPairLine(2, { clean: false, tiles: ["a: 1 px differ", "b: 2 px differ"] }),
    "pair 2: REGRESSED (a: 1 px differ; b: 2 px differ)",
  );
});

test("formatHardError names the failing step and includes the raw output", () => {
  const msg = formatHardError(3, "compare", "TypeError: boom\n    at foo.mjs:1:1");
  assert.match(msg, /^pair 3: compare FAILED \(not a regression -- a hard error\):/);
  assert.match(msg, /TypeError: boom/);
});

test("formatSummary counts clean pairs", () => {
  assert.equal(
    formatSummary([{ clean: true, tiles: [] }, { clean: false, tiles: ["x"] }, { clean: true, tiles: [] }]),
    "summary: 2/3 pairs clean",
  );
});

test("buildEnv sets RB_VISUAL_SHOTS_DIR to exactly the given scratch dir, and only sets the optional vars that were requested", () => {
  const env = buildEnv({}, "/tmp/scratch-xyz", {});
  assert.equal(env.RB_VISUAL_SHOTS_DIR, "/tmp/scratch-xyz");
  assert.equal("RB_VISUAL_THEMES" in env, false);
  assert.equal("RB_VISUAL_LAUNCH_ARGS" in env, false);
  assert.equal("RB_VISUAL_KEEP_GLASS" in env, false);

  const full = buildEnv({ themes: "a,b", launchArgs: "--disable-gpu", keepGlass: true }, "/tmp/scratch-xyz", {});
  assert.equal(full.RB_VISUAL_THEMES, "a,b");
  assert.equal(full.RB_VISUAL_LAUNCH_ARGS, "--disable-gpu");
  assert.equal(full.RB_VISUAL_KEEP_GLASS, "1");
});

// The mutation guard #198 asks for: "make the control runner write to the
// real baselines dir -> its test fails." prepareRun is the one place that
// decides where a run's baselines live; this exercises it for real (real
// mkdtemp + real fs.cp, no browser) and asserts the result never resolves to
// REAL_SHOTS, and that the scratch copy genuinely holds the baselines' content
// (not an empty dir a looser mutation could still satisfy).
test("prepareRun copies the real baselines into a scratch dir and points the env at THAT dir, never REAL_SHOTS", async () => {
  const { tempShots, env } = await prepareRun({});
  try {
    assert.notEqual(resolve(tempShots), resolve(REAL_SHOTS), "scratch dir must not be the real baselines dir");
    assert.equal(env.RB_VISUAL_SHOTS_DIR, tempShots, "the child-process env must point at the scratch dir");
    assert.notEqual(resolve(env.RB_VISUAL_SHOTS_DIR), resolve(REAL_SHOTS), "the env must not point at the real baselines dir");

    const realThemeDirs = (await readdir(REAL_SHOTS)).sort();
    const copiedThemeDirs = (await readdir(tempShots)).sort();
    assert.deepEqual(copiedThemeDirs, realThemeDirs, "the scratch dir must be seeded with a real copy, not left empty");
  } finally {
    await rm(tempShots, { recursive: true, force: true });
  }
});

// prepareRun (above) proves the SCRATCH env it builds never points at
// REAL_SHOTS -- but nothing stopped main()'s call sites from ignoring that
// env and using process.env (which falls back to the real baselines dir
// inside visual.mjs) instead. This closes that gap: runPair takes an
// injectable runner precisely so this is checkable without a real child
// process, and asserts the SAME env object (reference equality) reaches
// every runVisualFn call -- a call site swapped to process.env, or to any
// other env, fails this immediately.
test("runPair invokes the runner with exactly the env it was given, for both the update and compare steps -- the real-baselines-dir mutation guard", async () => {
  const fakeEnv = { RB_VISUAL_SHOTS_DIR: "/tmp/fake-scratch-for-this-test-only" };
  const calls = [];
  const fakeRunVisual = async (args, env) => {
    calls.push({ args, env });
    return { exitCode: 0, output: "visual: 1 tiles match their baselines\n" };
  };

  const pair = await runPair(fakeEnv, fakeRunVisual);

  assert.equal(pair.hardError, false);
  assert.equal(calls.length, 2, "one update call, one compare call");
  for (const call of calls) {
    assert.equal(call.env, fakeEnv, "runVisualFn must receive the exact env object runPair was given, never process.env or REAL_SHOTS");
  }
  assert.deepEqual(calls.map((c) => c.args), [["--update"], []]);
});

test("runPair reports the --update step as a hard error, not a regression, when it fails", async () => {
  const fakeRunVisual = async (args) => {
    if (args[0] === "--update") return { exitCode: 1, output: "ENOENT: no such file or directory" };
    throw new Error("compare should never run when --update failed");
  };
  const pair = await runPair({}, fakeRunVisual);
  assert.deepEqual(pair, { hardError: true, step: "--update", output: "ENOENT: no such file or directory" });
});

test("runPair reports a compare-step crash as a hard error, not REGRESSED", async () => {
  const stackTrace = "TypeError: Cannot read properties of undefined\n    at visual.mjs:210:20";
  const fakeRunVisual = async (args) =>
    args.length === 1 ? { exitCode: 0, output: "visual: updated 1 themes x 1 sections\n" } : { exitCode: 1, output: stackTrace };
  const pair = await runPair({}, fakeRunVisual);
  assert.equal(pair.hardError, true);
  assert.equal(pair.step, "compare");
  assert.equal(pair.output, stackTrace);
});
