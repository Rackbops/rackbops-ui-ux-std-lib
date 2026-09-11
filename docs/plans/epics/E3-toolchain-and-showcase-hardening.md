# E3 -- Toolchain and showcase hardening: implementation plan, PR A (#112 + #113 + #114)

Epic #179. This plan covers PR A: #112 (`@rackbops/ui-react` entry points), #113 (changelog grammar), #114 (`release.yml` gates), entered via `/work-on 112`, closing all three. PRs B, C and D get their own plans as they are picked up. Written by the orchestrator on 2026-09-10 against `origin/main` at `be09088` (v0.2.30); line numbers are from that commit -- re-check with `grep -n` before editing. Committed on the branch as `docs/plans/epics/E3-toolchain-and-showcase-hardening.md` in the first commit; later PRs append their sections to the same file.

## Locked decisions

1. **#112: `main` and `types` mirror `exports["."]`**, guarded by a package-shape test that lives inside the React package as `src/package-shape.test.tsx` -- the package's test glob is `src/**/*.test.tsx` (`components/react/package.json:29`), so a `.test.ts` would never run, and `release-lib.sh`'s PATHSPEC (`:46-47`) already excludes `*.test.tsx` from release triggers. `styles/package.json` is CSS-only with no JS entry point; it is out of scope and the PR says so.
2. **#113: `revert` joins the changelog after `fix`** (section title "Reverts"), and a `type!:` / `type(scope)!:` subject renders as `- BREAKING: <description>` under its own type. `BREAKING CHANGE:` footers stay invisible to the notes: the changelog walks a `%s` subjects-only stream (`release.sh:50`, `release-notes.sh:31`) while the bump reads `%B` (`release.sh:67`); that asymmetry is documented, not changed. `next-version.sh` already bumps the minor for `revert!:` (`:23`, any `[a-z]+!:`) -- pinned with one `bump.test.mjs` case so the two grammars cannot drift silently again.
3. **#114: a job-level gate on a repository variable, `vars.RELEASE_ENABLED == 'true'`.** `secrets` is unavailable in a job-level `if` (`release.yml:30-33` says so); `vars` is. The orchestrator set `RELEASE_ENABLED=true` on this repo on 2026-09-10 (`gh variable list` shows it), so releases keep flowing the moment this merges; a fork or a repo without the variable skips before a runner is provisioned. The step-level secret check (`:71-74`) stays as defence in depth -- a variable without the secret still no-ops instead of attempting a doomed push. The bump-commit guard is scoped to the identity `release.yml:59` configures: skip only when the subject starts with `chore(release): v` **and** `github.event.head_commit.author.name == 'github-actions[bot]'` (verified: the last three bump commits on `main` are authored by exactly that name).
4. **Nothing in `styles/`, `contract.json`, the showcase or the React source changes** -- no baselines, no SKILL.md regeneration. Docs touched: `README.md` Publishing (`:160-188`) and `CONTEXT.md` Release (`:59-66`), both of which state behaviour this PR changes.
5. **Never run `release.sh`, `release-notes.sh` or `publish-release.sh` by hand against the real checkout** -- only through `styles/test/helpers/release-repo.mjs`'s scratch repos. `release.test.mjs:22-35` records the one time that pushed a real tag by accident.

## Build order (one commit per step, Conventional Commits)

### 1. Plan file -- `docs(plans): E3 toolchain and showcase hardening, PR A plan`

This document, verbatim, at `docs/plans/epics/E3-toolchain-and-showcase-hardening.md`.

### 2. #112 -- `fix(react): declare main and types so exports-blind resolvers find the package`

`components/react/package.json:20`, immediately before `"exports"`:

```
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
```

New `components/react/src/package-shape.test.tsx` (no JSX needed; the extension is what the test glob matches):

```tsx
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf-8"));

test('package.json: main and types mirror exports["."] so exports-blind resolvers see the same entry (#112)', () => {
  const root = pkg.exports["."];
  assert.equal(pkg.main, root.default, "main must name the same file as exports['.'].default");
  assert.equal(pkg.types, root.types, "types must name the same file as exports['.'].types");
  assert.match(pkg.main, /^\.\/dist\//);
  assert.match(pkg.types, /^\.\/dist\/.*\.d\.ts$/);
});
```

Do not assert that `dist/` exists: the package test runs `tsc --noEmit` first and never builds.

### 3. #113 -- `fix(release): file revert!: under Reverts and mark breaking subjects in the changelog`

`.github/scripts/release-lib.sh`:

- `:68`: `COMMIT_TYPES_ORDER=(feat fix revert perf refactor chore docs style test build ci)`.
- `:70-81`: add `[revert]="Reverts"` after `[fix]`.
- `:97-103`: the pattern captures the bang as its own group: `local pattern='^([a-z]+)(\([^)]*\))?(!?):[[:space:]]+(.+)$'` (type 1, scope 2, bang 3, description 4). Rewrite the comment above it: the bang is captured so a breaking subject is both kept under its type and marked; footers are not visible here (subjects-only stream), only to `next-version.sh`, which reads full bodies for the bump.
- `:111-112`:

```bash
    if [[ "$msg" =~ $pattern ]] && [[ -n "${COMMIT_TYPE_NAMES[${BASH_REMATCH[1]}]+x}" ]]; then
      local marker=""
      [[ -n "${BASH_REMATCH[3]}" ]] && marker="BREAKING: "
      type_entries[${BASH_REMATCH[1]}]+="- ${marker}${BASH_REMATCH[4]}"$'\n'
```

`styles/test/release.test.mjs`, after the grouping test (`:451-473`), same fixture style:

- `release-notes.sh: revert!: lands under Reverts with the BREAKING marker; a breaking feat keeps its section and gains the marker; a plain feat has none` -- commits (each on its own `styles/<X>.txt`): `revert!: drop the legacy tokens`, `feat!: rename the accent tokens`, `feat: plain feature`, `revert: undo the badge tweak`; tag `v0.1.1`, push the tag; assert `/### Reverts[\s\S]*- BREAKING: drop the legacy tokens/`, `/### Reverts[\s\S]*- undo the badge tweak/`, `/### Features[\s\S]*- BREAKING: rename the accent tokens/`, `/### Features[\s\S]*- plain feature/`, `assert.doesNotMatch(notes, /BREAKING: plain feature/)`, `assert.doesNotMatch(notes, /BREAKING: undo/)`, and section order `notes.indexOf("### Features") < notes.indexOf("### Bug Fixes") || notes.indexOf("### Bug Fixes") === -1` is not needed -- assert only `notes.indexOf("### Features") < notes.indexOf("### Reverts")`.

`styles/test/bump.test.mjs`, in the existing breaking-subject test (`:31-34`): add `assert.equal(next("0.2.3", "revert!: drop the legacy tokens"), "0.3.0");`.

Docs: `CONTEXT.md:61-66` gains one sentence after the bump description: "Release notes (`release-notes.sh`) group subjects by type -- feat, fix, revert, perf, refactor, chore, docs, style, test, build, ci -- and prefix a `type!:` subject with `BREAKING:`; a `BREAKING CHANGE:` footer drives the bump but is not visible to the subjects-only notes (#113)." `README.md:162-171`: the same fact in one clause after "commits, and tags".

`bash -n .github/scripts/release-lib.sh`; `shellcheck` if installed (say so if not -- it is not on the orchestrator's machine).

### 4. #114 -- `ci(release): gate the job on RELEASE_ENABLED and scope the bump guard to the release bot`

`.github/workflows/release.yml`:

- `:34-37` becomes:

```yaml
    if: >-
      ${{ vars.RELEASE_ENABLED == 'true' &&
      github.ref == 'refs/heads/main' &&
      (github.event_name == 'workflow_dispatch' ||
      !(startsWith(github.event.head_commit.message, 'chore(release): v') &&
        github.event.head_commit.author.name == 'github-actions[bot]')) }}
```

- `:23-33` comment: keep the branch reasoning; replace the "`secrets` context is NOT available" sentence's conclusion with: the inert gate is therefore a repository **variable**, `RELEASE_ENABLED`, which `vars` exposes to a job-level `if`, so a repo without it skips before any checkout; the secret check in the step remains for a variable-without-secret repo. Add: the bump guard names the bot identity configured below so a human commit that merely starts with `chore(release): v` is still released.
- `:70-74` run block: first line `set -u`; `if [[ -z "${GH_TOKEN:-}" ]]; then`; the echoed message stays byte-identical (README `:181` quotes it).
- `workflow_dispatch` carries no `head_commit`, so `startsWith(null, ...)` is false and the `!( ... )` clause is true, exactly as today -- say so in the comment.

`README.md:175-188`: the `release` bullet now says it needs **both** the `RELEASE_TOKEN` secret and a `RELEASE_ENABLED` repository variable set to `true`; without the variable the job is skipped before a runner is provisioned (previously every non-bump push checked out full history just to print Skipping); without the secret it no-ops as before. Keep the quoted message and the local-fallback sentences.

No unit test can exercise a workflow file; step 5 of Acceptance is the guard.

## Mutation guards (each must turn the suite red; paste one failing assertion per row)

| Change | Mutation | Failing test |
| --- | --- | --- |
| #112 `main` | delete the `main` line | `package.json: main and types mirror exports["."] ...` |
| #112 `types` | point `types` at `./dist/other.d.ts` | same test |
| #113 `revert` type | remove `revert` from `COMMIT_TYPES_ORDER` | the Reverts assertion (lands in Other Changes) |
| #113 marker | set `marker=""` unconditionally | the two `BREAKING:` assertions |
| #113 marker gating | set `marker="BREAKING: "` unconditionally | the two `doesNotMatch` assertions |
| #113 bump parity | in `next-version.sh:23`, change `!:` to `:` in `subject_re` | the new `revert!:` case and the existing `feat!:` cases in `bump.test.mjs` |
| #114 | not unit-testable | Acceptance 5 (a real run under the new gate) |

## Acceptance to execute and paste

1. `pnpm --filter @rackbops/ui-react test` green, the package-shape test name visible.
2. Consumer check for #112: `pnpm --filter @rackbops/ui-react build`, then `pnpm pack` in `components/react`; in a temp dir, `npm init -y`, install the tarball, write `tsconfig.json` with `{"compilerOptions":{"module":"commonjs","moduleResolution":"node10","strict":true,"noEmit":true,"jsx":"react-jsx","skipLibCheck":true}}` and `consumer.ts` = `import { Button } from "@rackbops/ui-react"; export const b = Button;` -- paste `npx tsc` **before** the package.json change (install the tarball built from `main`: expect TS2307) and **after** (clean); paste `node -e "console.log(require.resolve('@rackbops/ui-react'))"` printing the `dist/index.js` path.
3. `pnpm --filter @rackbops/styles test` green with the new release-notes test and the bump case visible; `bash -n .github/scripts/release-lib.sh` clean.
4. `gh variable list` showing `RELEASE_ENABLED  true` (orchestrator-set); paste.
5. **After merge, jointly with the orchestrator:** the PR's squash commit touches `components/react/package.json` (in PATHSPEC), so it triggers `release.yml` under the new gate. Paste `gh run list --workflow=release.yml --limit 3 --json conclusion,displayTitle`: the fix run **success** (reached the script, cut the next patch), the bump push **skipped**. Paste `gh release view <new tag> --json body -q .body` showing the grouped notes. Paste `npm view @rackbops/ui-react@<new version> main types` showing both fields on the registry.
6. The mutation table, one pasted failure per row.
7. `pnpm test` (root) and `pnpm build` green.

## Exit demo (PR A's share of the epic's exit criterion)

`@rackbops/ui-react` resolves under `moduleResolution: node10` from a real tarball; `revert!:` renders under Reverts with a BREAKING marker in a scratch-repo release; the first post-merge push to `main` produced a release run that was **not** skipped and a bot bump push that **was**, with no runner provisioned for the latter.

## Sub's operating rules

- Read #112, #113, #114 and #179 in full, including comments, before touching anything.
- Own worktree from `origin/main` (fetch first: `main` is at `be09088`, v0.2.30); never `git stash`; `git -C`, never `cd && git`; no force-push.
- Decision 5 above is absolute: the release scripts run only inside the test harness.
- Run the review gate yourself (two read-only adversarial agents, different lenses: correctness/failure modes on the bash regex change and the workflow expression vs. claims-vs-code walking the acceptance list and the README/CONTEXT sentences), up to four rounds, then report the round count and findings to the orchestrator rather than starting a fifth.
- Report deviations as they arise. Do not merge; Acceptance 5 happens after the orchestrator merges and is pasted by whoever runs it -- the orchestrator will ask you to.

# PR B

# E3 -- Toolchain and showcase hardening: implementation plan, PR B (#115 + #118)

Epic #179. PR B closes #115 (two `contract.test.mjs` guards that accept what they should reject) and #118 (the React class-derivation matrix's residual gap), entered via `/work-on 115`. Written by the orchestrator on 2026-09-11 against `origin/main` at `30d2869` (v0.2.31, PR A merged); line numbers are from that commit -- re-check with `grep -n` before editing. Append this plan as a `# PR B` section at the end of the already-committed `docs/plans/epics/E3-toolchain-and-showcase-hardening.md` in the first commit; do not rewrite the PR A section.

## Locked decisions

1. **#115 guard form, two tiers.** (Amended 2026-09-11 after Subordinate #2's pre-implementation scan: site `:290` iterates `themeCssFiles(theme)`, which is `tokens.css` + `base.css` + every component file, and those two root-scope files legitimately use forms the strict prefix rejects -- `:where([data-rb-style="<t>"])` in every `tokens.css` and `:where(html[data-rb-style="<t>"]) body` in every `base.css`, 14 each.) The invariant is: the theme attribute sits inside a **leading `:where(...)`**, never bare. One helper, `assertWhereGuarded(sel, theme, label, { rootScope })`:
   - **Component files (`rootScope: false`, the default):** the selector must *start with* the exact descendant form `:where([data-rb-style="<theme>"], [data-rb-style="<theme>"] *)`, the one string every component rule uses today. Sites `:427`, `:641`, `:668` are component-only and use this tier.
   - **Root-scope files (`rootScope: true`, applied at site `:290` when the file is `tokens.css` or `base.css`):** the selector must either satisfy the tier above or begin with a `:where(...)` group that contains `[data-rb-style="<theme>"]` -- which admits the two root forms and nothing bare.
   A bare-attribute guard (`[data-rb-style="x"] .rb-btn`, specificity 0,2,0) fails both tiers; `:where([data-rb-style="x"]) .rb-btn` fails the component tier (it never matches the canvas element itself and is not the repo's form). `stripGuard` (`:98-101`) stays as the helper the nesting check uses; its `^:where\([^)]*\)` regex is the same "leading `:where`" notion.
2. **#115 import order: a canonical order, not just a set.** Verified across all fourteen `index.css` today: three different orderings (arcane/kenzen pairs and the studio pair start with `button`; the three ports and the four originals start with `card link nav-rail button`; mono-field is alphabetical). Cross-file class references among component sheets (amended 2026-09-11 -- the orchestrator's first scan named only one): there are **four**, each a file referencing a block another file owns per `contract.json`'s `components` -- `nav-rail.css` -> `.rb-link` (owned by `link`), `table.css` -> `.rb-table` (owned by `data-table`, which lists `rb-table` and its `__group-row`/`__sort`/`__sort-icon`/`-scroll` elements; `table` owns only `rb-table--interactive`), `log.css` -> `.rb-pre` (owned by `pre`), `tabstrip.css` -> `.rb-tabs` (owned by `tabs`). Every one of the fourteen current orders already imports the owner before the referrer in all four cases, and the canonical order below does too (`link` < `nav-rail`, `data-table` < `table`, `pre` < `log`, `tabs` < `tabstrip`), so no relative order that could matter flips. Whether any of the four depends on cascade order *at all* is not decidable from source (equal `:where()` specificity plus overlapping targets is what would make it matter); that is exactly what the zero-diff `pnpm visual` run settles -- it is the proof, not a formality. `card.css`'s apparent `.rb-btn` hits were its own `.rb-card` selectors. The canonical order is: `../_shared/structure.css`, `./tokens.css`, `./base.css`, then the shared component files in **`contract.json`'s `components` key order**, then that theme's extras files in any order. To make "utilities last" true, `stepper` moves before `muted` in `contract.json` (a surgical cut-and-paste of its five-line block from after `log` to after `progress`); the SKILL.md table regenerates and STANDARD.md 5.1's `stepper.css` row (`:415`) moves above `muted.css` (`:412`) to match. Result: every theme's shared-component import order becomes `button card link nav-rail form badge alert dialog tabs tabstrip data-table table progress stepper muted pre log`.
3. **#118: a compiler-backed source scan, not a hand-maintained list.** A new test in `contract-classes.test.tsx` loads the package's real `tsconfig.json` through the TypeScript API (already a devDependency), walks every non-test source file, and collects (a) every string literal or no-substitution template matching `^rb-[\w-]+$`, and (b) for every template expression whose head matches `^rb-[\w-]+$` and whose single interpolated expression's *checked type* is a union of string literals, `head + literal` for each member. Every collected class must be in `EMITTED`. This is the issue's option 2, cheaper than it sounds because `checker.getTypeAtLocation` on the interpolated identifier returns the *narrowed* type -- `Button.tsx:30`'s `variant !== "default" && \`rb-btn--${variant}\`` yields `primary|accent|danger|ghost` (no phantom `rb-btn--default`), and `Stepper.tsx:53`'s local `state` yields its three literals with no prop involved. A template whose expression is not a literal union fails the test by name, so a future `rb-${anything}` cannot slip past as "unscannable".
4. **No theme CSS rule changes, no `contract.json` class changes, no visual change.** The only `styles/` edits are the fourteen `index.css` reorders and the `contract.json` key move. `pnpm visual` must be byte-clean.

## Build order (one commit per step, Conventional Commits)

### 1. Plan section -- `docs(plans): E3 PR B, contract-test guards and the class-derivation scan`

Append this document under `# PR B` at the end of `docs/plans/epics/E3-toolchain-and-showcase-hardening.md`.

### 2. #115 guard helper -- `test(styles): require the :where() zero-specificity guard form at every guard site`

In `styles/test/contract.test.mjs`, next to `stripGuard` (`:97-101`):

```js
/** The guard the contract allows: the theme attribute inside a LEADING
 * zero-specificity :where() (STANDARD.md 6). Component rules use the exact
 * descendant form (with the ` *` half so the guard scopes descendants without
 * adding specificity); the two root-scope files, tokens.css and base.css, may
 * also use the root forms `:where([data-rb-style="t"])` and
 * `:where(html[data-rb-style="t"]) body`, which scope the canvas element
 * itself. A bare attribute guard (`[data-rb-style="x"] .rb-btn`, specificity
 * 0,2,0) contains the same substring and used to pass -- #42's overflow,
 * fixed in #115. */
function whereGuardDescendant(theme) {
  return `:where([data-rb-style="${theme}"], [data-rb-style="${theme}"] *)`;
}
function assertWhereGuarded(sel, theme, label, { rootScope = false } = {}) {
  const descendant = sel.startsWith(whereGuardDescendant(theme));
  const leading = sel.match(/^:where\(([^)]*)\)/);
  const rootForm = rootScope && leading !== null && leading[1].includes(`[data-rb-style="${theme}"]`);
  assert.ok(
    descendant || rootForm,
    `${label}: selector is not guarded by the zero-specificity :where() form${rootScope ? "" : " (component files use the exact descendant form)"}: ${sel}`,
  );
}
```

Replace the four sites: `:290` -> `assertWhereGuarded(sel, theme, file, { rootScope: /(^|[\\/])(tokens|base)\.css$/.test(file) })` (the `rootScope` flag is keyed off the file, so a component file can never claim it); `:427` -> `assertWhereGuarded(sel, theme, \`${theme}: .${cls}\`)`; `:641` and `:668` likewise with their existing message prefixes. Delete each site's now-unused `guard` local **only if** nothing else in that test reads it (`:284`'s `guard` is also used by `:771`'s reduced-motion check -- grep before deleting). Run the suite: all fourteen themes must still pass with no CSS change, which itself proves every real selector already uses one of the admitted forms -- and paste, per theme, how many selectors took the root tier (expected: exactly the 2 root forms, 14 themes, plus base.css's own descendant-form rules on the strict tier).

Unit-level pins, in the same file, as one test `guard form: component tier accepts only the descendant :where() form; root tier also accepts the two root forms (#115)`: with `rootScope` off, `':where([data-rb-style="x"], [data-rb-style="x"] *).rb-btn'` passes and `'[data-rb-style="x"] .rb-btn'`, `':where([data-rb-style="x"]) .rb-btn'`, `':where([data-rb-style="x"])'` all throw; with `rootScope` on, `':where([data-rb-style="x"])'` and `':where(html[data-rb-style="x"]) body'` pass and `'[data-rb-style="x"] .rb-btn'` and `'html[data-rb-style="x"] body'` still throw.

### 3. #115 import order -- `test(styles): check index.css import order against the canonical sequence`

- `styles/contract.json`: move the `"stepper"` block from after `"log"` to immediately after `"progress"`. Surgical text edit; verify with `node -e "console.log(Object.keys(require('./styles/contract.json').components).join(' '))"` -> `... progress stepper muted pre log`.
- `node scripts/generate-skill-table.mjs` (rewrite), then `--check` clean. STANDARD.md 5.1: move the `stepper.css` row above `muted.css`.
- The fourteen `index.css`: reorder the `@import` lines to structure, tokens, base, the seventeen shared files in contract order, then extras. Extras files per theme (from today's listings): arcane pair and kenzen pair `eyebrow wordmark`; studio pair `eyebrow rack principle tag`; the other eight none. Keep each file's header comment; change nothing but line order.
- `contract.test.mjs:295-311`: keep the completeness assertion (`:310`) and add, before it, the order assertion: `imports[0]` includes `../_shared/structure.css`; `names[0] === "tokens"`, `names[1] === "base"`; `names.filter((n) => SHARED.has(n))` deep-equals `Object.keys(contract.components)` (where `SHARED = new Set(Object.keys(contract.components))` and names are `components/<x>` stripped to `<x>`). Extras (`names` not in `SHARED`) are unconstrained beyond appearing in the set check. Rename the test to `${theme}: index.css imports structure, tokens, base, then every shared component in contract order, then its extras`.
- Find the STANDARD.md sentence that describes what `index.css` imports (grep `index.css` in STANDARD.md; it is in section 6 or the 5.1 preamble) and state the canonical order there with a `[tested: contract.test.mjs, #115]` marker.
- `scripts/new-theme.mjs` copies `index.css` from the `--from` theme, so a new theme inherits the order; no change there. Run `node --test scripts/new-theme.test.mjs` to confirm.

### 4. #118 source scan -- `test(react): scan component sources for every rb-* literal and literal-union template, and require the matrix to emit them`

In `components/react/src/contract-classes.test.tsx`, after the `EMITTED` derivation (`:223-226`):

```tsx
import ts from "typescript";
import { basename, dirname, join } from "node:path";

// #118: close the matrix gap. Every rb-* class a component can emit is either a
// literal in its source or `rb-<block>--${x}` where x is a string-literal union;
// collect both from the real TypeScript program and require the matrix to have
// emitted each one. A class that exists only in source -- the #48 counterexample,
// `rb-btn--lg` behind a size the matrix never renders -- fails here, before it
// can reach a consumer unstyled.
function sourceClassSet(): Set<string> {
  const srcDir = dirname(fileURLToPath(import.meta.url));
  const configPath = join(srcDir, "..", "tsconfig.json");
  const cfg = ts.readConfigFile(configPath, ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, dirname(configPath));
  const sources = parsed.fileNames.filter(
    (f) => !/\.test\.tsx?$/.test(f) && basename(f) !== "test-dom.ts",
  );
  const program = ts.createProgram(sources, parsed.options);
  const checker = program.getTypeChecker();
  const out = new Set<string>();
  for (const sf of program.getSourceFiles()) {
    if (!sources.includes(sf.fileName)) continue;
    const visit = (node: ts.Node): void => {
      if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /^rb-[\w-]+$/.test(node.text)) {
        out.add(node.text);
      } else if (ts.isTemplateExpression(node) && /^rb-[\w-]+$/.test(node.head.text)) {
        assert.equal(node.templateSpans.length, 1, `${basename(sf.fileName)}: rb-* template with more than one interpolation`);
        const span = node.templateSpans[0];
        assert.equal(span.literal.text, "", `${basename(sf.fileName)}: rb-* template with a trailing literal`);
        const type = checker.getTypeAtLocation(span.expression);
        const members = type.isUnion() ? type.types : [type];
        assert.ok(
          members.length > 0 && members.every((m) => m.isStringLiteral()),
          `${basename(sf.fileName)}: ${node.head.text}\${...} interpolates ${checker.typeToString(type)}, not a string-literal union -- the scan cannot enumerate it`,
        );
        for (const m of members) if (m.isStringLiteral()) out.add(node.head.text + m.value);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  return out;
}

test("every rb-* class reachable from the component sources is emitted by the render matrix (#118)", () => {
  const unexercised = [...sourceClassSet()].filter((c) => !EMITTED.has(c)).sort();
  assert.deepEqual(unexercised, [], `in source but never rendered by RENDERS: ${unexercised.join(", ")} -- add the prop value to the matrix`);
});
```

Then rewrite the file header (`:21-27`) and STANDARD.md 5.2 (`:430-434`): the residual gap is closed by the scan; the closed-world check remains the downstream guard for CSS. Update the status row for #48 (`:958`) or add a row for #118 beside it. Expected on a clean tree: the test passes with no matrix change (every literal and union member today is already rendered -- if one is not, that is a finding: report it, then add the matrix entry).

Note `tsx` runs the test file; `import ts from "typescript"` is the CJS default import and works under it. The program load costs a couple of seconds; keep it inside the one test, not at module top level, so the other tests' timing is unchanged.

## Mutation guards (each must turn the suite red; paste one failing assertion per row)

| Change | Mutation | Failing test |
| --- | --- | --- |
| #115 guard form | in one theme's `button.css`, rewrite one selector to `[data-rb-style="<theme>"] .rb-btn--ghost` (no `:where`) | `<theme>: every selector is guarded ...` and `<theme>: ... .rb-btn--ghost` (site 2) |
| #115 guard form, pseudo-element site | same rewrite on a `::-webkit-progress-value` selector in `progress.css` | the progress-fill test (site 3) |
| #115 guard form, root tier | in one theme's `tokens.css`, change `:where([data-rb-style="<t>"])` to the bare `[data-rb-style="<t>"]` | that theme's `every selector is guarded ...` (root tier rejects a bare attribute) |
| #115 guard form, root tier is file-keyed | move a root-form selector `:where([data-rb-style="<t>"])` into that theme's `button.css` | same test (component files never get the root tier) |
| #115 order | swap `card` and `button` in one theme's `index.css` | that theme's `index.css imports ... in contract order` |
| #115 order, prefix | move `base` above `tokens` in one `index.css` | same test (`names[1] === "base"` clause) |
| #115 stepper key | put `stepper` back after `log` in `contract.json` | fourteen order failures **and** `generate-skill-table --check` |
| #118 static literal | in `Button.tsx`, widen `size` to `"sm" \| "md" \| "lg"` and add `size === "lg" && "rb-btn--lg"` | `every rb-* class reachable ... (#118)` names `rb-btn--lg` (the #48 counterexample, reproduced) |
| #118 union member | add `"outline"` to `ButtonProps.variant` with no `RENDERS` entry | same test names `rb-btn--outline` |
| #118 non-enumerable template | change `rb-stepper--${state}` to `rb-stepper--${String(state)}` | same test fails with the "not a string-literal union" message |

## Acceptance to execute and paste

1. `pnpm --filter @rackbops/styles test` green; paste the renamed order test for two themes (one from each old ordering family, e.g. `rackbops-studio` and `summer-cloud`) and the guard-form unit test.
2. `node -e "console.log(Object.keys(require('./styles/contract.json').components).join(' '))"` -> `... progress stepper muted pre log`; `node scripts/generate-skill-table.mjs --check` clean; paste the SKILL.md rows around `stepper`.
3. `git diff --stat main -- styles/*/index.css` shows exactly fourteen files; `git diff main -- styles/*/components styles/*/tokens.css styles/*/base.css` is **empty**.
4. `pnpm visual` green with **zero** baseline changes (no `[gen-baselines]` commit, no `update-visual-baselines` dispatch) -- paste the CI job link. A diff here is a finding (a cross-file cascade the analysis missed), not something to regenerate over.
5. `pnpm --filter @rackbops/ui-react test` green with the #118 test visible; paste its runtime.
6. `grep -n 'residual' components/react/src/contract-classes.test.tsx STANDARD.md` -> no remaining claim that the gap is open; paste the rewritten STANDARD.md 5.2 sentence.
7. The mutation table, one pasted failure per row.
8. `pnpm test` (root) and `pnpm build` green.

## Exit demo (PR B's share of the epic's exit criterion)

On `main`: a `[data-rb-style="x"] .rb-btn` descendant guard fails the contract test; an orphaned `rb-*` class fails the React derivation test; every theme's `index.css` imports in one order the test states.

## Sub's operating rules

- Read #115, #118 and #179 in full, including comments, before touching anything.
- Own worktree from `origin/main` (fetch first); never `git stash`; `git -C`, never `cd && git`; no force-push.
- Stop conditions -- message the orchestrator, do not resolve yourself: any theme's selector that is NOT already in the exact `:where(...)` form once the helper lands (means the analysis missed a form); any `pnpm visual` diff after the reorder; the #118 scan reporting a class on a clean tree; `typescript` failing to load the package tsconfig under `tsx`.
- Run the review gate yourself (two read-only adversarial agents, different lenses: correctness/failure modes on the AST scan and the guard regex vs. claims-vs-code walking the acceptance list and the STANDARD.md sentences), up to four rounds, then report the round count and findings rather than starting a fifth.
- Report deviations as they arise; do not merge.
