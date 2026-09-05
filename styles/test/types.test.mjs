// TS2882 regression check: a side-effect import of any theme export must type-check clean under
// TypeScript's stricter moduleResolution/noUncheckedSideEffectImports
// checking, with no consumer-side shim. The fixture lives inside styles/
// (not an OS temp dir) so TypeScript's self-referencing-by-package-name
// resolves "@rackbops/styles/*" straight to this package's own exports map.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const manifest = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf-8"));
const themes = Object.keys(manifest.themes).sort();
const TSC = join(ROOT, "node_modules", "typescript", "bin", "tsc");

function sampleComponent(theme) {
  const files = readdirSync(join(ROOT, theme, "components")).filter((f) => f.endsWith(".css"));
  return files[0].replace(/\.css$/, "");
}

function consumerSource() {
  const lines = ['import "@rackbops/styles/all";'];
  for (const theme of themes) {
    lines.push(
      `import "@rackbops/styles/${theme}";`,
      `import "@rackbops/styles/${theme}/tokens";`,
      `import "@rackbops/styles/${theme}/base";`,
      `import "@rackbops/styles/${theme}/components/${sampleComponent(theme)}";`
    );
  }
  return lines.join("\n") + "\n";
}

function typecheck(source) {
  const dir = mkdtempSync(join(ROOT, "test", ".tmp-types-"));
  const file = join(dir, "consumer.ts");
  writeFileSync(file, source);
  try {
    return execFileSync(
      process.execPath,
      [
        TSC,
        "--noEmit",
        "--moduleResolution", "bundler",
        "--module", "esnext",
        "--target", "es2022",
        "--noUncheckedSideEffectImports",
        file,
      ],
      { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] }
    );
  } catch (err) {
    // tsc writes its diagnostics to stdout, but execFileSync's thrown error
    // puts only stderr in .message (here just "Command failed"). Rethrow with
    // stdout/stderr attached so a TS regression names the file, theme, and TS
    // code instead of surfacing an opaque "Command failed".
    const detail = [err.stdout, err.stderr].filter(Boolean).join("\n").trim();
    throw new Error(detail ? `tsc failed:\n${detail}` : err.message);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("every theme export type-checks clean under noUncheckedSideEffectImports", () => {
  assert.doesNotThrow(() => typecheck(consumerSource()));
});

test("typecheck surfaces tsc diagnostics on failure, not an opaque 'Command failed'", () => {
  // Guards the catch in typecheck(): a deliberate type error must reach the
  // assertion as a tsc diagnostic (error TSxxxx), not "Command failed" with
  // the real message swallowed on err.stdout -- otherwise a real TS2882
  // regression fails with no file/theme/code to act on.
  assert.throws(
    () => typecheck('const wrong: number = "not a number";\n'),
    /error TS\d+/,
    "typecheck must rethrow with the tsc diagnostic text in the message"
  );
});
