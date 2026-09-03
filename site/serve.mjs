// Minimal dependency-free static server for the local showcase.
// Serves the repo root so /site/index.html can reach ../styles/*.
//   pnpm showcase   ->   http://localhost:5177/site/
import { createServer } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { extname, isAbsolute, join, normalize, relative, resolve, sep } from "node:path";
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

/** The containment/.git-exclusion decision over an already-resolved relative
 * path (e.g. from path.relative(ROOT_REAL, someRealPath)) -- pure and
 * exported separately so this exact logic is unit-testable with synthetic
 * inputs, independent of what a given checkout's .git actually looks like
 * on disk (a worktree's own .git is a plain pointer file, not a directory,
 * so a real "/.git/config" request can't exercise this there). */
export function isForbiddenRelativePath(rel) {
  const outsideRoot = rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel);
  const touchesGit = rel.split(sep).some((seg) => seg.toLowerCase() === ".git");
  return outsideRoot || touchesGit;
}

/**
 * Resolve a decoded URL pathname to a safe file path under ROOT, or throw if
 * it would escape ROOT or reach the repo's own .git/. Resolves through
 * fs.realpath -- the real on-disk path -- rather than comparing path text,
 * so filesystem-level aliasing a string comparison can't see (case
 * differences on Windows/macOS, an NTFS 8.3 short name like GIT~1 for
 * .git, a symlink) can't be used to route around containment or the .git
 * exclusion: whatever spelling the request used, the check runs against
 * what the alias actually resolves to.
 */
export async function resolveSafePath(pathname) {
  if (pathname === "/") pathname = "/site/index.html";
  else if (pathname.endsWith("/")) pathname += "index.html";
  const filePath = normalize(join(ROOT, pathname));
  const realFilePath = await realpath(filePath);
  const rel = relative(ROOT_REAL, realFilePath);
  if (isForbiddenRelativePath(rel)) {
    throw new Error("forbidden");
  }
  return realFilePath;
}

const server = createServer(async (req, res) => {
  try {
    const pathname = decodePathname(req.url);
    const filePath = await resolveSafePath(pathname);
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": TYPES[extname(filePath)] ?? "application/octet-stream" });
    res.end(body);
  } catch (err) {
    // Only a deliberate containment/.git rejection is 403; everything else
    // (malformed encoding, a path that doesn't exist, realpath failing on a
    // missing file) is a plain 404, same as before this file could tell the
    // two apart.
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
