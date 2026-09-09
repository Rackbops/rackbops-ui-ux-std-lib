import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { END, START, renderedTableBlock, replaceTable } from "./generate-skill-table.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "..");
const contract = JSON.parse(readFileSync(join(ROOT, "..", "styles", "contract.json"), "utf-8"));
const skillMd = readFileSync(join(ROOT, "..", "skills", "design-system", "SKILL.md"), "utf-8");

test("SKILL.md's component inventory table matches what contract.json generates", () => {
  // Same check the script itself runs under --check: replacing the region
  // with freshly rendered content is a no-op exactly when it's already current.
  assert.equal(
    replaceTable(skillMd, renderedTableBlock(contract)),
    skillMd,
    "SKILL.md's table is stale -- run `node scripts/generate-skill-table.mjs` to regenerate it"
  );
});

test("replaceTable throws (never corrupts) when the end marker precedes the start", () => {
  // END above START: the old indexOf pair sliced the region backwards and
  // duplicated the body on every run; the guard must throw instead.
  const reversed = `${END}\nold table\n${START}`;
  assert.throws(() => replaceTable(reversed, "NEW"), /missing the .*end.* marker after/);
  // Sanity: correctly ordered markers still replace exactly the region.
  const ordered = `intro\n${START}\nold\n${END}\noutro`;
  assert.equal(replaceTable(ordered, "NEW"), "intro\nNEW\noutro");
  // Missing start still throws.
  assert.throws(() => replaceTable("no markers here", "NEW"), /missing the .*start.* marker/);
});
