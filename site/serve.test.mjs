// Regression tests for the security-relevant logic in serve.mjs -- this
// exact containment/allowlist check has needed several rounds of fixes (a
// naive prefix check, a case-sensitive .git exclusion, a string-only check
// defeated by an NTFS 8.3 short name alias, and now the site/styles
// allowlist replacing the old .git-only denylist -- issue #90, mirroring
// #89's nginx.conf), so it gets its own test file rather than trusting
// review alone to catch a regression.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { resolve, sep } from "node:path";
import { decodePathname, isForbiddenRelativePath, isFresh, resolveSafePath, server } from "./serve.mjs";

/** Whether resolveSafePath rejects a pathname at all -- outside the
 * allowlist, an escape attempt, or genuinely missing all reject the same
 * way now (round-1 review finding on #90: a distinguishable "forbidden"
 * message let the HTTP status leak whether a non-allowlisted path exists),
 * so this suite no longer tries to tell the reasons apart. */
async function isForbidden(pathname) {
  try {
    await resolveSafePath(pathname);
    return false;
  } catch {
    return true;
  }
}

// -- resolveSafePath: the full chain (URL decode -> join -> realpath ->
// isForbiddenRelativePath) against real requests and real files.

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

test("plain .. is collapsed by the URL parser itself, before decode -- not a traversal, but package.json is outside the allowlist anyway", async () => {
  // The WHATWG URL parser collapses a literal "/../" dot segment at parse
  // time (unlike the %2f-encoded form above), so this resolves to the real,
  // in-root package.json -- no escape occurred. It's still rejected, though:
  // package.json isn't under site/ or styles/, so the allowlist forbids it
  // the same as any other repo-root file.
  assert.ok(await isForbidden(decodePathname("/../package.json")));
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
// an NTFS 8.3 short name, a symlink) down to a real path.

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
  assert.equal(isForbiddenRelativePath(["site", "..fixture-dotdot-prefix.txt"].join(sep)), false);
});

test("isForbiddenRelativePath: site/ and styles/ content is allowed, including the bare directories themselves", () => {
  assert.equal(isForbiddenRelativePath(["site", "index.html"].join(sep)), false);
  assert.equal(isForbiddenRelativePath(["styles", "manifest.json"].join(sep)), false);
  assert.equal(isForbiddenRelativePath("site"), false);
  assert.equal(isForbiddenRelativePath("styles"), false);
});

test("isForbiddenRelativePath: a real repo-root file outside the allowlist is forbidden", () => {
  for (const rel of [
    "package.json",
    ".gitignore",
    "compose.yaml",
    "nginx.conf",
    [".claude", "launch.json"].join(sep),
    ["deploy", "deploy-pull.sh"].join(sep),
  ]) {
    assert.equal(isForbiddenRelativePath(rel), true, rel);
  }
});

test("isForbiddenRelativePath: .git is forbidden, with no dedicated .git check -- it's simply never a site/styles top segment", () => {
  // The repo's real .git always sits at ROOT (top segment ".git"), never
  // nested under site/ or styles/ -- there's no submodule or nested repo
  // there, and nothing in this codebase creates one. That's what retires
  // the old "walk every segment, case-insensitively" check: a lone
  // top-segment test is enough for a path that's actually .git, and
  // realpath has already resolved any alias (a symlink, an NTFS 8.3 short
  // name) to where it truly lives before this function ever sees it -- so a
  // request can't spoof its way to a top segment of "site" without a real
  // "site" directory entry to back it.
  assert.equal(isForbiddenRelativePath(".git"), true);
  assert.equal(isForbiddenRelativePath([".git", "HEAD"].join(sep)), true);
  assert.equal(isForbiddenRelativePath([".git", "refs", "heads", "main"].join(sep)), true);
});

// -- End-to-end over the real HTTP server: the issue #90 curl table,
// checked against the exported `server` instance directly rather than
// shelling out to `node site/serve.mjs` + curl.

let baseUrl;
before(async () => {
  await new Promise((res) => server.listen(0, "127.0.0.1", res));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((res) => server.close(res));
});

test("GET / serves site/index.html locally, 200 -- nginx 302s a bare / instead (documented divergence, see serve.mjs's header)", async () => {
  const res = await fetch(`${baseUrl}/`);
  assert.equal(res.status, 200);
});

test("GET /site/ serves site/index.html, 200 (matches nginx's exact-match /site/ location)", async () => {
  const res = await fetch(`${baseUrl}/site/`);
  assert.equal(res.status, 200);
});

test("GET /styles/manifest.json, 200", async () => {
  const res = await fetch(`${baseUrl}/styles/manifest.json`);
  assert.equal(res.status, 200);
});

test("GET /styles/neon-butterfly/assets/butterfly-circuit.png, 200", async () => {
  const res = await fetch(`${baseUrl}/styles/neon-butterfly/assets/butterfly-circuit.png`);
  assert.equal(res.status, 200);
});

test("GET /site and /styles with no trailing slash both 404 (matches nginx: its prefix locations require the slash to match, so these fall to the catch-all)", async () => {
  for (const p of ["/site", "/styles"]) {
    const res = await fetch(`${baseUrl}${p}`);
    assert.equal(res.status, 404, p);
  }
});

test("GET an index-less directory with a trailing slash still 404s (matches nginx: try_files never lists a directory)", async () => {
  const res = await fetch(`${baseUrl}/site/__screenshots__/`);
  assert.equal(res.status, 404);
});

test("GET a real repo-root file outside the allowlist, 404 -- same as nginx's catch-all (.gitignore, compose.yaml, nginx.conf, .claude/launch.json, deploy/deploy-pull.sh)", async () => {
  for (const p of ["/.gitignore", "/compose.yaml", "/nginx.conf", "/.claude/launch.json", "/deploy/deploy-pull.sh"]) {
    const res = await fetch(`${baseUrl}${p}`);
    assert.equal(res.status, 404, p);
  }
});

test("a non-allowlisted path answers the same status whether or not it actually exists on disk -- no existence leak (round-1 review finding on #90)", async () => {
  // Before the fix, realpath ran before the allowlist check: an existing
  // non-allowlisted file rejected with the distinguishable "forbidden"
  // 403, while a nonexistent one 404'd on realpath's own ENOENT -- so the
  // status code alone revealed whether e.g. some unlisted file existed.
  for (const [existing, missing] of [
    ["/compose.yaml", "/compose.nope"],
    ["/deploy/deploy-pull.sh", "/deploy/nope.sh"],
  ]) {
    const existingRes = await fetch(`${baseUrl}${existing}`);
    const missingRes = await fetch(`${baseUrl}${missing}`);
    assert.equal(existingRes.status, missingRes.status, `${existing} vs ${missing}`);
    assert.equal(existingRes.status, 404, existing);
  }
});

// -- Conditional requests (#116): a 200 carries validators; a matching
// If-None-Match or If-Modified-Since gets a 304 with no body; a stale one
// gets a fresh 200. A 404 is unaffected -- it sends no validators at all
// (asserted by the existing 404 tests above, unmodified).

test("a 200 carries ETag, Last-Modified and Cache-Control: no-cache (#116)", async () => {
  const res = await fetch(`${baseUrl}/styles/manifest.json`);
  assert.equal(res.status, 200);
  assert.match(res.headers.get("etag"), /^"[0-9a-f]+-[0-9a-f]+"$/);
  assert.ok(!Number.isNaN(Date.parse(res.headers.get("last-modified"))), "last-modified must be a parseable HTTP date");
  assert.equal(res.headers.get("cache-control"), "no-cache");
});

test("If-None-Match with the current ETag answers 304 with no body", async () => {
  const first = await fetch(`${baseUrl}/styles/manifest.json`);
  const etag = first.headers.get("etag");
  const res = await fetch(`${baseUrl}/styles/manifest.json`, { headers: { "if-none-match": etag } });
  assert.equal(res.status, 304);
  assert.equal(await res.text(), "");
  assert.equal(res.headers.get("etag"), etag);
});

test("If-None-Match with a stale tag answers 200 with the body", async () => {
  const res = await fetch(`${baseUrl}/styles/manifest.json`, { headers: { "if-none-match": '"stale"' } });
  assert.equal(res.status, 200);
  assert.ok((await res.text()).length > 0);
});

test("If-Modified-Since equal to Last-Modified answers 304; an older date answers 200", async () => {
  const first = await fetch(`${baseUrl}/styles/manifest.json`);
  const lastModified = first.headers.get("last-modified");
  const fresh = await fetch(`${baseUrl}/styles/manifest.json`, { headers: { "if-modified-since": lastModified } });
  assert.equal(fresh.status, 304);
  const stale = await fetch(`${baseUrl}/styles/manifest.json`, {
    headers: { "if-modified-since": new Date(Date.parse(lastModified) - 1000 * 60 * 60).toUTCString() },
  });
  assert.equal(stale.status, 200);
});

test("isFresh: a comma-separated If-None-Match list matches any member", () => {
  assert.equal(isFresh({ "if-none-match": '"a", "b", "c"' }, '"b"', 0), true);
  assert.equal(isFresh({ "if-none-match": '"a", "b", "c"' }, '"z"', 0), false);
});
