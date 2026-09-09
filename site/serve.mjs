// Minimal dependency-free static server for the local showcase.
// Serves the repo root so /site/index.html can reach ../styles/*, but only
// answers requests under site/ or styles/ -- the same allowlist nginx.conf
// enforces for the hosted showcase (issue #90, mirroring #89's nginx.conf).
// Every rejection -- outside the allowlist, an escape attempt, or a file
// that's simply missing -- answers a uniform 404, matching nginx's own
// catch-all (`location / { return 404; }`), which never touches the
// filesystem for a non-matching path and so can't leak whether some
// unlisted file happens to exist. The allowlist check therefore runs on the
// request path BEFORE any filesystem call (`resolveSafePath` below) -- doing
// it only after `realpath` would let a rejection's origin (allowlist miss
// vs. genuinely absent) leak through as 403 vs. 404 (round-1 review finding
// on #90: `403 /compose.yaml` vs `404 /compose.nope`, same for
// deploy/deploy-pull.sh and nginx.conf).
//
// Deliberate differences from nginx, both dev-box conveniences with no
// production equivalent:
// - nginx 302s a bare `/` to `/site/`; this server serves site/index.html
//   directly at `/` (one hop fewer while iterating).
// - realpath canonicalises case on a case-insensitive filesystem (NTFS,
//   default macOS), so on Windows/macOS a request whose TOP segment is
//   allowlist-cased correctly but a DEEPER segment isn't (e.g.
//   /site/INDEX.HTML) still resolves and serves 200, where Linux nginx -- and
//   this server on Linux -- 404s (case-sensitive filesystem). A wrong-cased
//   top segment (e.g. /SITE/, /Styles/) is caught by the pre-filesystem
//   allowlist check below regardless of platform, since that check compares
//   the literal request text, not a realpath-canonicalised one.
//   pnpm showcase   ->   http://localhost:5177/site/
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
// Resolved once at startup so every request compares against the real,
// on-disk root rather than however it happens to be spelled.
const ROOT_REAL = realpathSync(ROOT);
const PORT = Number(process.env.PORT) || 5177;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

/** The URL's pathname, decoded once. Exported so tests can replay the exact
 * decode chain a raw request URL goes through, rather than hand-constructing
 * an already-decoded pathname that skips the encoding tricks this guards. */
export function decodePathname(rawUrl) {
  return decodeURIComponent(new URL(rawUrl, "http://x").pathname);
}

/** Top-level directories the showcase actually needs: site/ (the page itself)
 * and styles/ (its `../styles/all.css` import and manifest.json fetch). */
const ALLOWED_TOP_DIRS = ["site", "styles"];

/** The containment/allowlist decision over an already-resolved relative path
 * (e.g. from path.relative(ROOT_REAL, someRealPath)) -- pure and exported
 * separately so this exact logic is unit-testable with synthetic inputs,
 * independent of what a given checkout's repo root actually looks like on
 * disk. Rejects an escape from ROOT (a ".." that survived realpath, or an
 * absolute result), or a real in-root path whose top-level segment isn't in
 * ALLOWED_TOP_DIRS -- which covers .git without a dedicated check: realpath
 * has already resolved any alias (case, an NTFS 8.3 short name, a symlink)
 * to where it truly lives, and nothing under site/ or styles/ is ever a real
 * .git in this repo's layout, so a lone top-segment check is enough. */
export function isForbiddenRelativePath(rel) {
  const outsideRoot = rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel);
  if (outsideRoot) return true;
  const [top] = rel.split(sep);
  return !ALLOWED_TOP_DIRS.includes(top);
}

/**
 * Resolve a decoded URL pathname to a safe file path under ROOT, or throw if
 * it would escape ROOT, fall outside the site/styles allowlist, or simply
 * not exist. Two checks, in order:
 *
 * 1. A lexical allowlist check against the request path itself, before any
 *    filesystem call -- `isForbiddenRelativePath` doesn't care where its
 *    input came from, so the same pure function that later re-checks the
 *    realpath-resolved result also decides this purely from `join`'s
 *    string-level normalisation. A path that fails here never touches
 *    realpath/readFile, so its rejection can't reveal whether it happens to
 *    exist on disk.
 * 2. The same check again on the realpath-resolved result, for a path that
 *    passed step 1 lexically (a real top segment of site/ or styles/) but
 *    resolves somewhere else once symlinks are followed -- filesystem-level
 *    aliasing a string comparison alone can't see (a symlink under site/
 *    pointing outside ROOT, an NTFS 8.3 short name).
 */
export async function resolveSafePath(pathname) {
  if (pathname === "/") pathname = "/site/index.html";
  else if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = join(ROOT, pathname);
  if (isForbiddenRelativePath(relative(ROOT, filePath))) {
    throw new Error("not found");
  }
  const realFilePath = await realpath(filePath);
  if (isForbiddenRelativePath(relative(ROOT_REAL, realFilePath))) {
    throw new Error("not found");
  }
  return realFilePath;
}

// Exported so the visual-regression script (scripts/visual.mjs, #50) can start
// this same server in-process on an OS-assigned port rather than shelling out.
export const server = createServer(async (req, res) => {
  try {
    const pathname = decodePathname(req.url);
    const filePath = await resolveSafePath(pathname);
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": TYPES[extname(filePath)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    // Uniform 404 for every rejection -- outside the allowlist, an escape
    // attempt, or genuinely missing -- so the status code alone never
    // reveals which one it was (see this file's header).
    res.writeHead(404).end("not found");
  }
});

// Only bind when run directly (`pnpm showcase` / `node site/serve.mjs`), not
// when imported by a test.
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  server.listen(PORT, "127.0.0.1", () => {
    console.log(`showcase: http://localhost:${PORT}/site/`);
  });
}
