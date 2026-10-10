import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// compose.yaml is the live stack on the box (the box's clone IS the stack dir), so an image line
// here is what runs there. No `:latest` and no untagged image (Rackbops/Tooling#902): a moving tag
// is shared by every stack on the box, so once another stack pulls a newer one, this stack's
// container runs an image its own recorded tag no longer names, and Renovate has no version to
// raise a bump PR for. `nginx:alpine` passes on purpose -- a documented float within nginx's
// alpine line, not an untagged image. A `${...}` reference fails: it would hide a `:-latest`
// default, and this stack's compose is never rendered from a .env that could pin it.

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");

/** Every `image:` value in a compose file, in file order. */
function imageRefs(text) {
  return [...text.matchAll(/^\s*image:\s*["']?([^"'\s#]+)/gm)].map((m) => m[1]);
}

/** The tag of an image reference, or null when it has none (a `host:port/` registry is not a tag). */
function imageTag(ref) {
  const name = ref.split("@")[0];
  const colon = name.indexOf(":", name.lastIndexOf("/") + 1);
  return colon === -1 ? null : name.slice(colon + 1);
}

/** Why `ref` breaks the pin rule, or null when it is pinned. */
function pinProblem(ref) {
  if (ref.includes("${")) return "uses a variable instead of a literal tag";
  const tag = imageTag(ref);
  if (tag === null) return "untagged";
  if (tag === "latest") return "floats on :latest";
  return null;
}

test("pinProblem rejects :latest and untagged references, accepts tags and tag+digest", () => {
  assert.equal(pinProblem("cloudflare/cloudflared:latest"), "floats on :latest");
  assert.equal(pinProblem("cloudflare/cloudflared"), "untagged");
  assert.equal(pinProblem("cloudflare/cloudflared:${TAG:-latest}"), "uses a variable instead of a literal tag");
  assert.equal(pinProblem("localhost:5000/cloudflared"), "untagged");
  assert.equal(pinProblem("cloudflare/cloudflared@sha256:" + "0".repeat(64)), "untagged");
  assert.equal(pinProblem("cloudflare/cloudflared:2026.9.3"), null);
  assert.equal(pinProblem("localhost:5000/cloudflared:2026.9.3"), null);
  assert.equal(pinProblem("cloudflare/cloudflared:2026.9.3@sha256:" + "0".repeat(64)), null);
  assert.equal(pinProblem("nginx:alpine"), null);
});

test("compose.yaml pins every image: no :latest, no untagged image (Rackbops/Tooling#902)", () => {
  const refs = imageRefs(readFileSync(join(ROOT, "compose.yaml"), "utf-8"));
  // Both services, so a regex that stops matching can't pass this vacuously.
  assert.ok(refs.some((r) => r.startsWith("nginx:")), `no nginx image line found in ${refs}`);
  assert.ok(
    refs.some((r) => r.startsWith("cloudflare/cloudflared")),
    `no cloudflared image line found in ${refs}`
  );
  for (const ref of refs) {
    assert.equal(pinProblem(ref), null, `compose.yaml: ${ref} ${pinProblem(ref)}`);
  }
});
