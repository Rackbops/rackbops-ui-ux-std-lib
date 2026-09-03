import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { renderedTableBlock } from "./generate-skill-table.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "..");
const contract = JSON.parse(readFileSync(join(ROOT, "..", "styles", "contract.json"), "utf-8"));
const skillMd = readFileSync(join(ROOT, "..", "skills", "design-system", "SKILL.md"), "utf-8");

test("SKILL.md's component inventory table matches what contract.json generates", () => {
  const start = skillMd.indexOf("<!-- contract-table:start -->");
  const end = skillMd.indexOf("<!-- contract-table:end -->");
  assert.notEqual(start, -1, "SKILL.md is missing the contract-table:start marker");
  assert.notEqual(end, -1, "SKILL.md is missing the contract-table:end marker");
  const committed = skillMd.slice(start, end + "<!-- contract-table:end -->".length);
  assert.equal(
    committed,
    renderedTableBlock(contract),
    "SKILL.md's table is stale -- run `node scripts/generate-skill-table.mjs` to regenerate it"
  );
});
