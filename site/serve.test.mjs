// Regression tests for the security-relevant logic in serve.mjs -- this
// exact containment/.git check has needed three rounds of fixes (a naive
// prefix check, a case-sensitive .git exclusion, a string-only check
// defeated by an NTFS 8.3 short name alias), so it gets its own test file
// rather than trusting review alone to catch a fourth regression.
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve, sep } from "node:path";
import { decodePathname, isForbiddenRelativePath, resolveSafePath } from "./serve.mjs";

/** resolveSafePath rejecting is the "forbidden" contract; anything else
 * (a plain file-not-found) is a different failure this suite doesn't
 * exercise as a rejection. */
async function isForbidden(pathname) {
  try {
    await resolveSafePath(pathname);
    return false;
  } catch (err) {
    return err instanceof Error && err.message === "forbidden";
  }
}

// -- resolveSafePath: the full chain (URL decode -> join/normalize ->
// realpath -> isForbiddenRelativePath) against real requests and real files.

test("resolves a real in-root file", async () => {
  const filePath = await resolveSafePath(decodePathname("/site/serve.mjs"));
  assert.ok(filePath.endsWith("serve.mjs"));
});

test("/ resolves to site/index.html", async () => {
  const filePath = await resolveSafePath(decodePathname("/"));
  assert.match(filePath, /index\.html$/);
});

test("a trailing slash resolves to that directory's index.html", async () => {
  const filePath = await resolveSafePath(decodePathname("/site/"));
  assert.match(filePath, /index\.html$/);
});

test("rejects %2f-encoded traversal to ROOT's own parent (issue #27)", async () => {
  // "..%2f." decodes to "../.", landing exactly on ROOT's parent -- a target
  // guaranteed to exist without depending on what else happens to live
  // alongside this checkout. %2f survives the URL parser's dot-segment
  // collapsing (it only collapses a literal "/../", not an encoded one), so
  // this only becomes a real ".." after decodeURIComponent -- exactly the
  // issue's reported mechanism.
  assert.ok(await isForbidden(decodePathname("/..%2f.")));
});

test(
  "rejects %5c-encoded traversal the same way, where backslash is a path separator (issue #27)",
  // Per the issue's own finding: "%5c escapes on win32 only" -- POSIX
  // path/fs treats \ as an ordinary filename character, not a separator, so
  // this decodes to a literal (nonexistent) "..\." filename there and 404s
  // safely rather than being rejected as "forbidden". Verified directly
  // against a real Linux node binary: asserting "forbidden" universally
  // fails there, since there is no traversal to reject on that platform.
  { skip: process.platform !== "win32" ? "backslash isn't a path separator on this platform" : false },
  async () => {
    assert.ok(await isForbidden(decodePathname("/..%5c.")));
  },
);

test("plain .. is collapsed by the URL parser itself, before decode -- not a bypass", async () => {
  // The WHATWG URL parser collapses a literal "/../" dot segment at parse
  // time (unlike the %2f-encoded form above), so this resolves to the real
  // package.json at ROOT, neither escaping nor 404ing.
  const filePath = await resolveSafePath(decodePathname("/../package.json"));
  assert.match(filePath, /package\.json$/);
});

test("a real file starting with two dots but no separator after resolves normally", async () => {
  // A real fixture (rather than a nonexistent path, which would 404 on
  // realpath before ever reaching the containment check and wouldn't prove
  // anything) confirming the end-to-end chain doesn't choke on this name.
  // The precise rel.startsWith(".." + sep) vs a cruder rel.startsWith("..")
  // boundary is what the synthetic isForbiddenRelativePath unit test below
  // exercises directly -- this file's own rel is "site<sep>..fixture...",
  // so the leading ".." here never lands at the very start of rel.
  const filePath = await resolveSafePath(decodePathname("/site/..fixture-dotdot-prefix.txt"));
  assert.match(filePath, /\.\.fixture-dotdot-prefix\.txt$/);
});

// -- isForbiddenRelativePath: the pure decision logic, unit-tested directly
// with synthetic relative paths. This is what actually decides "forbidden"
// once realpath has already resolved any filesystem-level aliasing (case,
// an NTFS 8.3 short name, a symlink) down to a real path -- exercising it
// this way doesn't depend on what a given checkout's .git looks like on
// disk (a worktree's own .git is a plain pointer file, not a directory, so
// a real "/.git/config" request can't reliably exercise this everywhere
// this suite might run).

test("isForbiddenRelativePath: an exact .git segment is forbidden, at any depth", () => {
  assert.equal(isForbiddenRelativePath(".git"), true);
  assert.equal(isForbiddenRelativePath([".git", "config"].join(sep)), true);
  assert.equal(isForbiddenRelativePath([".git", "refs", "heads", "main"].join(sep)), true);
  assert.equal(isForbiddenRelativePath(["site", ".git", "config"].join(sep)), true);
});

test("isForbiddenRelativePath: the .git match is case-insensitive", () => {
  for (const variant of [".GIT", ".Git", ".GiT", ".gIt"]) {
    assert.equal(isForbiddenRelativePath([variant, "config"].join(sep)), true, variant);
  }
});

test("isForbiddenRelativePath: a segment merely containing .git as a substring is not blocked", () => {
  assert.equal(isForbiddenRelativePath([".github-stuff", "x.txt"].join(sep)), false);
  assert.equal(isForbiddenRelativePath(["mygit", "x.txt"].join(sep)), false);
  assert.equal(isForbiddenRelativePath("gitignore.txt"), false);
});

test("isForbiddenRelativePath: outside-root relative paths are forbidden", () => {
  assert.equal(isForbiddenRelativePath(".."), true);
  assert.equal(isForbiddenRelativePath([ "..", "secrets", "x.txt"].join(sep)), true);
  // path.resolve() of anything is always an absolute path on whatever
  // platform this runs on -- deliberately not hand-writing an OS-specific
  // literal here (a Windows-style "C:\..." string wouldn't read as absolute
  // on POSIX, and vice versa).
  assert.equal(isForbiddenRelativePath(resolve("definitely-outside")), true, "an absolute result must be forbidden");
});

test("isForbiddenRelativePath: a name starting with .. but no separator after is not traversal", () => {
  assert.equal(isForbiddenRelativePath("..fixture-dotdot-prefix.txt"), false);
});

test("isForbiddenRelativePath: an ordinary in-root relative path is allowed", () => {
  assert.equal(isForbiddenRelativePath("index.html"), false);
  assert.equal(isForbiddenRelativePath(["styles", "manifest.json"].join(sep)), false);
});
