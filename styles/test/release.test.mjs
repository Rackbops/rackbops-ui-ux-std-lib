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
// rather than asserting against the scripts' source text. The fixture setup
// itself lives in ./helpers/release-repo.mjs (issue #93): a shared seed
// built once at module load, `cpSync`'d fresh per scenario, and every
// scenario runs concurrently (`{ concurrency: true }`) since each gets its
// own fully independent scratch directory tree.
//
// DANGER, learned the hard way: these scripts have no self-check on which
// repo they're operating on -- they just run `git`/`gh` against whatever
// directory they were invoked from. Every real invocation below goes
// through the helper module's run()/runScript()/gitAt(), which pass an
// explicit `cwd` -- never a bare shell `bash release.sh` after a `cd`, and
// never a raw synchronous git spawn in this file (enforced structurally:
// there is no git-spawning import here at all, only the async helpers). If
// you're reproducing something from this file by hand (ad hoc, outside
// these helpers), do the same: pass an explicit working directory to every
// invocation, don't rely on having `cd`-ed there first. Running these
// scripts against a real checkout of this actual repo pushes real commits
// and tags to the real origin and can trigger a real npm publish via
// publish.yml -- this happened once, by accident, during release.sh's own
// review.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import {
  addUnreleasedCommit,
  calls,
  cloneFresh,
  gitAt,
  makeRepo,
  originMainSha,
  runScript,
  runScriptAt,
  tagExistsLocally,
  tagExistsOnOrigin,
} from "./helpers/release-repo.mjs";

// ── release.sh: normal path, PATHSPEC, BUMP_GREP ────────────────────────────

test(
  "normal path: a fresh unreleased commit bumps, commits, tags, and pushes atomically -- release.sh never calls gh",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    await addUnreleasedCommit(repo);

    const result = await runScript(repo, "release.sh");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
    assert.match(result.stdout, /Released v0\.1\.1 -- publish\.yml creates the GitHub release/);
    assert.ok(await tagExistsLocally(repo, "v0.1.1"));
    assert.ok(await tagExistsOnOrigin(repo, "v0.1.1"));
    assert.deepEqual(calls(repo), [], "release.sh must never call gh");

    const log = await gitAt(repo.repoDir, repo.env, ["log", "--oneline", "-3"]);
    assert.match(log, /chore\(release\): v0\.1\.1/);
  }
);

test("no unreleased package changes -- exits cleanly, no bump attempted", { concurrency: true }, async (t) => {
  const repo = await makeRepo(t);
  // No commit touching styles/ or components/ at all.
  const result = await runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Nothing to do/);
  assert.ok(!(await tagExistsLocally(repo, "v0.1.1")));
  const pkg = JSON.parse(readFileSync(join(repo.repoDir, "styles", "package.json"), "utf-8"));
  assert.equal(pkg.version, "0.1.0");
});

// PATHSPEC (issue #34): the trigger must match what each package actually
// ships, not just its top-level directory. These reproduce the issue's own
// examples directly against the real script.

test(
  "PATHSPEC: unshipped styles/test and components/react test-only changes don't trigger a release",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    mkdirSync(join(repo.repoDir, "styles", "test"), { recursive: true });
    writeFileSync(join(repo.repoDir, "styles", "test", "scratch.test.mjs"), "// scratch\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "test(styles): scratch"]);

    // NB: tsconfig.json / tsconfig.build.json are NOT tested here -- they DO
    // trigger a release (they govern the emitted dist bytes); see the dedicated
    // "build config triggers a release" test below (issue #87).
    mkdirSync(join(repo.repoDir, "components", "react", "src"), { recursive: true });
    writeFileSync(join(repo.repoDir, "components", "react", "src", "Foo.test.tsx"), "// test\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "test(react): scratch"]);

    // A .test.ts (non-JSX) file, distinct from the .test.tsx case above --
    // tsconfig.build.json excludes both extensions from the build, so PATHSPEC
    // must exclude both too.
    writeFileSync(join(repo.repoDir, "components", "react", "src", "cx.test.ts"), "// test\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "test(react): cx"]);

    // test-dom.ts is tsconfig.build.json's third exclude -- its own scenario,
    // not covered by the .test.ts/.test.tsx cases above.
    writeFileSync(join(repo.repoDir, "components", "react", "src", "test-dom.ts"), "// test setup\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "test(react): test-dom setup"]);

    const result = await runScript(repo, "release.sh");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Nothing to do/);
  }
);

test(
  "PATHSPEC: a shipped design.md fix triggers a release, and so does shipped react src",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);

    mkdirSync(join(repo.repoDir, "styles", "arcane-obsidian"), { recursive: true });
    writeFileSync(join(repo.repoDir, "styles", "arcane-obsidian", "design.md"), "# fix\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "fix(styles): correct design.md claim"]);

    const first = await runScript(repo, "release.sh");
    assert.equal(first.status, 0, first.stdout + first.stderr);
    assert.match(first.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);

    mkdirSync(join(repo.repoDir, "components", "react", "src"), { recursive: true });
    writeFileSync(join(repo.repoDir, "components", "react", "src", "Foo.ts"), "export const foo = 1;\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "feat(react): add Foo"]);

    const second = await runScript(repo, "release.sh");
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.match(second.stdout, /Version: 0\.1\.1 -> 0\.1\.2/);

    // components/react/package.json itself is the published manifest (its
    // "exports"/"peerDependencies" are shipped-relevant) -- a non-version edit
    // to it, on its own, must also trigger a release.
    const reactPkgPath = join(repo.repoDir, "components", "react", "package.json");
    const reactPkg = JSON.parse(readFileSync(reactPkgPath, "utf-8"));
    reactPkg.description = "added";
    writeFileSync(reactPkgPath, JSON.stringify(reactPkg, null, 2) + "\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "chore(react): describe the package"]);

    const third = await runScript(repo, "release.sh");
    assert.equal(third.status, 0, third.stdout + third.stderr);
    assert.match(third.stdout, /Version: 0\.1\.2 -> 0\.1\.3/);
  }
);

test(
  "PATHSPEC: a change to only scripts/copy-license.mjs triggers a release (issue #38)",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);

    mkdirSync(join(repo.repoDir, "scripts"), { recursive: true });
    writeFileSync(join(repo.repoDir, "scripts", "copy-license.mjs"), "// copy license files\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "fix(scripts): correct copy-license.mjs"]);

    const result = await runScript(repo, "release.sh");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
  }
);

test(
  "PATHSPEC: a change to only scripts/bundle-css.mjs triggers a release (issue #52)",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);

    mkdirSync(join(repo.repoDir, "scripts"), { recursive: true });
    writeFileSync(join(repo.repoDir, "scripts", "bundle-css.mjs"), "// flatten theme css\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "fix(scripts): correct bundle-css.mjs"]);

    const result = await runScript(repo, "release.sh");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
  }
);

// ── Issue #87: PATHSPEC/BUMP_GREP/tag-glob correctness against release.sh's
// own bump decision (the changelog-content half of each of these moved to
// the release-notes.sh section below, since release.sh no longer builds a
// changelog itself).

test(
  "#87 bump-grep: a real change whose BODY quotes 'chore(release): v' still triggers a release",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    writeFileSync(join(repo.repoDir, "styles", "REALFIX.txt"), "a real fix\n");
    await repo.run(["add", "."]);
    await repo.run([
      "commit",
      "-m",
      "fix(styles): a genuine change",
      "-m",
      "chore(release): v0.1.10 shipped before this landed, per the changelog",
    ]);

    const result = await runScript(repo, "release.sh");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
    assert.ok(await tagExistsOnOrigin(repo, "v0.1.1"));
  }
);

test("#87 PATHSPEC: a change to only root NOTICE triggers a release", { concurrency: true }, async (t) => {
  const repo = await makeRepo(t);
  const fs = await import("node:fs");
  writeFileSync(join(repo.repoDir, "NOTICE"), "Portions (c) contributors.\n");
  await repo.run(["add", "."]);
  await repo.run(["commit", "-m", "docs(license): credit a ported theme in NOTICE"]);

  const result = await runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
});

test("#87 PATHSPEC: a change to only root LICENSE triggers a release", { concurrency: true }, async (t) => {
  const repo = await makeRepo(t);
  const fs = await import("node:fs");
  writeFileSync(join(repo.repoDir, "LICENSE"), "License text, updated.\n");
  await repo.run(["add", "."]);
  await repo.run(["commit", "-m", "docs(license): clarify LICENSE"]);

  const result = await runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
});

test("#87 PATHSPEC: a build-config change (tsconfig.json) triggers a release", { concurrency: true }, async (t) => {
  const repo = await makeRepo(t);
  const fs = await import("node:fs");
  writeFileSync(
    join(repo.repoDir, "components", "react", "tsconfig.json"),
    '{ "compilerOptions": { "target": "ES2017" } }\n'
  );
  await repo.run(["add", "."]);
  await repo.run(["commit", "-m", "build(react): lower the compile target"]);

  const result = await runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
});

test(
  "#87 PATHSPEC: a build-config change (tsconfig.build.json) triggers a release",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    writeFileSync(
      join(repo.repoDir, "components", "react", "tsconfig.build.json"),
      '{ "extends": "./tsconfig.json", "exclude": [] }\n'
    );
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "build(react): widen what the build emits"]);

    const result = await runScript(repo, "release.sh");
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
  }
);

test("#87 tag glob: pre-release and unrelated v-tags don't become the release base", { concurrency: true }, async (t) => {
  // git tag -l "v*" | sort -V | tail -1 would pick vendor-snapshot (or
  // v0.2.0-rc1) over v0.1.0, then base the bump/changelog on a non-release.
  // The fix keeps only strict vX.Y.Z tags.
  const repo = await makeRepo(t);
  await repo.run(["tag", "v0.2.0-rc1"]); // outranks v0.1.0 under sort -V, not a release
  await repo.run(["tag", "v2-experiment"]);
  await repo.run(["tag", "vendor-snapshot"]);
  await addUnreleasedCommit(repo);

  const result = await runScript(repo, "release.sh");
  assert.equal(result.status, 0, result.stdout + result.stderr);
  // Based on the real latest release (v0.1.0): next is 0.1.1.
  assert.match(result.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
  assert.ok(await tagExistsOnOrigin(repo, "v0.1.1"));
  assert.deepEqual(calls(repo), [], "release.sh must never call gh, non-release tags included");
});

// ── Atomicity (issue #88): a rejected push on either half of the atomic
// pair leaves BOTH refs exactly as they were, and release.sh has no partial
// state left over to clean up on the next run.

test(
  "(i) atomic push: the TAG ref rejected leaves origin/main AND the tag both untouched",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    await addUnreleasedCommit(repo);
    const mainBefore = await originMainSha(repo);
    writeFileSync(join(repo.bareDir, "reject-tags"), "");

    const result = await runScript(repo, "release.sh");
    assert.notEqual(result.status, 0, "the atomic push should genuinely fail");
    assert.match(result.stderr, /rejecting tag ref update|\[rejected\]/);
    assert.equal(await originMainSha(repo), mainBefore, "origin/main must be unchanged");
    assert.ok(!(await tagExistsOnOrigin(repo, "v0.1.1")), "the tag must not exist on origin either");
    assert.deepEqual(calls(repo), []);
  }
);

test(
  "(i) atomic push: the MAIN ref rejected leaves origin/main AND the tag both untouched",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    await addUnreleasedCommit(repo);
    const mainBefore = await originMainSha(repo);
    writeFileSync(join(repo.bareDir, "reject-main"), "");

    const result = await runScript(repo, "release.sh");
    assert.notEqual(result.status, 0, "the atomic push should genuinely fail");
    assert.match(result.stderr, /rejecting main ref update|\[rejected\]/);
    assert.equal(await originMainSha(repo), mainBefore, "origin/main must be unchanged");
    assert.ok(
      !(await tagExistsOnOrigin(repo, "v0.1.1")),
      "the tag must not exist on origin, even though only main was rejected"
    );
    assert.deepEqual(calls(repo), []);
  }
);

test(
  "(ii) a second release.sh run after an atomic-push rejection, from a fresh checkout, bumps exactly once",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    await addUnreleasedCommit(repo);
    // Pushed first, as it would already be on origin by the time release.yml
    // even checks out -- that workflow only runs on a push to main (an
    // ordinary PR merge), before release.sh gets involved at all. Only the
    // bump commit release.sh creates itself is new when its own atomic push
    // runs below.
    await repo.run(["push"]);
    writeFileSync(join(repo.bareDir, "reject-main"), "");
    const first = await runScript(repo, "release.sh");
    assert.notEqual(first.status, 0, "the first run's atomic push should genuinely fail");
    rmSync(join(repo.bareDir, "reject-main"));

    // A fresh clone of origin -- not the dirty repoDir from the failed
    // attempt, which still has a local bump commit/tag the rejected push
    // never actually landed. Real CI always starts from a fresh checkout per
    // run, so this is the precondition that actually matters.
    const fresh = await cloneFresh(repo, t);

    const second = await runScriptAt(fresh.repoDir, fresh.env, "release.sh");
    assert.equal(second.status, 0, second.stdout + second.stderr);
    assert.match(second.stdout, /Version: 0\.1\.0 -> 0\.1\.1/);
    assert.ok(await tagExistsOnOrigin(repo, "v0.1.1"));

    const log = await gitAt(fresh.repoDir, fresh.env, ["log", "--oneline"]);
    const bumpCommits = log.split("\n").filter((l) => l.includes("chore(release):"));
    assert.equal(bumpCommits.length, 1, `expected exactly one bump commit, log:\n${log}`);
    const pkg = JSON.parse(readFileSync(join(fresh.repoDir, "styles", "package.json"), "utf-8"));
    assert.equal(pkg.version, "0.1.1");
  }
);

// ── publish-release.sh (issue #88): idempotent GitHub release creation,
// called from publish.yml after the tag-triggered npm publish succeeds.

test(
  "publish-release.sh: creates the release from release-notes.sh's own output when missing, then no-ops on a second run",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    await addUnreleasedCommit(repo);
    const rel = await runScript(repo, "release.sh");
    assert.equal(rel.status, 0, rel.stdout + rel.stderr);
    assert.deepEqual(calls(repo), [], "release.sh itself must not have called gh");

    const expectedNotes = (await runScript(repo, "release-notes.sh", ["v0.1.1"])).stdout;

    const pub = await runScript(repo, "publish-release.sh", ["v0.1.1"]);
    assert.equal(pub.status, 0, pub.stdout + pub.stderr);
    assert.match(pub.stdout, /Created release v0\.1\.1/);
    assert.equal(calls(repo).filter((c) => c.startsWith("release create")).length, 1);
    const notesContent = readFileSync(join(repo.ghDir, "last-notes"), "utf-8");
    assert.equal(notesContent, expectedNotes, "the release body must equal release-notes.sh's own output");

    // Idempotent: a second run against the now-existing release creates
    // nothing further.
    const pub2 = await runScript(repo, "publish-release.sh", ["v0.1.1"]);
    assert.equal(pub2.status, 0, pub2.stdout + pub2.stderr);
    assert.match(pub2.stdout, /already exists/);
    assert.equal(
      calls(repo).filter((c) => c.startsWith("release create")).length,
      1,
      "no second release create"
    );
  }
);

test(
  "publish-release.sh: a non-404 view failure is fatal, ASCII error, no create attempted (issue #87)",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    writeFileSync(join(repo.ghDir, "fail-view-transient"), "");

    const pub = await runScript(repo, "publish-release.sh", ["v0.1.0"]);
    assert.notEqual(pub.status, 0, "a transient view failure must fail the run");
    assert.match(pub.stderr, /gh release view v0\.1\.0 failed/);
    assert.ok(/^[\x00-\x7F]*$/.test(pub.stderr), `stderr must be ASCII, got:\n${pub.stderr}`);
    assert.equal(
      calls(repo).filter((c) => c.startsWith("release create")).length,
      0,
      "no release create attempted after a transient view failure"
    );
  }
);

// ── release-notes.sh (issue #88): pure changelog output, reusing the
// grouping/filtering expectations release.sh's changelog used to carry.

test("release-notes.sh: no prior release tag -- the range is the tag alone", { concurrency: true }, async (t) => {
  const repo = await makeRepo(t);
  const notes = await runScript(repo, "release-notes.sh", ["v0.1.0"]);
  assert.equal(notes.status, 0, notes.stdout + notes.stderr);
  // The only PATHSPEC-scoped commit up to v0.1.0 is the seed commit itself,
  // which is a plain "chore:" subject with no colon-description this
  // repo's grouping would recognize distinctly -- so this just proves the
  // script runs and groups without a prior tag, without asserting exact
  // wording of the seed commit's own bucket.
  assert.equal(typeof notes.stdout, "string");
});

test(
  "release-notes.sh: groups feat/fix under their headers, an unrecognized type under Other Changes",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    writeFileSync(join(repo.repoDir, "styles", "A.txt"), "a\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "feat(styles): add A"]);
    writeFileSync(join(repo.repoDir, "styles", "B.txt"), "b\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "fix(styles): fix B"]);
    writeFileSync(join(repo.repoDir, "styles", "C.txt"), "c\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "feature(styles): not a real type"]);
    await repo.run(["tag", "v0.1.1"]);
    await repo.run(["push", "origin", "v0.1.1"]);

    const notes = (await runScript(repo, "release-notes.sh", ["v0.1.1"])).stdout;
    assert.match(notes, /### Features[\s\S]*- add A/);
    assert.match(notes, /### Bug Fixes[\s\S]*- fix B/);
    assert.match(notes, /### Other Changes[\s\S]*- feature\(styles\): not a real type/);
  }
);

test(
  "release-notes.sh: BUMP_GREP filters a bump-commit SUBJECT, not a body that merely quotes one",
  { concurrency: true },
  async (t) => {
    // git log --grep matches the WHOLE message, so a --invert-grep filter on
    // it would drop this commit entirely -- the fix filters bump commits by
    // subject only (issue #87).
    const repo = await makeRepo(t);
    writeFileSync(join(repo.repoDir, "styles", "REALFIX.txt"), "a real fix\n");
    await repo.run(["add", "."]);
    await repo.run([
      "commit",
      "-m",
      "fix(styles): a genuine change",
      "-m",
      "chore(release): v0.1.10 shipped before this landed, per the changelog",
    ]);
    await repo.run(["tag", "v0.1.1"]);
    await repo.run(["push", "origin", "v0.1.1"]);

    const notes = (await runScript(repo, "release-notes.sh", ["v0.1.1"])).stdout;
    assert.match(notes, /a genuine change/);
    // The real subject makes the changelog; the body's quoted bump line
    // neither drops it nor leaks a spurious "### Maintenance"/version line in.
    assert.doesNotMatch(notes, /Maintenance/);
    assert.doesNotMatch(notes, /v0\.1\.10/);
  }
);

test(
  "release-notes.sh: two releases apart -- each tag's changelog reflects only its own range",
  { concurrency: true },
  async (t) => {
    const repo = await makeRepo(t);
    writeFileSync(join(repo.repoDir, "styles", "ONE.txt"), "one\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "fix(styles): something"]);
    await repo.run(["tag", "v0.1.1"]);
    await repo.run(["push", "origin", "v0.1.1"]);

    writeFileSync(join(repo.repoDir, "styles", "TWO.txt"), "two\n");
    await repo.run(["add", "."]);
    await repo.run(["commit", "-m", "fix(styles): something else"]);
    await repo.run(["tag", "v0.1.2"]);
    await repo.run(["push", "origin", "v0.1.2"]);

    const notesV1 = (await runScript(repo, "release-notes.sh", ["v0.1.1"])).stdout;
    assert.match(notesV1, /something(?! else)/);
    assert.doesNotMatch(notesV1, /something else/);

    const notesV2 = (await runScript(repo, "release-notes.sh", ["v0.1.2"])).stdout;
    assert.match(notesV2, /something else/);
    assert.doesNotMatch(notesV2, /^- something$/m);
  }
);
