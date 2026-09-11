// #198: "is the visual job deterministic here?" -- N no-edit control pairs,
// each pair two SEPARATE `node scripts/visual.mjs` processes (an --update
// then a compare, matching #190/#192's phase-1/phase-2 experiments and
// Subordinate #3's control-loop.sh), run against a TEMPORARY COPY of
// site/__screenshots__ so the committed baselines are never touched -- the
// throwaway versions of this script built during #186/#190/#192 pointed
// straight at the real baselines dir and had to be restored with
// `git checkout` after every run.
//
//   node scripts/visual-control.mjs [--pairs N] [--themes a,b] \
//     [--launch-args "..."] [--keep-glass]
//
//   --pairs N          number of update-then-compare pairs to run (default 3)
//   --themes a,b       comma-separated theme allowlist (default: every theme)
//   --launch-args "…"  passed through to chromium.launch() via visual.mjs's
//                      RB_VISUAL_LAUNCH_ARGS (the #192 compositor-pin hook)
//   --keep-glass       skip the #190 backdrop-filter override, via
//                      visual.mjs's RB_VISUAL_KEEP_GLASS
//
// Exits 1 if any pair regressed. Reuses scripts/visual.mjs's own
// PIXEL_THRESHOLD/MAX_DIFF_RATIO (imported, not duplicated) only insofar as
// visual.mjs itself already applies them -- this script never re-implements
// the comparison, it only parses visual.mjs's own stdout/stderr.
import { PIXEL_THRESHOLD, MAX_DIFF_RATIO } from "./visual.mjs";
import { execFile } from "node:child_process";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const VISUAL_SCRIPT = join(ROOT, "scripts", "visual.mjs");
export const REAL_SHOTS = join(ROOT, "site", "__screenshots__");

function takeValue(argv, i, flag) {
  // Only guards against a value that's simply missing (the flag was last on
  // the command line) -- NOT against a value that happens to start with
  // "--", since --launch-args's whole point is passing flag-shaped strings
  // like "--disable-gpu" through to chromium.launch().
  const v = argv[i];
  if (v === undefined) {
    throw new Error(`visual-control: ${flag} needs a value`);
  }
  return v;
}

export function parseArgs(argv) {
  const opts = { pairs: 3, themes: null, launchArgs: null, keepGlass: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--pairs") {
      opts.pairs = Number(takeValue(argv, ++i, "--pairs"));
    } else if (arg === "--themes") {
      opts.themes = takeValue(argv, ++i, "--themes");
    } else if (arg === "--launch-args") {
      opts.launchArgs = takeValue(argv, ++i, "--launch-args");
    } else if (arg === "--keep-glass") {
      opts.keepGlass = true;
    } else {
      throw new Error(`visual-control: unrecognized argument "${arg}"`);
    }
  }
  if (!Number.isInteger(opts.pairs) || opts.pairs < 1) {
    throw new Error(`visual-control: --pairs must be a positive integer, got ${JSON.stringify(argv)}`);
  }
  return opts;
}

// Parses one `node scripts/visual.mjs` compare-mode result (its combined
// stdout+stderr and exit code) into a pair verdict. visual.mjs prints either
// "visual: N tiles match their baselines" (exit 0) or "visual: N tile(s)
// regressed:" followed by one "  <rel>: <reason>" line per tile (exit 1) --
// this is the ONLY shape counted as a genuine regression. Any other exit-1
// output (an uncaught exception's stack trace, or one of visual.mjs's own
// non-regression hard-fail messages -- "nothing to capture", "duplicate
// section slug(s)", "orphaned baseline(s)", "still at a fractional offset",
// "names unknown theme(s)") is a HARD ERROR, not a regression -- a control
// run must never report a crash as "REGRESSED (<stack trace>)".
const REGRESSED_HEADER = /^visual: \d+ tile\(s\) regressed:$/;

export function parseCompareResult(exitCode, output) {
  if (exitCode === 0) {
    return { clean: true, tiles: [], hardError: false };
  }
  const lines = output.split("\n").map((l) => l.trim()).filter(Boolean);
  const headerIdx = lines.findIndex((l) => REGRESSED_HEADER.test(l));
  if (headerIdx === -1) {
    return { clean: false, tiles: [], hardError: true, raw: output };
  }
  const tiles = lines.slice(headerIdx + 1).map((l) => l.replace(/^-\s*/, ""));
  return { clean: false, tiles, hardError: false };
}

export function formatPairLine(pairNum, result) {
  if (result.clean) return `pair ${pairNum}: CLEAN`;
  return `pair ${pairNum}: REGRESSED (${result.tiles.join("; ")})`;
}

export function formatHardError(pairNum, step, output) {
  return `pair ${pairNum}: ${step} FAILED (not a regression -- a hard error):\n${output}`;
}

export function formatSummary(results) {
  const clean = results.filter((r) => r.clean).length;
  return `summary: ${clean}/${results.length} pairs clean`;
}

// The env a `node scripts/visual.mjs` child process runs with -- shotsDir is
// always a caller-supplied scratch path, NEVER REAL_SHOTS itself (that's the
// one thing standing between a control run and clobbering the committed
// baselines, per prepareRun's own mutation-guarded test below).
export function buildEnv(opts, shotsDir, baseEnv = process.env) {
  const env = { ...baseEnv, RB_VISUAL_SHOTS_DIR: shotsDir };
  if (opts.themes) env.RB_VISUAL_THEMES = opts.themes;
  if (opts.launchArgs) env.RB_VISUAL_LAUNCH_ARGS = opts.launchArgs;
  if (opts.keepGlass) env.RB_VISUAL_KEEP_GLASS = "1";
  return env;
}

// Copies the real committed baselines into a fresh scratch dir and builds the
// env pointing visual.mjs at that copy -- pure filesystem work, no browser,
// so this (unlike runVisual/main) is fast and safe to exercise in node:test.
// If the copy itself fails partway through, the scratch dir is removed
// before rethrowing rather than left to leak (mkdtemp succeeding doesn't
// guarantee cp will).
export async function prepareRun(opts) {
  const tempShots = await mkdtemp(join(tmpdir(), "rb-visual-control-"));
  try {
    await cp(REAL_SHOTS, tempShots, { recursive: true });
  } catch (err) {
    await rm(tempShots, { recursive: true, force: true });
    throw err;
  }
  const env = buildEnv(opts, tempShots);
  return { tempShots, env };
}

const CHILD_TIMEOUT_MS = 5 * 60 * 1000;

async function runVisual(args, env) {
  try {
    const { stdout } = await execFileAsync(process.execPath, [VISUAL_SCRIPT, ...args], {
      env,
      maxBuffer: 16 * 1024 * 1024,
      timeout: CHILD_TIMEOUT_MS,
    });
    return { exitCode: 0, output: stdout };
  } catch (err) {
    // execFile rejects on a non-zero exit (or on hitting `timeout`, where
    // `err.killed` is true and `err.code` is null); visual.mjs's failure
    // text is on stderr, its success text on stdout -- combine both so
    // parseCompareResult sees whichever the exit path actually used.
    const output = err.killed
      ? `visual-control: child process timed out after ${CHILD_TIMEOUT_MS}ms\n${err.stdout ?? ""}${err.stderr ?? ""}`
      : `${err.stdout ?? ""}${err.stderr ?? ""}`;
    return { exitCode: err.code ?? 1, output };
  }
}

// Runs one update-then-compare pair against the given env, via the given
// runner (injected so the exact-env wiring below is unit-testable without a
// real child process or browser). Returns either a hard-error report (the
// --update step itself failed, or the compare step didn't print visual.mjs's
// own documented regression format) or a genuine pair verdict.
export async function runPair(env, runVisualFn = runVisual) {
  const updateRun = await runVisualFn(["--update"], env);
  if (updateRun.exitCode !== 0) {
    return { hardError: true, step: "--update", output: updateRun.output };
  }
  const compareRun = await runVisualFn([], env);
  const result = parseCompareResult(compareRun.exitCode, compareRun.output);
  if (result.hardError) {
    return { hardError: true, step: "compare", output: result.raw };
  }
  return { hardError: false, result };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const { tempShots, env } = await prepareRun(opts);

  console.log(`visual-control: ${opts.pairs} pair(s), threshold ${PIXEL_THRESHOLD}, max diff ratio ${MAX_DIFF_RATIO}, scratch dir ${tempShots}`);

  const results = [];
  try {
    for (let i = 1; i <= opts.pairs; i++) {
      const pair = await runPair(env);
      if (pair.hardError) {
        console.error(formatHardError(i, pair.step, pair.output));
        process.exitCode = 1;
        return;
      }
      results.push(pair.result);
      console.log(formatPairLine(i, pair.result));
    }
  } finally {
    await rm(tempShots, { recursive: true, force: true });
  }

  console.log(formatSummary(results));
  if (results.some((r) => !r.clean)) process.exitCode = 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) await main();
