// #198: "is this baseline diff a phase shift or a content change?" -- takes
// two PNGs and prints the size change, the raw differing pixel count at the
// visual job's own threshold, the residual after shifting the OLD tile's
// content by -2..+2 rows (a real content change stays high at every shift; a
// pure sub-pixel phase shift, #186's mechanism, drops to near-zero at one
// offset), and the bounding box of the raw (unshifted) differing pixels.
// Built from the row-shift method the orchestrator ran by hand on PR #187 and
// #190 (never itself committed) and Subordinate #3's scripts/190-diff-probe.mjs
// (its bbox scan, generalized past that script's hardcoded theme/path list).
//
//   node scripts/visual-diff-probe.mjs <old.png> <new.png>
//   node scripts/visual-diff-probe.mjs --theme t --tile slug --old <rev> --new <rev>
//
// The --old/--new form reads site/__screenshots__/<theme>/<tile>.png at each
// rev via `git show <rev>:<path>` -- no worktree checkout needed, so it works
// against any two commits without disturbing the current tree.
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PIXEL_THRESHOLD } from "./visual.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SHIFTS = [-2, -1, 0, 1, 2];

export function parseArgs(argv) {
  if (argv.length === 2 && !argv[0].startsWith("--")) {
    return { mode: "files", old: argv[0], new: argv[1] };
  }
  const opts = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--theme") opts.theme = argv[++i];
    else if (arg === "--tile") opts.tile = argv[++i];
    else if (arg === "--old") opts.old = argv[++i];
    else if (arg === "--new") opts.new = argv[++i];
    else throw new Error(`visual-diff-probe: unrecognized argument "${arg}"`);
  }
  if (!opts.theme || !opts.tile || !opts.old || !opts.new) {
    throw new Error("visual-diff-probe: --theme, --tile, --old and --new are all required (or pass two PNG paths)");
  }
  return { mode: "git", ...opts };
}

// The exact repo-relative path scripts/visual.mjs writes a baseline to.
export function tilePath(theme, tile) {
  return `site/__screenshots__/${theme}/${tile}.png`;
}

export function readPngFromGit(theme, tile, rev) {
  const buf = execFileSync("git", ["show", `${rev}:${tilePath(theme, tile)}`], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
  return PNG.sync.read(buf);
}

function extractRows(png, rowStart, rowCount) {
  const bytesPerRow = png.width * 4;
  return png.data.subarray(rowStart * bytesPerRow, (rowStart + rowCount) * bytesPerRow);
}

// Differing-pixel count with the OLD tile's rows shifted by dy (positive =
// content moved down, negative = up), compared against NEW over the height
// the two share after the shift. dy=0 is the plain, unshifted diff. Returns
// null when the shift leaves no overlapping rows (dy magnitude >= height) or
// the two images don't share a width (can't be meaningfully row-shifted).
export function shiftedDiff(oldPng, newPng, dy, threshold = PIXEL_THRESHOLD) {
  if (oldPng.width !== newPng.width) return null;
  const width = oldPng.width;
  const baseHeight = Math.min(oldPng.height, newPng.height);
  const commonHeight = baseHeight - Math.abs(dy);
  if (commonHeight <= 0) return null;
  const oldStart = dy < 0 ? -dy : 0;
  const newStart = dy > 0 ? dy : 0;
  const oldRows = extractRows(oldPng, oldStart, commonHeight);
  const newRows = extractRows(newPng, newStart, commonHeight);
  return pixelmatch(oldRows, newRows, null, width, commonHeight, { threshold });
}

export function shiftTable(oldPng, newPng, threshold = PIXEL_THRESHOLD, shifts = SHIFTS) {
  const rows = shifts.map((dy) => ({ dy, differing: shiftedDiff(oldPng, newPng, dy, threshold) }));
  const valid = rows.filter((r) => r.differing !== null);
  const best = valid.length ? valid.reduce((a, b) => (b.differing < a.differing ? b : a)) : null;
  return { rows, best };
}

// Bounding box of the differing pixels between two same-size images, at the
// given threshold -- null if they're byte/threshold-identical or not the same
// size (a size change is reported separately; this only makes sense same-size).
export function diffBoundingBox(oldPng, newPng, threshold = PIXEL_THRESHOLD) {
  if (oldPng.width !== newPng.width || oldPng.height !== newPng.height) return null;
  const { width, height } = oldPng;
  const diff = new PNG({ width, height });
  // diffMask: true draws the diff over a transparent background (only truly
  // differing pixels get non-zero colour) -- pixelmatch's default instead
  // renders a dimmed grayscale copy of the source for MATCHING pixels too,
  // which would make every matching pixel's channel look "non-zero" and blow
  // the bounding box out to the full canvas.
  const differing = pixelmatch(oldPng.data, newPng.data, diff.data, width, height, { threshold, diffMask: true });
  if (differing === 0) return { differing, box: null };
  let minX = width, maxX = -1, minY = height, maxY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (diff.data[idx] !== 0 || diff.data[idx + 1] !== 0 || diff.data[idx + 2] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return { differing, box: { minX, maxX, minY, maxY } };
}

export function formatReport(label, oldPng, newPng, threshold = PIXEL_THRESHOLD) {
  const lines = [];
  const sameSize = oldPng.width === newPng.width && oldPng.height === newPng.height;
  lines.push(`${label}: old ${oldPng.width}x${oldPng.height}, new ${newPng.width}x${newPng.height}${sameSize ? "" : " (SIZE CHANGED)"}`);

  const { rows, best } = shiftTable(oldPng, newPng, threshold);
  const raw = rows.find((r) => r.dy === 0);
  if (raw && raw.differing !== null) {
    const area = Math.min(oldPng.width, newPng.width) * Math.min(oldPng.height, newPng.height);
    lines.push(`raw differing pixels (threshold ${threshold}): ${raw.differing} (${((raw.differing / area) * 100).toFixed(4)}%)`);
  } else {
    lines.push("raw differing pixels: N/A (no overlapping rows)");
  }

  lines.push("row-shift residual:");
  for (const r of rows) {
    lines.push(`  dy=${r.dy >= 0 ? "+" + r.dy : r.dy}: ${r.differing === null ? "N/A" : r.differing}`);
  }
  if (best) {
    lines.push(`  best: dy=${best.dy >= 0 ? "+" + best.dy : best.dy} (${best.differing} px)`);
  }

  if (sameSize) {
    const bbox = diffBoundingBox(oldPng, newPng, threshold);
    if (bbox.differing === 0) {
      lines.push("bounding box: no differing pixels");
    } else {
      const { minX, maxX, minY, maxY } = bbox.box;
      lines.push(`bounding box: x[${minX},${maxX}] y[${minY},${maxY}] (${maxX - minX + 1}x${maxY - minY + 1})`);
    }
  } else {
    lines.push("bounding box: N/A (size changed)");
  }

  return lines.join("\n");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let oldPng, newPng, label;
  if (opts.mode === "files") {
    oldPng = PNG.sync.read(readFileSync(opts.old));
    newPng = PNG.sync.read(readFileSync(opts.new));
    label = `${opts.old} vs ${opts.new}`;
  } else {
    oldPng = readPngFromGit(opts.theme, opts.tile, opts.old);
    newPng = readPngFromGit(opts.theme, opts.tile, opts.new);
    label = `${opts.theme}/${opts.tile}: ${opts.old} vs ${opts.new}`;
  }
  console.log(formatReport(label, oldPng, newPng));
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) await main();
