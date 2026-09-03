// Release version-bump rules. The script lives with the release automation
// (.github/scripts/next-version.sh) but is tested here so `pnpm test` in
// styles/ is the repo's single test entrypoint.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPT = resolve(
  fileURLToPath(import.meta.url),
  "../../../.github/scripts/next-version.sh"
);
// Handed to bash as a -c string (never opened by path) so this doesn't care
// which bash ends up on PATH -- e.g. on Windows, PowerShell can resolve
// `bash` to the WSL App-Execution-alias stub, which can't translate a native
// Windows path (see issue #35).
const SCRIPT_SRC = readFileSync(SCRIPT, "utf8");

function next(current, messages) {
  return execFileSync("bash", ["-c", SCRIPT_SRC, "next-version.sh", current], { input: messages })
    .toString()
    .trim();
}

test("plain commits bump the patch", () => {
  assert.equal(next("0.2.3", "feat: add a component\nfix(styles): tweak"), "0.2.4");
});

test("a ! subject bumps the minor and resets the patch while major is 0", () => {
  assert.equal(next("0.2.3", "feat!: scope every rule under data-rb-style"), "0.3.0");
  assert.equal(next("0.2.3", "feat(styles)!: scoped tokens"), "0.3.0");
});

test("a BREAKING CHANGE footer bumps the minor too", () => {
  assert.equal(next("0.2.3", "feat: rework tokens\n\nBREAKING CHANGE: tokens moved"), "0.3.0");
  assert.equal(next("0.2.3", "feat: rework\n\nBREAKING-CHANGE: hyphen form"), "0.3.0");
});

test("breaking bumps the major once past 1.0", () => {
  assert.equal(next("1.4.2", "fix!: remove old names"), "2.0.0");
});

test("a ! elsewhere in prose does not count", () => {
  assert.equal(next("0.2.3", "feat: make it pop! more glow"), "0.2.4");
});

test("mixed log: one breaking commit is enough", () => {
  assert.equal(next("0.2.3", "fix: small thing\nfeat!: the big one\nchore: cleanup"), "0.3.0");
});

test("rejects malformed versions", () => {
  assert.throws(
    () => next("1.2", "fix: x"),
    (err) => {
      assert.match(err.stderr.toString(), /unexpected version format/);
      assert.equal(err.stdout.toString(), "");
      return true;
    }
  );
});
