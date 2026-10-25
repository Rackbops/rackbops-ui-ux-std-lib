// Published-surface guard (#224). While the major is 0 only a minor bump keeps `^0.2.x`
// consumers off a new version, and next-version.sh picks the bump from commit messages alone.
// Nothing else stops a removed export, token, class or React name from shipping as a patch.
// This test reads the last release tag's surface with `git show`, compares it with HEAD, and
// fails when a name has gone missing -- unless an unreleased commit in release-lib.sh's PATHSPEC
// carries a breaking marker (next-version.sh decides, so the two grammars cannot drift).
//
// The marker is read from the PR's own commits, but a squash merge releases from the PR title:
// put the `!` in the title as well as the commit, or the release goes out as a patch.
//
// CI must check out tags and history (`fetch-depth: 0`); with CI set and no release tag the
// test fails instead of skipping, so a shallow checkout cannot silently disable the guard.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../../..");
const SCRIPTS = join(ROOT, ".github", "scripts");

const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf-8", maxBuffer: 64 * 1024 * 1024 });

/** Names exported from a React package index.ts (`export { A, type B } from "..."` and
 * `export type { C }`), types included. Only brace-list exports are read -- `export *` and
 * `export const/function` are not, so keep index.ts to the brace form (it is today). */
export function reactNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:type\s*)?\{([^}]*)\}/g)) {
    for (const part of m[1].split(",")) {
      const name = part.replace(/^\s*type\s+/, "").trim().split(/\s+as\s+/).pop();
      if (name) names.add(name);
    }
  }
  return names;
}

/** The surface a consumer can depend on, from the three published files' text. */
export function surfaceOf({ stylesPackageJson, contractJson, reactIndex }) {
  const contract = JSON.parse(contractJson);
  const classes = new Set(Object.values(contract.components).flatMap((c) => c.classes));
  for (const list of Object.values(contract.extras ?? {})) for (const c of list) classes.add(c);
  return {
    "styles export": new Set(Object.keys(JSON.parse(stylesPackageJson).exports)),
    "contract token": new Set(contract.tokens),
    "contract class": classes,
    "React export": reactNames(reactIndex),
  };
}

/** Names present in `prev` and absent from `cur`, as "<kind> <name>" strings. */
export function removedNames(prev, cur) {
  const out = [];
  for (const [kind, names] of Object.entries(prev)) {
    for (const n of names) if (!cur[kind].has(n)) out.push(`${kind} ${n}`);
  }
  return out.sort();
}

/** Ok when nothing was removed, or when the unreleased log carries a breaking marker. */
export function verdict({ removed, breaking }) {
  return removed.length === 0 || breaking;
}

const SYNTH = {
  stylesPackageJson: JSON.stringify({ exports: { "./all": {}, "./manifest": {} } }),
  contractJson: JSON.stringify({
    tokens: ["bg", "surface"],
    components: { badge: { classes: ["rb-badge", "rb-badge--md"] } },
    extras: { "arcane-obsidian": ["rb-eyebrow"] },
  }),
  reactIndex: 'export { Badge, type BadgeProps } from "./Badge.js";\nexport { cx } from "./cx.js";',
};

test("surfaceOf reads exports, tokens, classes (including extras) and React names", () => {
  const s = surfaceOf(SYNTH);
  assert.deepEqual([...s["styles export"]].sort(), ["./all", "./manifest"]);
  assert.deepEqual([...s["contract token"]].sort(), ["bg", "surface"]);
  assert.deepEqual([...s["contract class"]].sort(), ["rb-badge", "rb-badge--md", "rb-eyebrow"]);
  assert.deepEqual([...s["React export"]].sort(), ["Badge", "BadgeProps", "cx"]);
});

test("a name present at the last release but missing now is reported, and blocks without a breaking marker", () => {
  const prev = surfaceOf(SYNTH);
  const cur = surfaceOf({ ...SYNTH, contractJson: SYNTH.contractJson.replace('"rb-badge--md"', '"rb-badge--lg"') });
  const removed = removedNames(prev, cur);
  assert.deepEqual(removed, ["contract class rb-badge--md"]);
  assert.equal(verdict({ removed, breaking: false }), false);
});

test("the same removal passes when an unreleased commit carries a breaking marker", () => {
  assert.equal(verdict({ removed: ["contract class rb-badge--md"], breaking: true }), true);
});

test("reactNames reads `export type { X }` lists too", () => {
  assert.deepEqual([...reactNames('export type { Foo, Bar as Baz } from "./x.js";')].sort(), ["Baz", "Foo"]);
});

test("additions and an unchanged surface are not removals", () => {
  const prev = surfaceOf(SYNTH);
  const cur = surfaceOf({ ...SYNTH, reactIndex: SYNTH.reactIndex + '\nexport { Extra } from "./Extra.js";' });
  assert.deepEqual(removedNames(prev, cur), []);
  assert.equal(verdict({ removed: [], breaking: false }), true);
});

function lastReleaseTag() {
  const tags = git("tag", "--list", "v[0-9]*")
    .split("\n")
    .filter((t) => /^v\d+\.\d+\.\d+$/.test(t))
    .sort((a, b) => {
      const [x, y] = [a, b].map((t) => t.slice(1).split(".").map(Number));
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    });
  return tags.at(-1);
}

test("HEAD still carries everything the last release tag shipped, unless a breaking commit is pending (#224)", (t) => {
  if (!existsSync(join(ROOT, ".git"))) return t.skip("not a git checkout");
  const tag = lastReleaseTag();
  if (!tag) {
    assert.ok(!process.env.CI, "no v* release tag in the CI checkout -- ci.yml needs fetch-depth: 0 (or fetch-tags: true)");
    return t.skip("no release tag in this checkout (git fetch --tags)");
  }
  const show = (path) => git("show", `${tag}:${path}`);
  const read = (path) => readFileSync(join(ROOT, path), "utf-8");
  const files = {
    stylesPackageJson: "styles/package.json",
    contractJson: "styles/contract.json",
    reactIndex: "components/react/src/index.ts",
  };
  const prev = surfaceOf(Object.fromEntries(Object.entries(files).map(([k, p]) => [k, show(p)])));
  const cur = surfaceOf(Object.fromEntries(Object.entries(files).map(([k, p]) => [k, read(p)])));
  const removed = removedNames(prev, cur);
  if (removed.length === 0) return;

  // Script text goes to bash as a -c string, never by path: on Windows `bash` can resolve to the
  // WSL stub, which cannot open a native path (see bump.test.mjs, issue #35).
  const libSrc = readFileSync(join(SCRIPTS, "release-lib.sh"), "utf-8");
  const pathspec = execFileSync("bash", ["-c", `${libSrc}\nprintf '%s\\0' "\${PATHSPEC[@]}"`], {
    cwd: ROOT,
    encoding: "utf-8",
  })
    .split("\0")
    .filter(Boolean);
  const bodies = git("log", `${tag}..HEAD`, "--pretty=format:%B", "--", ...pathspec);
  const version = tag.slice(1);
  const [maj, min, pat] = version.split(".").map(Number);
  const next = execFileSync("bash", ["-c", readFileSync(join(SCRIPTS, "next-version.sh"), "utf-8"), "next-version.sh", version], {
    input: bodies,
    encoding: "utf-8",
  }).trim();
  const breaking = next !== `${maj}.${min}.${pat + 1}`;
  assert.ok(
    verdict({ removed, breaking }),
    `${tag} shipped names that HEAD no longer has, and no unreleased commit carries a breaking marker ` +
      `(type!: subject or BREAKING CHANGE: footer), so this would release as a patch:\n  ${removed.join("\n  ")}`,
  );
});
