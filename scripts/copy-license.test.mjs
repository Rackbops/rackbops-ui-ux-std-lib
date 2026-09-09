import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { before, test } from "node:test";
import { fileURLToPath } from "node:url";
import { copyLicenseFiles } from "./copy-license.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

test("copyLicenseFiles copies LICENSE and NOTICE byte-identical into the target directory", (t) => {
  const dir = mkdtempSync(join(tmpdir(), "copy-license-test-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  copyLicenseFiles(dir);

  for (const name of ["LICENSE", "NOTICE"]) {
    assert.equal(
      readFileSync(join(dir, name), "utf-8"),
      readFileSync(join(ROOT, name), "utf-8"),
      `${name} was not copied byte-identical`
    );
  }
});

const PACKAGE_DIRS = ["styles", "components/react"];

for (const dir of PACKAGE_DIRS) {
  test(`${dir}/package.json ships LICENSE and NOTICE`, () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf-8"));
    assert.ok(pkg.files.includes("LICENSE"), `${dir}: files misses LICENSE`);
    assert.ok(pkg.files.includes("NOTICE"), `${dir}: files misses NOTICE`);
  });
}

// Unlike the files-array check above, this actually runs `npm pack` -- the
// files array alone can't catch a broken or missing `prepack` (a deleted
// prepack script, or one pointing at the wrong relative depth, both leave
// `files` untouched but silently drop LICENSE/NOTICE from the real tarball).
// One spawn packs both packages; npm preserves argument order in its JSON
// array, so `packs[i]` lines up with `PACKAGE_DIRS[i]`.
let packs;

before(() => {
  const stdout = execSync(`npm pack --dry-run --json ${PACKAGE_DIRS.map((dir) => `./${dir}`).join(" ")}`, {
    cwd: ROOT,
    encoding: "utf-8",
  });
  packs = JSON.parse(stdout);
});

for (const [i, dir] of PACKAGE_DIRS.entries()) {
  test(`npm pack ships LICENSE and NOTICE from ${dir} (issue #38)`, () => {
    const paths = packs[i].files.map((f) => f.path);
    assert.ok(paths.includes("LICENSE"), `${dir}: npm pack output misses LICENSE`);
    assert.ok(paths.includes("NOTICE"), `${dir}: npm pack output misses NOTICE`);
  });
}
