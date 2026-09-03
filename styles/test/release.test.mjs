// Rerun-safety for the release script (.github/scripts/release.sh, issue
// #32). Tested here for the same reason next-version.sh is (bump.test.mjs):
// so `pnpm test` in styles/ is the repo's single test entrypoint.
//
// A pure code read isn't enough confidence for a script that does real
// `git commit`/`push`/`tag` and `gh release create` -- so this spins up a
// genuine scratch git repo plus a genuine local bare repo as `origin` (push
// is real, not mocked), and a tiny fake `gh` executable on PATH that records
// what it was called with and can be told to fail once, to reproduce both
// failure shapes from the issue for real rather than asserting against the
// script's source text.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const RELEASE_SCRIPT = resolve(
  fileURLToPath(import.meta.url),
  "../../../.github/scripts/release.sh"
);
const NEXT_VERSION_SCRIPT = resolve(
  fileURLToPath(import.meta.url),
  "../../../.github/scripts/next-version.sh"
);

const GIT_ENV = {
  GIT_AUTHOR_NAME: "test",
  GIT_AUTHOR_EMAIL: "test@example.com",
  GIT_COMMITTER_NAME: "test",
  GIT_COMMITTER_EMAIL: "test@example.com",
};

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
  // pre-receive: reject any tag ref update while <bareDir>/reject-tags
  // exists, so a scratch test can make exactly one `git push origin <tag>`
  // fail for real (a genuine rejected push, not a mocked one) without
  // touching the separate branch push, which is a different invocation.
  writeFileSync(
    join(bareDir, "hooks", "pre-receive"),
    `#!/usr/bin/env bash\nset -euo pipefail\nwhile read -r old new ref; do\n  if [[ "$ref" == refs/tags/* ]] && [[ -f "${bareDir.replace(/\\/g, "/")}/reject-tags" ]]; then\n    echo "test: rejecting tag ref update" >&2\n    exit 1\n  fi\ndone\nexit 0\n`,
    { mode: 0o755 }
  );

  // Fake `gh`: only implements the two subcommands release.sh uses.
  // Bakes ghDir's absolute path into the script rather than relying on env
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
    [[ -f "$state/releases/\$tag" ]]
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
  mkdirSync(join(repoDir, ".github", "scripts"), { recursive: true });
  writeFileSync(join(repoDir, "styles", "package.json"), pkgJson("0.1.0"));
  writeFileSync(join(repoDir, "components", "react", "package.json"), pkgJson("0.1.0"));
  // release.sh shells out to this by a path relative to its own cwd, not
  // relative to release.sh's own location -- so the scratch repo needs a
  // real copy at the same relative path. Copying (not symlinking) the
  // actual current script means a change to next-version.sh is exercised
  // here too, not a stale snapshot.
  writeFileSync(
    join(repoDir, ".github", "scripts", "next-version.sh"),
    readFileSync(NEXT_VERSION_SCRIPT),
    { mode: 0o755 }
  );

  run(["add", "."]);
  run(["commit", "-m", "chore: seed v0.1.0"]);
  run(["push", "-u", "origin", "main"]);
  run(["tag", "v0.1.0"]);
  run(["push", "origin", "v0.1.0"]);
  // The seed commit predates any bump commit, so the fake `gh` never sees
  // v0.1.0 queried, but mark it released anyway for realism/symmetry.
  writeFileSync(join(ghDir, "releases", "v0.1.0"), "");

  return { repoDir, bareDir, ghDir, run, env };
}

function pkgJson(version) {
  return JSON.stringify({ name: "x", version }, null, 2) + "\n";
}

function addUnreleasedCommit({ repoDir, run }) {
  writeFileSync(join(repoDir, "styles", "CHANGE.txt"), "a fix\n");
  run(["add", "."]);
  run(["commit", "-m", "fix(styles): something"]);
}

/** Directly constructs the state a partial bump-then-push-fail run would
 * leave behind: version bumped, committed, and pushed -- no tag. */
function bumpCommitAndPush(repo, newVersion) {
  const { repoDir, run } = repo;
  for (const f of ["styles/package.json", "components/react/package.json"]) {
    writeFileSync(join(repoDir, f), pkgJson(newVersion));
  }
  run(["add", "styles/package.json", "components/react/package.json"]);
  run(["commit", "-m", `chore(release): v${newVersion}`]);
  run(["push"]);
}

function runRelease(repo) {
  try {
    const stdout = execFileSync("bash", [RELEASE_SCRIPT], {
      cwd: repo.repoDir,
      env: repo.env,
    }).toString();
    return { status: 0, stdout };
  } catch (err) {
    return { status: err.status, stdout: err.stdout?.toString() ?? "", stderr: err.stderr?.toString() ?? "" };
  }
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

// ── Scenarios ──────────────────────────────────────────────────────────────

test("normal path: a fresh unreleased commit bumps, tags, and releases exactly once", (t) => {
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);

  const result = runRelease(repo);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
  assert.ok(tagExistsLocally(repo, "v0.1.1"));
  assert.ok(tagExistsOnOrigin(repo, "v0.1.1"));
  assert.deepEqual(
    calls(repo).filter((c) => c.startsWith("release create")).length,
    1,
    "gh release create called exactly once"
  );

  const log = execFileSync("git", ["log", "--oneline", "-3"], { cwd: repo.repoDir, env: repo.env })
    .toString();
  assert.match(log, /chore\(release\): v0\.1\.1/);
});

test("scenario (a): bump committed and pushed, tag push failed -- resumes without re-bumping", (t) => {
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);
  bumpCommitAndPush(repo, "0.1.1");
  assert.ok(!tagExistsLocally(repo, "v0.1.1"), "precondition: no tag yet");

  const result = runRelease(repo);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Resuming v0\.1\.1: bump committed, not yet tagged/);

  assert.ok(tagExistsLocally(repo, "v0.1.1"));
  assert.ok(tagExistsOnOrigin(repo, "v0.1.1"));
  assert.equal(
    calls(repo).filter((c) => c.startsWith("release create")).length,
    1,
    "gh release create called exactly once"
  );

  // No double bump: exactly one chore(release) commit exists, and package.json
  // still reads 0.1.1, not 0.1.2.
  const log = execFileSync("git", ["log", "--oneline"], { cwd: repo.repoDir, env: repo.env }).toString();
  const bumpCommits = log.split("\n").filter((l) => l.includes("chore(release):"));
  assert.equal(bumpCommits.length, 1, `expected exactly one bump commit, log:\n${log}`);
  const pkg = JSON.parse(readFileSync(join(repo.repoDir, "styles", "package.json"), "utf-8"));
  assert.equal(pkg.version, "0.1.1");

  // The regenerated changelog still reflects the real unreleased commit,
  // not just the bump commit it was filtered out from. The changelog
  // formatter strips each commit's "type(scope): " prefix when rendering,
  // so the bump commit's own subject would never literally read
  // "chore(release)" in the output even if it weren't excluded -- what it
  // WOULD leave behind is a spurious "### Maintenance" section for its
  // stripped-down description ("v0.1.1"), since "chore" is one of the
  // recognized commit types. Assert against that instead.
  const notes = readFileSync(join(repo.ghDir, "last-notes"), "utf-8");
  assert.match(notes, /something/);
  assert.doesNotMatch(notes, /Maintenance/);
  assert.doesNotMatch(notes, /v0\.1\.1/);
});

test("scenario (a), via a genuine rejected push: tag push fails for real, then a second run resumes", (t) => {
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);
  writeFileSync(join(repo.bareDir, "reject-tags"), "");

  const first = runRelease(repo);
  assert.notEqual(first.status, 0, "the tag push should genuinely fail");
  assert.ok(!tagExistsOnOrigin(repo, "v0.1.1"), "rejected push never landed on origin");
  // The bump commit + branch push happened before the rejected tag push.
  const pkgAfterFirst = JSON.parse(readFileSync(join(repo.repoDir, "styles", "package.json"), "utf-8"));
  assert.equal(pkgAfterFirst.version, "0.1.1");

  rmSync(join(repo.bareDir, "reject-tags"));
  // The rejected push still left a real LOCAL tag behind (git tag itself
  // succeeded before the push failed) -- this repo reuses one working
  // directory across both runs, unlike real CI's fresh checkout per run,
  // which would never have fetched a tag that was never pushed. Left as-is,
  // the second run's own backfill check (not the resume path this test is
  // named for) would see that local tag and paper over the gap on its own,
  // making this test pass without actually exercising resume at all.
  // Deleting it restores the fresh-checkout precondition the resume check
  // is meant to run under.
  repo.run(["tag", "-d", "v0.1.1"]);
  const second = runRelease(repo);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /Resuming v0\.1\.1: bump committed, not yet tagged\./);
  assert.ok(tagExistsOnOrigin(repo, "v0.1.1"));
  assert.equal(calls(repo).filter((c) => c.startsWith("release create")).length, 1);

  const log = execFileSync("git", ["log", "--oneline"], { cwd: repo.repoDir, env: repo.env }).toString();
  const bumpCommits = log.split("\n").filter((l) => l.includes("chore(release):"));
  assert.equal(bumpCommits.length, 1, `expected no double bump, log:\n${log}`);
});

test("scenario (b): tag pushed, release create failed once -- resumes without re-tagging or re-bumping", (t) => {
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);
  writeFileSync(join(repo.ghDir, "fail-create-once"), "");

  const first = runRelease(repo);
  assert.notEqual(first.status, 0, "gh release create should genuinely fail the first time");
  assert.ok(tagExistsOnOrigin(repo, "v0.1.1"), "the tag push itself succeeded before the failure");
  assert.ok(!existsSync(join(repo.ghDir, "releases", "v0.1.1")), "no release recorded yet");

  const second = runRelease(repo);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /Tag v0\.1\.1 has no GitHub release yet — backfilling it first\./);
  assert.ok(existsSync(join(repo.ghDir, "releases", "v0.1.1")));

  // Exactly one tag, one bump commit, two release-create attempts (the
  // failed one plus the resumed one) but only one recorded release.
  const tags = execFileSync("git", ["tag", "-l", "v0.1.1"], { cwd: repo.repoDir, env: repo.env })
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean);
  assert.equal(tags.length, 1);
  assert.equal(calls(repo).filter((c) => c.startsWith("release create")).length, 2);
});

test("scenario (b), with a new commit landing before the retry, not an immediate rerun -- still backfills the stranded release", (t) => {
  // The gap a plain "is HEAD our own bump commit" check can't see: once a
  // genuinely new commit lands, HEAD moves past the stuck release entirely,
  // so that check alone would treat the already-tagged version as the new
  // base and move on -- stranding v0.1.1's release for good even though
  // v0.1.1 (and now v0.1.2) both already reached npm via their tag pushes.
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);
  writeFileSync(join(repo.ghDir, "fail-create-once"), "");

  const first = runRelease(repo);
  assert.notEqual(first.status, 0, "gh release create should genuinely fail the first time");
  assert.ok(tagExistsOnOrigin(repo, "v0.1.1"), "the tag push itself succeeded before the failure");

  // A new, unrelated commit lands -- not a retry of the same HEAD.
  writeFileSync(join(repo.repoDir, "styles", "CHANGE2.txt"), "another fix\n");
  repo.run(["add", "."]);
  repo.run(["commit", "-m", "fix(styles): something else"]);

  const second = runRelease(repo);
  assert.equal(second.status, 0, second.stdout + second.stderr);
  assert.match(second.stdout, /Tag v0\.1\.1 has no GitHub release yet — backfilling it first\./);
  assert.ok(existsSync(join(repo.ghDir, "releases", "v0.1.1")), "v0.1.1's release was backfilled");

  // The new commit is also genuinely unreleased work, so this same run
  // additionally cuts v0.1.2 for it -- both happen in one invocation.
  assert.match(second.stdout, /Version: 0\.1\.1 -> 0\.1\.2/);
  assert.ok(tagExistsOnOrigin(repo, "v0.1.2"));
  assert.ok(existsSync(join(repo.ghDir, "releases", "v0.1.2")), "v0.1.2 was also released");

  // Each tag's changelog reflects only its own commit, not the other's --
  // the backfill range and the new-release range must not bleed together.
  const notesV1 = readFileSync(join(repo.ghDir, "notes-v0.1.1"), "utf-8");
  assert.match(notesV1, /something(?! else)/);
  assert.doesNotMatch(notesV1, /something else/);
  const notesV2 = readFileSync(join(repo.ghDir, "notes-v0.1.2"), "utf-8");
  assert.match(notesV2, /something else/);

  const pkg = JSON.parse(readFileSync(join(repo.repoDir, "styles", "package.json"), "utf-8"));
  assert.equal(pkg.version, "0.1.2", "no double bump past the genuinely new version");
});

test("idle: already fully released -- exits cleanly without creating a second release", (t) => {
  const repo = makeRepo(t);
  addUnreleasedCommit(repo);
  const first = runRelease(repo);
  assert.equal(first.status, 0, first.stdout + first.stderr);
  const callsAfterFirst = calls(repo).filter((c) => c.startsWith("release create")).length;

  const second = runRelease(repo);
  assert.equal(second.status, 0, second.stdout);
  assert.match(second.stdout, /No unreleased package changes since v0\.1\.1\. Nothing to do\./);
  assert.doesNotMatch(second.stdout, /backfilling/, "the existing release must not be recreated");
  assert.equal(
    calls(repo).filter((c) => c.startsWith("release create")).length,
    callsAfterFirst,
    "release create was not called again"
  );
});

test("no unreleased package changes -- exits cleanly, no bump attempted", (t) => {
  const repo = makeRepo(t);
  // No commit touching styles/ or components/ at all.
  const result = runRelease(repo);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Nothing to do/);
  assert.ok(!tagExistsLocally(repo, "v0.1.1"));
  const pkg = JSON.parse(readFileSync(join(repo.repoDir, "styles", "package.json"), "utf-8"));
  assert.equal(pkg.version, "0.1.0");
});
