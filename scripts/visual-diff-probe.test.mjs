import assert from "node:assert/strict";
import { test } from "node:test";
import {
  diffBoundingBox,
  parseArgs,
  shiftedDiff,
  shiftTable,
  tilePath,
} from "./visual-diff-probe.mjs";

// Ten maximally-distinct, non-periodic colors: no two rows are close enough
// for pixelmatch's threshold to call them a match, and (unlike an alternating
// 2-color pattern) there's no repeating period that could coincidentally
// "match" at the WRONG shift too.
const ROW_PALETTE = [
  [0, 0, 0], [255, 255, 255], [255, 0, 0], [0, 200, 0], [0, 0, 255],
  [255, 255, 0], [255, 0, 255], [0, 255, 255], [128, 64, 16], [16, 64, 128],
];

function solidRowsPng(height, width = 4) {
  // Each row is a distinct, fully-opaque solid color from ROW_PALETTE -- a
  // shift that lines two rows up either matches exactly (0 differing px, the
  // same row reused) or is clearly wrong (a different palette entry).
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const [r, g, b] = ROW_PALETTE[y % ROW_PALETTE.length];
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

test("parseArgs: two bare PNG paths -> files mode", () => {
  assert.deepEqual(parseArgs(["a.png", "b.png"]), { mode: "files", old: "a.png", new: "b.png" });
});

test("parseArgs: --theme/--tile/--old/--new -> git mode", () => {
  assert.deepEqual(
    parseArgs(["--theme", "amber-ember", "--tile", "cards", "--old", "abc^", "--new", "abc"]),
    { mode: "git", theme: "amber-ember", tile: "cards", old: "abc^", new: "abc" },
  );
});

test("parseArgs: git mode missing a required flag throws", () => {
  assert.throws(() => parseArgs(["--theme", "t", "--tile", "x"]), /required/);
});

test("parseArgs: an unrecognized flag throws", () => {
  assert.throws(() => parseArgs(["--bogus", "x"]), /unrecognized/);
});

test("tilePath matches the path scripts/visual.mjs writes a baseline to", () => {
  assert.equal(tilePath("amber-ember", "cards"), "site/__screenshots__/amber-ember/cards.png");
});

test("shiftedDiff: dy=0 on identical images is 0", () => {
  const png = solidRowsPng(10);
  assert.equal(shiftedDiff(png, png, 0), 0);
});

test("shiftedDiff: content moved up one row minimizes at dy=-1, not dy=0 or dy=+1 -- the shift-direction mutation guard", () => {
  const old = solidRowsPng(10);
  // new = old's rows 1..9 (old's content shifted up by one row, matching
  // "content moved up one row" the same way PR #187's dy=-1 finding did).
  const new_ = { width: old.width, height: 9, data: old.data.subarray(old.width * 4) };

  const table = shiftTable(old, new_);
  const byDy = Object.fromEntries(table.rows.map((r) => [r.dy, r.differing]));

  assert.equal(byDy[-1], 0, "old shifted up by 1 row should align exactly with new at dy=-1");
  assert.ok(byDy[0] > 0, "unshifted (dy=0) must NOT be the minimum -- every row differs");
  assert.ok(byDy[1] > 0, "dy=+1 (the wrong direction) must NOT match either");
  assert.equal(table.best.dy, -1, "shiftTable must report the true minimum at dy=-1, not some other offset");
});

test("shiftedDiff: mismatched widths returns null (can't be meaningfully row-shifted)", () => {
  const a = solidRowsPng(10, 4);
  const b = solidRowsPng(10, 5);
  assert.equal(shiftedDiff(a, b, 0), null);
});

test("shiftedDiff: a shift magnitude >= height leaves no overlap, returns null", () => {
  const png = solidRowsPng(3);
  assert.equal(shiftedDiff(png, png, 3), null);
  assert.equal(shiftedDiff(png, png, -3), null);
});

test("diffBoundingBox: identical images have no differing pixels and no box", () => {
  const png = solidRowsPng(5);
  const result = diffBoundingBox(png, png);
  assert.equal(result.differing, 0);
  assert.equal(result.box, null);
});

test("diffBoundingBox: a single-pixel change reports a 1x1 box at that pixel", () => {
  const width = 6, height = 6;
  const old = { width, height, data: Buffer.alloc(width * height * 4, 0) };
  for (let i = 3; i < old.data.length; i += 4) old.data[i] = 255; // opaque
  const new_ = { width, height, data: Buffer.from(old.data) };
  // Flip one pixel (x=2, y=4) to white in `new`.
  const idx = (4 * width + 2) * 4;
  new_.data[idx] = 255;
  new_.data[idx + 1] = 255;
  new_.data[idx + 2] = 255;

  const result = diffBoundingBox(old, new_);
  assert.equal(result.differing, 1);
  assert.deepEqual(result.box, { minX: 2, maxX: 2, minY: 4, maxY: 4 });
});

test("diffBoundingBox: different sizes returns null (not a same-size comparison)", () => {
  const a = solidRowsPng(5, 4);
  const b = solidRowsPng(6, 4);
  assert.equal(diffBoundingBox(a, b), null);
});

// #198's acceptance bullet 2 (reproducing PR #187's "7142 raw, 217 after a
// one-row shift" finding via `node scripts/visual-diff-probe.mjs --theme
// amber-ember --tile bare-tags-headings-lists-paragraphs --old 9b1b652^ --new
// 9b1b652`) is deliberately NOT wired in here as an automated node:test case:
// it needs `git show 9b1b652^:...`, and CI's `actions/checkout@v7`
// (.github/workflows/ci.yml) takes the default depth-1 shallow clone, which
// doesn't have that commit's parent -- an automated version of this would
// pass locally (a full clone) and fail in CI on every PR. The bullet's real
// output is pasted in the PR instead; readPngFromGit stays exported for the
// CLI (and any future by-hand check) to use.
