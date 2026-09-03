#!/usr/bin/env node
// Generates skills/design-system/SKILL.md's component-inventory table from
// styles/contract.json — the single source of truth for the shared
// component/class set (STANDARD.md 4.4). Run with no flags to rewrite
// SKILL.md in place; run with --check to verify the committed table matches
// (used by scripts/generate-skill-table.test.mjs and can be wired into CI).
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const CONTRACT_PATH = join(ROOT, "styles", "contract.json");
const SKILL_PATH = join(ROOT, "skills", "design-system", "SKILL.md");
const START = "<!-- contract-table:start -->";
const END = "<!-- contract-table:end -->";

export function renderReact(react) {
  if (react === null) return "—";
  const names = Array.isArray(react) ? react : [react];
  return names.map((n) => `\`${n}\``).join("/");
}

export function renderClass(classes) {
  return `\`.${classes[0]}\``;
}

export function renderTable(contract) {
  const rows = Object.entries(contract.components).map(
    ([, def]) => `| ${renderReact(def.react)} | ${renderClass(def.classes)} | ${def.notes ?? ""} |`
  );
  return ["| React | CSS class | Notes |", "| --- | --- | --- |", ...rows].join("\n");
}

export function renderedTableBlock(contract) {
  return `${START}\n${renderTable(contract)}\n${END}`;
}

export function replaceTable(skillMd, block) {
  const startIdx = skillMd.indexOf(START);
  const endIdx = skillMd.indexOf(END);
  if (startIdx === -1 || endIdx === -1) {
    throw new Error(`SKILL.md is missing the ${START} / ${END} markers`);
  }
  return skillMd.slice(0, startIdx) + block + skillMd.slice(endIdx + END.length);
}

function main() {
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, "utf-8"));
  const skillMd = readFileSync(SKILL_PATH, "utf-8");
  const updated = replaceTable(skillMd, renderedTableBlock(contract));
  const checkMode = process.argv.includes("--check");

  if (checkMode) {
    if (updated !== skillMd) {
      console.error(
        "SKILL.md's component inventory table is stale -- run `node scripts/generate-skill-table.mjs` to regenerate it."
      );
      process.exitCode = 1;
      return;
    }
    console.log("SKILL.md's component inventory table is up to date.");
    return;
  }

  writeFileSync(SKILL_PATH, updated);
  console.log("Regenerated SKILL.md's component inventory table.");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) main();
