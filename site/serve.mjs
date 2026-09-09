// Minimal dependency-free static server for the local showcase.
// Serves the repo root so /site/index.html can reach ../styles/*, but only
// answers requests under site/ or styles/ -- the same allowlist nginx.conf
// enforces for the hosted showcase (issue #90, mirroring #89's nginx.conf).
// One deliberate difference: nginx 302s a bare `/` to `/site/`; this server
// serves site/index.html directly at `/` for local convenience (one hop
// fewer while iterating). Everything else -- the curl table in issue #90 --
// matches: a directory with no backing index.html 404s on both (nginx's
// `try_files $uri =404` never falls back to a directory listing or `$uri/`;
// this server's readFile on a directory throws and lands in the same 404
// catch), and `/site` or `/styles` with no trailing slash 404s on both
// (nginx's prefix locations require the trailing slash to match; this
// server never appends index.html without one, so the bare directory read
// throws EISDIR the same way).
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
 * it would escape ROOT or fall outside the site/styles allowlist. Resolves
 * through fs.realpath -- the real on-disk path -- rather than comparing path
 * text, so filesystem-level aliasing a string comparison can't see (case
 * differences on Windows/macOS, an NTFS 8.3 short name, a symlink) can't be
 * used to route around containment or the allowlist: whatever spelling the
 * request used, the check runs against what the alias actually resolves to.
 */
export async function resolveSafePath(pathname) {
  if (pathname === "/") pathname = "/site/index.html";
  else if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = join(ROOT, pathname);
  const realFilePath = await realpath(filePath);
  const rel = relative(ROOT_REAL, realFilePath);
  if (isForbiddenRelativePath(rel)) {
    throw new Error("forbidden");
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
  } catch (err) {
    // Only a deliberate containment/allowlist rejection is 403 -- an escape
    // attempt, or a real repo file outside site/styles (compose.yaml,
    // nginx.conf, deploy/*, .git/*). Everything else (malformed encoding, a
    // path that doesn't exist, realpath failing on a missing file -- e.g. a
    // directory with no index.html) is a plain 404.
    if (err instanceof Error && err.message === "forbidden") {
      res.writeHead(403).end("forbidden");
    } else {
      res.writeHead(404).end("not found");
    }
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
