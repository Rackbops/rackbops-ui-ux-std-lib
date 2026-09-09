// styles/test/helpers/release-repo.mjs
//
// Scratch-repo fixture for release.test.mjs (issue #93 PR-3). Building a
// fresh bare origin + working clone + fake gh + real scripts from scratch
// took ~8 git spawns per scenario x 21 scenarios, all synchronous. Instead,
// build that seed ONCE here at module load, then cpSync a fresh copy of it
// per scenario -- a git repo is relocatable at the object/ref level, so a
// plain file copy is a valid clone. The only things a copy can't carry
// forward correctly are the couple of ABSOLUTE paths baked into the
// fixture's own files (the pre-receive hook's bare-dir path, used to name
// the reject marker files it checks for; the fake gh's own state-directory
// path) and git's own remote URL (`.git/config`'s remote.origin.url still
// points at the SEED's bare dir) -- all three get rewritten after every
// copy, in rewriteFixturePaths() below.
//
// Every helper here that spawns a process is async (execFile, not
// execFileSync) so scenarios can run concurrently -- see release.test.mjs's
// own header for why, and why this is safe: each scenario gets its own,
// fully independent scratch directory tree, so there's no shared mutable
// state between them to race on.
import { execFile as execFileCb, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { cp as cpAsync, readFile as readFileAsync, writeFile as writeFileAsync } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFile = promisify(execFileCb);

const SCRIPTS_DIR = fileURLToPath(new URL("../../../.github/scripts", import.meta.url));
const SCRIPT_NAMES = ["release.sh", "release-lib.sh", "release-notes.sh", "publish-release.sh", "next-version.sh"];

const GIT_ENV = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

function pkgJson(version) {
  return JSON.stringify({ name: "x", version }, null, 2) + "\n";
}

/** Copies the real current scripts (never a stale snapshot) into
 * <dir>/.github/scripts/, executable, at the same relative paths release.yml
 * and publish.yml use. */
function installScripts(dir) {
  const target = join(dir, ".github", "scripts");
  mkdirSync(target, { recursive: true });
  for (const name of SCRIPT_NAMES) {
    writeFileSync(join(target, name), readFileSync(join(SCRIPTS_DIR, name)), { mode: 0o755 });
  }
}

function posix(p) {
  return p.replace(/\\/g, "/");
}

function fixtureEnv(dirs) {
  return { ...process.env, ...GIT_ENV, PATH: `${dirs.ghBinDir}${delimiter}${process.env.PATH}` };
}

/** Builds the ONE shared seed fixture: a bare origin + a working clone,
 * seeded at v0.1.0, plus a fake `gh` on its own PATH-prepend dir and an
 * empty gh-state dir. Built synchronously since this runs exactly once, at
 * module load, before any test starts -- only the PER-SCENARIO copy below
 * needs to be async for scenarios to overlap. */
function buildSeed() {
  const root = mkdtempSync(join(tmpdir(), "release-seed-"));
  const bareDir = join(root, "origin.git");
  const repoDir = join(root, "repo");
  const ghDir = join(root, "gh-state");
  const ghBinDir = join(root, "gh-bin");
  mkdirSync(repoDir);
  mkdirSync(join(ghDir, "releases"), { recursive: true });
  mkdirSync(ghBinDir);

  execFileSync("git", ["init", "--bare", "-b", "main", bareDir]);
  // pre-receive: reject a tag ref update while <bareDir>/reject-tags exists,
  // or a main ref update while <bareDir>/reject-main exists (independently
  // -- a scenario picks one) -- so a test can make exactly one
  // `git push --atomic` fail for real on either half of the atomic pair (a
  // genuine rejected push, not a mocked one) and prove the OTHER half never
  // lands either.
  writeFileSync(
    join(bareDir, "hooks", "pre-receive"),
    `#!/usr/bin/env bash
set -euo pipefail
while read -r old new ref; do
  if [[ "$ref" == refs/tags/* ]] && [[ -f "${posix(bareDir)}/reject-tags" ]]; then
    echo "test: rejecting tag ref update" >&2
    exit 1
  fi
  if [[ "$ref" == "refs/heads/main" ]] && [[ -f "${posix(bareDir)}/reject-main" ]]; then
    echo "test: rejecting main ref update" >&2
    exit 1
  fi
done
exit 0
`,
    { mode: 0o755 }
  );

  // Fake `gh`: only implements the two subcommands publish-release.sh uses
  // (release.sh itself never calls gh -- see release.test.mjs's header).
  writeFileSync(
    join(ghBinDir, "gh"),
    `#!/usr/bin/env bash
set -euo pipefail
state="${posix(ghDir)}"
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
  const dirs = { root, bareDir, repoDir, ghDir, ghBinDir };
  const env = fixtureEnv(dirs);
  const run = (args) => execFileSync("git", args, { cwd: repoDir, env }).toString();

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

  return dirs;
}

const SEED = buildSeed();
// Per-scenario copies clean up via t.after(); the shared SEED itself has no
// TestContext to hook, so it's removed here instead -- otherwise every test
// run leaks one more release-seed-* dir into the OS temp folder.
process.on("exit", () => rmSync(SEED.root, { recursive: true, force: true }));

/** Rewrites the absolute paths a plain file copy of SEED can't carry
 * forward correctly (see the file header): the pre-receive hook's and fake
 * gh's own baked-in paths (plain text substitution -- both are shell
 * scripts that embed SEED's directory names literally), and git's remote
 * URL (`.git/config` still points at SEED.bareDir after a copy). */
async function rewriteFixturePaths(dirs) {
  const hookPath = join(dirs.bareDir, "hooks", "pre-receive");
  const hookSrc = await readFileAsync(hookPath, "utf-8");
  await writeFileAsync(hookPath, hookSrc.split(posix(SEED.bareDir)).join(posix(dirs.bareDir)));

  const ghBinPath = join(dirs.ghBinDir, "gh");
  const ghSrc = await readFileAsync(ghBinPath, "utf-8");
  await writeFileAsync(ghBinPath, ghSrc.split(posix(SEED.ghDir)).join(posix(dirs.ghDir)));

  await execFile("git", ["remote", "set-url", "origin", dirs.bareDir], {
    cwd: dirs.repoDir,
    env: fixtureEnv(dirs),
  });
}

/** One scratch repo per scenario, `cpSync`'d from the shared SEED instead of
 * built from scratch (issue #93). `t` is the running test's TestContext,
 * used to remove the scratch directory once the test finishes instead of
 * leaking it into the OS temp folder across repeated local runs. */
export async function makeRepo(t) {
  const root = mkdtempSync(join(tmpdir(), "release-test-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dirs = {
    bareDir: join(root, "origin.git"),
    repoDir: join(root, "repo"),
    ghDir: join(root, "gh-state"),
    ghBinDir: join(root, "gh-bin"),
  };

  await Promise.all([
    cpAsync(SEED.bareDir, dirs.bareDir, { recursive: true }),
    cpAsync(SEED.repoDir, dirs.repoDir, { recursive: true }),
    cpAsync(SEED.ghDir, dirs.ghDir, { recursive: true }),
    cpAsync(SEED.ghBinDir, dirs.ghBinDir, { recursive: true }),
  ]);
  await rewriteFixturePaths(dirs);

  const env = fixtureEnv(dirs);
  const run = async (args) => {
    const { stdout } = await execFile("git", args, { cwd: dirs.repoDir, env });
    return stdout;
  };

  return { ...dirs, run, env };
}

export async function addUnreleasedCommit({ repoDir, run }) {
  writeFileSync(join(repoDir, "styles", "CHANGE.txt"), "a fix\n");
  await run(["add", "."]);
  await run(["commit", "-m", "fix(styles): something"]);
}

/** Runs one of the real scripts (by its path relative to .github/scripts/)
 * against a scratch repo dir + env, exactly as release.yml/publish.yml do:
 * a real file, invoked by its real relative path, cwd set to the repo. */
export async function runScriptAt(repoDir, env, scriptName, args = []) {
  try {
    const { stdout } = await execFile("bash", [join(".github", "scripts", scriptName), ...args], {
      cwd: repoDir,
      env,
    });
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.code, stdout: err.stdout ?? "", stderr: err.stderr ?? "" };
  }
}

export async function runScript(repo, scriptName, args = []) {
  return runScriptAt(repo.repoDir, repo.env, scriptName, args);
}

/** Low-level `git <args>` against an arbitrary directory/env -- the primitive
 * behind repo.run(), also used directly where a test needs a directory that
 * isn't a full fixture repo (e.g. cloneFresh()'s independent clone). */
export async function gitAt(dir, env, args) {
  const { stdout } = await execFile("git", args, { cwd: dir, env });
  return stdout;
}

/** A genuine `git clone` of a scenario's own (possibly already-mutated)
 * bare origin into a brand-new directory, with the real scripts installed --
 * simulating real CI's fresh checkout per run, as opposed to reusing a
 * scenario's own working directory (which can still hold local state a
 * rejected push never actually landed on origin). */
export async function cloneFresh(repo, t) {
  const freshDir = mkdtempSync(join(tmpdir(), "release-test-fresh-"));
  t.after(() => rmSync(freshDir, { recursive: true, force: true }));
  await execFile("git", ["clone", repo.bareDir, freshDir], { env: repo.env });
  installScripts(freshDir);
  return { repoDir: freshDir, env: repo.env };
}

/** Pure fs read of the fake gh's call log -- no subprocess, so this stays
 * synchronous (nothing here would benefit from overlapping). */
export function calls(repo) {
  const file = join(repo.ghDir, "calls.log");
  return existsSync(file) ? readFileSync(file, "utf-8").trim().split("\n").filter(Boolean) : [];
}

export async function tagExistsLocally(repo, tag) {
  const stdout = await gitAt(repo.repoDir, repo.env, ["tag", "-l", tag]);
  return stdout.trim() === tag;
}

export async function tagExistsOnOrigin(repo, tag) {
  const stdout = await gitAt(repo.repoDir, repo.env, ["ls-remote", "--tags", repo.bareDir, tag]);
  return stdout.includes(tag);
}

export async function originMainSha(repo) {
  const stdout = await gitAt(repo.repoDir, repo.env, ["ls-remote", repo.bareDir, "refs/heads/main"]);
  return stdout.split(/\s+/)[0];
}
