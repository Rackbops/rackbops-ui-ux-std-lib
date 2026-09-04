#!/usr/bin/env node
// Copies the repo-root LICENSE and NOTICE into a package directory before it
// is packed or published -- both files live only at the repo root, and
// neither @rackbops/styles nor @rackbops/ui-react's `files` allowlist reaches
// outside its own package directory, so without this the published tarball
// carries neither (issue #38). Wired into each package's `prepack` script;
// npm runs lifecycle scripts with cwd set to that package's directory, so
// running this file directly copies into process.cwd() by default.
import { copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const SOURCE_FILES = ["LICENSE", "NOTICE"];

export function copyLicenseFiles(targetDir) {
  for (const name of SOURCE_FILES) {
    copyFileSync(join(ROOT, name), join(targetDir, name));
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) copyLicenseFiles(process.cwd());
