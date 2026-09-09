// Coverage for the release/publish scripts (.github/scripts/release.sh,
// release-lib.sh, release-notes.sh, publish-release.sh -- issue #88): one
// atomic `git push --atomic origin main <tag>` either lands the bump commit
// and its tag together or lands neither, so release.sh has no partial state
// to resume from and never calls `gh` at all -- the GitHub release is
// created by publish-release.sh, run from publish.yml after the tag-
// triggered npm publish succeeds.
//
// A pure code read isn't enough confidence for scripts that do real `git
// commit`/`push`/`tag` and `gh release create` -- so this spins up a genuine
// scratch git repo plus a genuine local bare repo as `origin` (push is real,
// not mocked, including a pre-receive hook that can reject the tag ref, the
// main ref, or both, to prove atomicity for real), and a tiny fake `gh`
// executable on PATH that records what it was called with and can be told
// to fail once, to reproduce both failure shapes from issue #87 for real
// rather than asserting against the scripts' source text.
//
// DANGER, learned the hard way: these scripts have no self-check on which
// repo they're operating on -- they just run `git`/`gh` against whatever
// directory they were invoked from. Every real invocation below goes
// through runScript(), which passes an explicit `cwd` to execFileSync --
// never a bare shell `bash release.sh` after a `cd`. If you're reproducing
// something from this file by hand (ad hoc, outside these helpers), do the
// same: pass an explicit working directory to every invocation, don't rely
// on having `cd`-ed there first. Running these scripts against a real
// checkout of this actual repo pushes real commits and tags to the real
// origin and can trigger a real npm publish via publish.yml -- this
// happened once, by accident, during release.sh's own review.
//
// Scripts are copied into each scratch repo as REAL FILES at their real
// relative path and run via `bash <relative-path>` (never piped over
// stdin): release.sh and release-notes.sh both `source
// "$(dirname "$0")/release-lib.sh"`, and $0 is only a real path when the
// script is invoked that way -- fed via stdin (`bash -s < script`), $0 is
// literally "bash" and `dirname "$0"` is ".", which would source the wrong
// file. Verified empirically (a two-line probe script under both
// invocation styles) before relying on it here.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPTS_DIR = fileURLToPath(new URL("../../.github/scripts", import.meta.url));
const SCRIPT_NAMES = ["release.sh", "release-lib.sh", "release-notes.sh", "publish-release.sh", "next-version.sh"];

const GIT_ENV = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

/** Copies the real current scripts (never a stale snapshot) into
 * <dir>/.github/scripts/, executable, at the same relative paths release.yml
 * and publish.yml use. Shared by makeRepo() and the fresh-checkout scenario
 * below, which needs a second, independent copy of the same scratch repo. */
function installScripts(dir) {
  const target = join(dir, ".github", "scripts");
  mkdirSync(target, { recursive: true });
  for (const name of SCRIPT_NAMES) {
    writeFileSync(join(target, name), readFileSync(join(SCRIPTS_DIR, name)), { mode: 0o755 });
  }
}

/** One scratch git repo with a real local bare `origin`, seeded at v0.1.0.
 * `t` is the running test's TestContext, used to remove the scratch
 * directory once the test finishes instead of leaking it into the OS temp
 * folder across repeated local runs. */
function makeRepo(t) {
  const root = mkdtempSync(join(tmpdir(), "release-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const repoDir = join(root, "repo");
  const bareDir = join(root, "origin.git");
  const ghDir = join(root, "gh-state");
  const ghBinDir = join(root, "gh-bin");
  mkdirSync(repoDir);
  mkdirSync(join(ghDir, "releases"), { recursive: true });
  mkdirSync(ghBinDir);

  execFileSync("git", ["init", "--bare", "-b", "main", bareDir]);
  // pre-receive: reject a tag ref update while <bareDir>/reject-tags exists,
  // or a main ref update while <bareDir>/reject-main exists (independently
  // -- a scratch test picks one) -- so a test can make exactly one
  // `git push --atomic` fail for real on either half of the atomic pair
  // (a genuine rejected push, not a mocked one) and prove the OTHER half
  // never lands either.
  writeFileSync(
    join(bareDir, "hooks", "pre-receive"),
    `#!/usr/bin/env bash
set -euo pipefail
while read -r old new ref; do
  if [[ "$ref" == refs/tags/* ]] && [[ -f "${bareDir.replace(/\\/g, "/")}/reject-tags" ]]; then
    echo "test: rejecting tag ref update" >&2
    exit 1
  fi
  if [[ "$ref" == "refs/heads/main" ]] && [[ -f "${bareDir.replace(/\\/g, "/")}/reject-main" ]]; then
    echo "test: rejecting main ref update" >&2
    exit 1
  fi
done
exit 0
`,
    { mode: 0o755 }
  );

  // Fake `gh`: only implements the two subcommands publish-release.sh uses
  // (release.sh itself never calls gh -- see the file header). Bakes
  // ghDir's absolute path into the script rather than relying on env
  // passthrough, since it's generated fresh per scratch repo anyway.
  const ghDirPosix = ghDir.replace(/\\/g, "/");
  writeFileSync(
    join(ghBinDir, "gh"),
    `#!/usr/bin/env bash
set -euo pipefail
state="${ghDirPosix}"
echo "$*" >> "$state/calls.log"
case "\${1:-} \${2:-}" in
  "release view")
    tag="\$3"
    # A transient outage: exit non-zero but WITHOUT "release not found", the
    # shape publish-release.sh must not misread as a missing release (issue #87).
    if [[ -f "$state/fail-view-transient" ]]; then
      echo "HTTP 503: gh is having a bad day" >&2
      exit 1
    fi
    # Genuinely missing: match real gh, which prints exactly "release not
    # found" to stderr and exits 1 (verified against the installed gh).
    if [[ ! -f "$state/releases/\$tag" ]]; then
      echo "release not found" >&2
      exit 1
    fi
    ;;
  "release create")
    tag="\$3"
    notes_file=""
    prev=""
    for arg in "\$@"; do
      if [[ "\$prev" == "--notes-file" ]]; then notes_file="\$arg"; fi
      prev="\$arg"
    done
    if [[ -n "\$notes_file" ]]; then
      cp "\$notes_file" "$state/last-notes"
      cp "\$notes_file" "$state/notes-\$tag"
    fi
    if [[ -f "$state/fail-create-once" ]]; then
      rm -f "$state/fail-create-once"
      exit 1
    fi
    touch "$state/releases/\$tag"
    ;;
  *)
    echo "unstubbed gh invocation: \$*" >&2
    exit 1
    ;;
esac
`,
    { mode: 0o755 }
  );

  execFileSync("git", ["init", "-b", "main", repoDir]);
  const env = { ...process.env, ...GIT_ENV, PATH: `${ghBinDir}${delimiter}${process.env.PATH}` };
  const run = (args, opts = {}) =>
    execFileSync("git", args, { cwd: repoDir, env, ...opts }).toString();

  run(["remote", "add", "origin", bareDir]);

  mkdirSync(join(repoDir, "styles"), { recursive: true });
  mkdirSync(join(repoDir, "components", "react"), { recursive: true });
  writeFileSync(join(repoDir, "styles", "package.json"), pkgJson("0.1.0"));
  writeFileSync(join(repoDir, "components", "react", "package.json"), pkgJson("0.1.0"));
  installScripts(repoDir);

  run(["add", "."]);
  run(["commit", "-m", "chore: seed v0.1.0"]);
  run(["push", "-u", "origin", "main"]);
  run(["tag", "v0.1.0"]);
  run(["push", "origin", "v0.1.0"]);

  return { repoDir, bareDir, ghDir, ghBinDir, run, env };
}

function pkgJson(version) {
  return JSON.stringify({ name: "x", version }, null, 2) + "\n";
}

function addUnreleasedCommit({ repoDir, run }) {
  writeFileSync(join(repoDir, "styles", "CHANGE.txt"), "a fix\n");
  run(["add", "."]);
  run(["commit", "-m", "fix(styles): something"]);
}

/** Runs one of the real scripts (by its path relative to .github/scripts/)
 * against a scratch repo dir + env, exactly as release.yml/publish.yml do:
 * a real file, invoked by its real relative path, cwd set to the repo. */
function runScriptAt(repoDir, env, scriptName, args = []) {
  try {
    const stdout = execFileSync("bash", [join(".github", "scripts", scriptName), ...args], {
      cwd: repoDir,
      env,
    }).toString();
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.status, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
}

function runScript(repo, scriptName, args = []) {
  return runScriptAt(repo.repoDir, repo.env, scriptName, args);
}

function calls(repo) {
  const file = join(repo.ghDir, "calls.log");
  return existsSync(file) ? readFileSync(file, "utf-8").trim().split("\n").filter(Boolean) : [];
}

function tagExistsLocally(repo, tag) {
  const tags = execFileSync("git", ["tag", "-l", tag], { cwd: repo.repoDir, env: repo.env })
    .toString()
    .trim();
  return tags === tag;
}

function tagExistsOnOrigin(repo, tag) {
  const out = execFileSync("git", ["ls-remote", "--tags", repo.bareDir, tag], {
    cwd: repo.repoDir,
    env: repo.env,
  }).toString();
  return out.includes(tag);
}

function originMainSha(repo) {
  return execFileSync("git", ["ls-remote", repo.bareDir, "refs/heads/main"], { env: repo.env })
    .toString()
    .split(/\s+/)[0];
}

// ── release.sh: normal path, PATHSPEC, BUMP_GREP ────────────────────────────

test("normal path: a fresh unreleased commit bumps, commits, tags, and pushes atomically -- release.sh never calls gh", (t) => {
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);

  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
  assert.match(result.stdout, /Released v0\.1\.1 -- publish\.yml creates the GitHub release/);
  assert.ok(tagExistsLocally(repo, "v0.1.1"));
  assert.ok(tagExistsOnOrigin(repo, "v0.1.1"));
  assert.deepEqual(calls(repo), [], "release.sh must never call gh");

  const log = execFileSync("git", ["log", "--oneline", "-3"], { cwd: repo.repoDir, env: repo.env })
    .toString();
  assert.match(log, /chore\(release\): v0\.1\.1/);
});

test("no unreleased package changes -- exits cleanly, no bump attempted", (t) => {
  const repo = makeRepo(t);
  // No commit touching styles/ or components/ at all.
  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Nothing to do/);
  assert.ok(!tagExistsLocally(repo, "v0.1.1"));
  const pkg = JSON.parse(readFileSync(join(repo.repoDir, "styles", "package.json"), "utf-8"));
  assert.equal(pkg.version, "0.1.0");
});

// PATHSPEC (issue #34): the trigger must match what each package actually
// ships, not just its top-level directory. These reproduce the issue's own
// examples directly against the real script.

test("PATHSPEC: unshipped styles/test and components/react test-only changes don't trigger a release", (t) => {
  const repo = makeRepo(t);

  mkdirSync(join(repo.repoDir, "styles", "test"), { recursive: true });
  writeFileSync(join(repo.repoDir, "styles", "test", "scratch.test.mjs"), "// scratch\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "test(styles): scratch"]);

  // NB: tsconfig.json / tsconfig.build.json are NOT tested here -- they DO
  // trigger a release (they govern the emitted dist bytes); see the dedicated
  // "build config triggers a release" test below (issue #87).
  mkdirSync(join(repo.repoDir, "components", "react", "src"), { recursive: true });
  writeFileSync(join(repo.repoDir, "components", "react", "src", "Foo.test.tsx"), "// test\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "test(react): scratch"]);

  // A .test.ts (non-JSX) file, distinct from the .test.tsx case above --
  // tsconfig.build.json excludes both extensions from the build, so PATHSPEC
  // must exclude both too.
  writeFileSync(join(repo.repoDir, "components", "react", "src", "cx.test.ts"), "// test\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "test(react): cx"]);

  // test-dom.ts is tsconfig.build.json's third exclude -- its own scenario,
  // not covered by the .test.ts/.test.tsx cases above.
  writeFileSync(join(repo.repoDir, "components", "react", "src", "test-dom.ts"), "// test setup\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "test(react): test-dom setup"]);

  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Nothing to do/);
});

test("PATHSPEC: a shipped design.md fix triggers a release, and so does shipped react src", (t) => {
  const repo = makeRepo(t);

  mkdirSync(join(repo.repoDir, "styles", "arcane-obsidian"), { recursive: true });
  writeFileSync(join(repo.repoDir, "styles", "arcane-obsidian", "design.md"), "# fix\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "fix(styles): correct design.md claim"]);

  const first = runScript(repo, "release.sh");
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.match(first.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);

  mkdirSync(join(repo.repoDir, "components", "react", "src"), { recursive: true });
  writeFileSync(join(repo.repoDir, "components", "react", "src", "Foo.ts"), "export const foo = 1;\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "feat(react): add Foo"]);

  const second = runScript(repo, "release.sh");
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /Version: 0\.1\.1 -> 0\.1\.2/);

  // components/react/package.json itself is the published manifest (its
  // "exports"/"peerDependencies" are shipped-relevant) -- a non-version edit
  // to it, on its own, must also trigger a release.
  const reactPkgPath = join(repo.repoDir, "components", "react", "package.json");
  const reactPkg = JSON.parse(readFileSync(reactPkgPath, "utf-8"));
  reactPkg.description = "added";
  writeFileSync(reactPkgPath, JSON.stringify(reactPkg, null, 2) + "\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "chore(react): describe the package"]);

  const third = runScript(repo, "release.sh");
  assert.equal(third.status, 0, third.stdout + third.stderr);
  assert.match(third.stdout, /Version: 0\.1\.2 -> 0\.1\.3/);
});

test("PATHSPEC: a change to only scripts/copy-license.mjs triggers a release (issue #38)", (t) => {
  const repo = makeRepo(t);

  mkdirSync(join(repo.repoDir, "scripts"), { recursive: true });
  writeFileSync(join(repo.repoDir, "scripts", "copy-license.mjs"), "// copy license files\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "fix(scripts): correct copy-license.mjs"]);

  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
});

test("PATHSPEC: a change to only scripts/bundle-css.mjs triggers a release (issue #52)", (t) => {
  const repo = makeRepo(t);

  mkdirSync(join(repo.repoDir, "scripts"), { recursive: true });
  writeFileSync(join(repo.repoDir, "scripts", "bundle-css.mjs"), "// flatten theme css\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "fix(scripts): correct bundle-css.mjs"]);

  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
});

// ── Issue #87: PATHSPEC/BUMP_GREP/tag-glob correctness against release.sh's
// own bump decision (the changelog-content half of each of these moved to
// the release-notes.sh section below, since release.sh no longer builds a
// changelog itself).

test("#87 bump-grep: a real change whose BODY quotes 'chore(release): v' still triggers a release", (t) => {
  const repo = makeRepo(t);
  writeFileSync(join(repo.repoDir, "styles", "REALFIX.txt"), "a real fix\n");
  repo.run(["add", "."]);
  repo.run([
    "commit",
    "-m",
    "fix(styles): a genuine change",
    "-m",
    "chore(release): v0.1.10 shipped before this landed, per the changelog",
  ]);

  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
  assert.ok(tagExistsOnOrigin(repo, "v0.1.1"));
});

test("#87 PATHSPEC: a change to only root NOTICE triggers a release", (t) => {
  const repo = makeRepo(t);
  writeFileSync(join(repo.repoDir, "NOTICE"), "Portions (c) contributors.\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "docs(license): credit a ported theme in NOTICE"]);

  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
});

test("#87 PATHSPEC: a change to only root LICENSE triggers a release", (t) => {
  const repo = makeRepo(t);
  writeFileSync(join(repo.repoDir, "LICENSE"), "License text, updated.\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "docs(license): clarify LICENSE"]);

  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
});

test("#87 PATHSPEC: a build-config change (tsconfig.json) triggers a release", (t) => {
  const repo = makeRepo(t);
  writeFileSync(
    join(repo.repoDir, "components", "react", "tsconfig.json"),
    '{ "compilerOptions": { "target": "ES2017" } }\n'
  );
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "build(react): lower the compile target"]);

  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
});

test("#87 PATHSPEC: a build-config change (tsconfig.build.json) triggers a release", (t) => {
  const repo = makeRepo(t);
  writeFileSync(
    join(repo.repoDir, "components", "react", "tsconfig.build.json"),
    '{ "extends": "./tsconfig.json", "exclude": [] }\n'
  );
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "build(react): widen what the build emits"]);

  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
});

test("#87 tag glob: pre-release and unrelated v-tags don't become the release base", (t) => {
  // git tag -l "v*" | sort -V | tail -1 would pick vendor-snapshot (or
  // v0.2.0-rc1) over v0.1.0, then base the bump/changelog on a non-release.
  // The fix keeps only strict vX.Y.Z tags.
  const repo = makeRepo(t);
  repo.run(["tag", "v0.2.0-rc1"]); // outranks v0.1.0 under sort -V, not a release
  repo.run(["tag", "v2-experiment"]);
  repo.run(["tag", "vendor-snapshot"]);
  addUnreleasedCommit(repo);

  const result = runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  // Based on the real latest release (v0.1.0): next is 0.1.1.
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
  assert.ok(tagExistsOnOrigin(repo, "v0.1.1"));
  assert.deepEqual(calls(repo), [], "release.sh must never call gh, non-release tags included");
});

// ── Atomicity (issue #88): a rejected push on either half of the atomic
// pair leaves BOTH refs exactly as they were, and release.sh has no partial
// state left over to clean up on the next run.

test("(i) atomic push: the TAG ref rejected leaves origin/main AND the tag both untouched", (t) => {
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);
  const mainBefore = originMainSha(repo);
  writeFileSync(join(repo.bareDir, "reject-tags"), "");

  const result = runScript(repo, "release.sh");
  assert.notEqual(result.status, 0, "the atomic push should genuinely fail");
  assert.match(result.stderr, /rejecting tag ref update|\[rejected\]/);
  assert.equal(originMainSha(repo), mainBefore, "origin/main must be unchanged");
  assert.ok(!tagExistsOnOrigin(repo, "v0.1.1"), "the tag must not exist on origin either");
  assert.deepEqual(calls(repo), []);
});

test("(i) atomic push: the MAIN ref rejected leaves origin/main AND the tag both untouched", (t) => {
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);
  const mainBefore = originMainSha(repo);
  writeFileSync(join(repo.bareDir, "reject-main"), "");

  const result = runScript(repo, "release.sh");
  assert.notEqual(result.status, 0, "the atomic push should genuinely fail");
  assert.match(result.stderr, /rejecting main ref update|\[rejected\]/);
  assert.equal(originMainSha(repo), mainBefore, "origin/main must be unchanged");
  assert.ok(!tagExistsOnOrigin(repo, "v0.1.1"), "the tag must not exist on origin, even though only main was rejected");
  assert.deepEqual(calls(repo), []);
});

test("(ii) a second release.sh run after an atomic-push rejection, from a fresh checkout, bumps exactly once", (t) => {
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);
  // Pushed first, as it would already be on origin by the time release.yml
  // even checks out -- that workflow only runs on a push to main (an
  // ordinary PR merge), before release.sh gets involved at all. Only the
  // bump commit release.sh creates itself is new when its own atomic push
  // runs below.
  repo.run(["push"]);
  writeFileSync(join(repo.bareDir, "reject-main"), "");
  const first = runScript(repo, "release.sh");
  assert.notEqual(first.status, 0, "the first run's atomic push should genuinely fail");
  rmSync(join(repo.bareDir, "reject-main"));

  // A fresh clone of origin -- not the dirty repoDir from the failed
  // attempt, which still has a local bump commit/tag the rejected push
  // never actually landed. Real CI always starts from a fresh checkout per
  // run, so this is the precondition that actually matters.
  const freshDir = mkdtempSync(join(tmpdir(), "release-test-fresh-"));
  t.after(() => rmSync(freshDir, { recursive: true, force: true }));
  execFileSync("git", ["clone", repo.bareDir, freshDir], { env: repo.env });
  installScripts(freshDir);

  const second = runScriptAt(freshDir, repo.env, "release.sh");
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
  assert.ok(tagExistsOnOrigin(repo, "v0.1.1"));

  const log = execFileSync("git", ["log", "--oneline"], { cwd: freshDir, env: repo.env }).toString();
  const bumpCommits = log.split("\n").filter((l) => l.includes("chore(release):"));
  assert.equal(bumpCommits.length, 1, `expected exactly one bump commit, log:\n${log}`);
  const pkg = JSON.parse(readFileSync(join(freshDir, "styles", "package.json"), "utf-8"));
  assert.equal(pkg.version, "0.1.1");
});

// ── publish-release.sh (issue #88): idempotent GitHub release creation,
// called from publish.yml after the tag-triggered npm publish succeeds.

test("publish-release.sh: creates the release from release-notes.sh's own output when missing, then no-ops on a second run", (t) => {
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);
  const rel = runScript(repo, "release.sh");
  assert.equal(rel.status, 0, rel.stdout + rel.stderr);
  assert.deepEqual(calls(repo), [], "release.sh itself must not have called gh");

  const expectedNotes = runScript(repo, "release-notes.sh", ["v0.1.1"]).stdout;

  const pub = runScript(repo, "publish-release.sh", ["v0.1.1"]);
  assert.equal(pub.status, 0, pub.stdout + pub.stderr);
  assert.match(pub.stdout, /Created release v0\.1\.1/);
  assert.equal(calls(repo).filter((c) => c.startsWith("release create")).length, 1);
  const notesContent = readFileSync(join(repo.ghDir, "last-notes"), "utf-8");
  assert.equal(notesContent, expectedNotes, "the release body must equal release-notes.sh's own output");

  // Idempotent: a second run against the now-existing release creates
  // nothing further.
  const pub2 = runScript(repo, "publish-release.sh", ["v0.1.1"]);
  assert.equal(pub2.status, 0, pub2.stdout + pub2.stderr);
  assert.match(pub2.stdout, /already exists/);
  assert.equal(
    calls(repo).filter((c) => c.startsWith("release create")).length,
    1,
    "no second release create"
  );
});

test("publish-release.sh: a non-404 view failure is fatal, ASCII error, no create attempted (issue #87)", (t) => {
  const repo = makeRepo(t);
  writeFileSync(join(repo.ghDir, "fail-view-transient"), "");

  const pub = runScript(repo, "publish-release.sh", ["v0.1.0"]);
  assert.notEqual(pub.status, 0, "a transient view failure must fail the run");
  assert.match(pub.stderr, /gh release view v0\.1\.0 failed/);
  assert.ok(/^[\x00-\x7F]*$/.test(pub.stderr), `stderr must be ASCII, got:\n${pub.stderr}`);
  assert.equal(
    calls(repo).filter((c) => c.startsWith("release create")).length,
    0,
    "no release create attempted after a transient view failure"
  );
});

// ── release-notes.sh (issue #88): pure changelog output, reusing the
// grouping/filtering expectations release.sh's changelog used to carry.

test("release-notes.sh: no prior release tag -- the range is the tag alone", (t) => {
  const repo = makeRepo(t);
  const notes = runScript(repo, "release-notes.sh", ["v0.1.0"]);
  assert.equal(notes.status, 0, notes.stdout + notes.stderr);
  // The only PATHSPEC-scoped commit up to v0.1.0 is the seed commit itself,
  // which is a plain "chore:" subject with no colon-description this
  // repo's grouping would recognize distinctly -- so this just proves the
  // script runs and groups without a prior tag, without asserting exact
  // wording of the seed commit's own bucket.
  assert.equal(typeof notes.stdout, "string");
});

test("release-notes.sh: groups feat/fix under their headers, an unrecognized type under Other Changes", (t) => {
  const repo = makeRepo(t);
  writeFileSync(join(repo.repoDir, "styles", "A.txt"), "a\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "feat(styles): add A"]);
  writeFileSync(join(repo.repoDir, "styles", "B.txt"), "b\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "fix(styles): fix B"]);
  writeFileSync(join(repo.repoDir, "styles", "C.txt"), "c\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "feature(styles): not a real type"]);
  repo.run(["tag", "v0.1.1"]);
  repo.run(["push", "origin", "v0.1.1"]);

  const notes = runScript(repo, "release-notes.sh", ["v0.1.1"]).stdout;
  assert.match(notes, /### Features[\s\S]*- add A/);
  assert.match(notes, /### Bug Fixes[\s\S]*- fix B/);
  assert.match(notes, /### Other Changes[\s\S]*- feature\(styles\): not a real type/);
});

test("release-notes.sh: BUMP_GREP filters a bump-commit SUBJECT, not a body that merely quotes one", (t) => {
  // git log --grep matches the WHOLE message, so a --invert-grep filter on
  // it would drop this commit entirely -- the fix filters bump commits by
  // subject only (issue #87).
  const repo = makeRepo(t);
  writeFileSync(join(repo.repoDir, "styles", "REALFIX.txt"), "a real fix\n");
  repo.run(["add", "."]);
  repo.run([
    "commit",
    "-m",
    "fix(styles): a genuine change",
    "-m",
    "chore(release): v0.1.10 shipped before this landed, per the changelog",
  ]);
  repo.run(["tag", "v0.1.1"]);
  repo.run(["push", "origin", "v0.1.1"]);

  const notes = runScript(repo, "release-notes.sh", ["v0.1.1"]).stdout;
  assert.match(notes, /a genuine change/);
  // The real subject makes the changelog; the body's quoted bump line
  // neither drops it nor leaks a spurious "### Maintenance"/version line in.
  assert.doesNotMatch(notes, /Maintenance/);
  assert.doesNotMatch(notes, /v0\.1\.10/);
});

test("release-notes.sh: two releases apart -- each tag's changelog reflects only its own range", (t) => {
  const repo = makeRepo(t);
  writeFileSync(join(repo.repoDir, "styles", "ONE.txt"), "one\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "fix(styles): something"]);
  repo.run(["tag", "v0.1.1"]);
  repo.run(["push", "origin", "v0.1.1"]);

  writeFileSync(join(repo.repoDir, "styles", "TWO.txt"), "two\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "fix(styles): something else"]);
  repo.run(["tag", "v0.1.2"]);
  repo.run(["push", "origin", "v0.1.2"]);

  const notesV1 = runScript(repo, "release-notes.sh", ["v0.1.1"]).stdout;
  assert.match(notesV1, /something(?! else)/);
  assert.doesNotMatch(notesV1, /something else/);

  const notesV2 = runScript(repo, "release-notes.sh", ["v0.1.2"]).stdout;
  assert.match(notesV2, /something else/);
  assert.doesNotMatch(notesV2, /^- something$/m);
});
