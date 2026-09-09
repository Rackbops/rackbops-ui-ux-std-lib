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
// One spawn packs both packages. Keyed by each result's own package `name`,
// not array position: npm happens to preserve argument order today (verified
// against npm 11.17's pack.js), but its source flags a planned name-keyed
// output -- keying by name here means that change fails this test loudly,
// not silently passes it against the wrong package's file list (#93).
let packsByName;

before(() => {
  const stdout = execSync(`npm pack --dry-run --json ${PACKAGE_DIRS.map((dir) => `./${dir}`).join(" ")}`, {
    cwd: ROOT,
    encoding: "utf-8",
  });
  packsByName = new Map(JSON.parse(stdout).map((p) => [p.name, p]));
});

for (const dir of PACKAGE_DIRS) {
  test(`npm pack ships LICENSE and NOTICE from ${dir} (issue #38)`, () => {
    const { name } = JSON.parse(readFileSync(join(ROOT, dir, "package.json"), "utf-8"));
    const pack = packsByName.get(name);
    assert.ok(pack, `${dir}: no npm pack result for package "${name}"`);
    const paths = pack.files.map((f) => f.path);
    assert.ok(paths.includes("LICENSE"), `${dir}: npm pack output misses LICENSE`);
    assert.ok(paths.includes("NOTICE"), `${dir}: npm pack output misses NOTICE`);
  });
}
