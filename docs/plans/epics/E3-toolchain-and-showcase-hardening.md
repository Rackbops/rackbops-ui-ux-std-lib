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

# E3 -- Toolchain and showcase hardening: implementation plan, PR C (#168 + #116 + #123)

Epic #179. PR C closes #168 (extras rendered outside the labelled extras section), #116 (the dev server sends no cache validators) and #123 (the visual job's parked pointer), entered via `/work-on 168`. Bundled so the visual baselines regenerate **once**. Written by the orchestrator on 2026-09-11 against `origin/main` at `032fd41` (v0.2.32); line numbers are from that commit -- re-check with `grep -n` before editing. Append this plan as a `# PR C` section at the end of the committed `docs/plans/epics/E3-toolchain-and-showcase-hardening.md` in the first commit.

## Locked decisions

1. **Two labelled extras sections, each titled by what it holds.** `contract.json` `extras` (`:113-128`) says who owns what: `rb-wordmark`/`rb-wordmark__spark` are extras of the arcane pair and the kenzen pair (four themes); `rb-eyebrow` of those four plus the studio pair (six); `rb-btn__arrow` and `rb-card__tag` of the studio pair only. So the "Wordmark / Eyebrow" section (`site/index.html:49-55`) is replaced by a section titled `Theme extras — wordmark / eyebrow (arcane + kenzen pairs; eyebrow also studio pair)`, and the arrow buttons (`:66`, `:76`) and tagged cards (`:101`, `:106`, `:111`) move into the existing studio section, retitled `Theme extras — rack / principles / tags / arrow / card tag (rackbops-studio pair)`. A section title is the tile's identity in the visual job (`scripts/visual.mjs:71-74` slugifies `.sc-title`), so both retitles produce new baseline files and orphan the old ones -- handled in step 4 and guarded by step 3's orphan check.
2. **The markup moves; it does not change.** The `h1.rb-wordmark` keeps its `__spark`, the eyebrow stays a `span`, the arrow buttons keep both sizes, one tagged `rb-card` (not three) demonstrates `rb-card__tag`. The Buttons and Cards sections lose only the extras-bearing elements. No CSS changes. ARIA on the page (#91) is untouched.
3. **A test makes "extras only in labelled sections" mechanical.** New `site/showcase-extras.test.mjs`: parse `site/index.html` into `<section>` blocks; for every class listed under any theme in `contract.json` `extras`, every occurrence of `class="... <cls> ..."` must fall inside a section whose `.sc-title` text starts with `Theme extras`. Registered in the root `package.json` `test` script (`:8`, which lists the root suites explicitly). STANDARD.md's "extras only in labelled sections" bullet and status row become `[tested]`.
4. **#116: strong ETag from `stat`, `Last-Modified`, `Cache-Control: no-cache`, conditional 304.** Validators are computed before the body is read; `If-None-Match` (a comma-separated list; match any) wins over `If-Modified-Since` (compare at one-second granularity, since the HTTP date has none). A 304 carries the same `etag`/`last-modified` headers and no body. The uniform-404 path is untouched. `no-cache` (revalidate every time) is the right policy for a dev server: the whole point is the 304, not a TTL.
5. **#123: two `page.mouse.move(0, 0)` calls plus an orphan-baseline check.** One after `page.goto` (`scripts/visual.mjs:64`), one after the dialog closes (`:119`). `(0, 0)` is the sticky header's top-left padding (`.sc-head` `:12-19`), where nothing is interactive. The orphan check: after `slugs` is computed (`:83`), every `*.png` under `site/__screenshots__/<theme>/` (ignoring `.actual.png`/`.diff.png`) must have a stem in `slugs`, in both compare and `--update` mode, else exit 1 naming the file -- `--update` writes captures but never deletes, so a renamed section otherwise leaves dead baselines forever (exactly what this PR would have created).

## Build order (one commit per step, Conventional Commits)

### 1. Plan section -- `docs(plans): E3 PR C, showcase extras, dev-server validators, visual pointer`

### 2. #116 -- `feat(site): send ETag and Last-Modified from the showcase dev server and answer conditional requests with 304`

`site/serve.mjs`: import `stat` alongside `readFile, realpath` (`:30`). Replace `:117-119` with:

```js
    const st = await stat(filePath);
    const etag = `"${st.size.toString(16)}-${Math.floor(st.mtimeMs).toString(16)}"`;
    const validators = {
      etag,
      "last-modified": st.mtime.toUTCString(),
      "cache-control": "no-cache",
    };
    if (isFresh(req.headers, etag, st.mtimeMs)) {
      res.writeHead(304, validators).end();
      return;
    }
    const body = await readFile(filePath);
    res.writeHead(200, { ...validators, "content-type": TYPES[extname(filePath)] ?? "application/octet-stream" });
    res.end(body);
```

and add, exported for the tests:

```js
/** Conditional-request freshness: If-None-Match (any listed tag matches the
 * current one) wins over If-Modified-Since (HTTP dates have one-second
 * granularity, so compare the mtime floored to seconds). (#116) */
export function isFresh(headers, etag, mtimeMs) {
  const inm = headers["if-none-match"];
  if (inm !== undefined) return inm.split(",").map((s) => s.trim()).includes(etag);
  const ims = headers["if-modified-since"];
  if (ims === undefined) return false;
  const since = Date.parse(ims);
  return !Number.isNaN(since) && Math.floor(mtimeMs / 1000) * 1000 <= since;
}
```

Update the header comment (`:1-28`) with one sentence on the validators (and that nginx's own conditional handling makes the hosted showcase behave the same way -- verify that claim against `nginx.conf` before writing it, or leave it out).

`site/serve.test.mjs`, using the existing listening fixture (`:148-155`, `baseUrl`), after the last GET test:

- `a 200 carries ETag, Last-Modified and Cache-Control: no-cache (#116)` -- `fetch(\`${baseUrl}/styles/manifest.json\`)`: status 200, `etag` matches `/^"[0-9a-f]+-[0-9a-f]+"$/`, `last-modified` parses, `cache-control` is `no-cache`.
- `If-None-Match with the current ETag answers 304 with no body` -- second fetch with `{ headers: { "if-none-match": etag } }`: status 304, `await res.text()` is `""`, the 304 carries the same `etag`.
- `If-None-Match with a stale tag answers 200 with the body` -- `"if-none-match": '"stale"'` -> 200 and a non-empty body.
- `If-Modified-Since equal to Last-Modified answers 304; an older date answers 200` -- two fetches.
- `isFresh: a comma-separated If-None-Match list matches any member` -- pure unit call.
- The existing 404 tests must pass unmodified (a 404 sends no validators).

### 3. #123 -- `ci(visual): park the pointer off every capture and fail on orphaned baselines`

`scripts/visual.mjs`: after `:64` add `await page.mouse.move(0, 0);` with a comment naming #123 and the `.sc-head` padding; after `:119` the same call. After the slug-collision check (`:83-88`), add:

```js
// A baseline with no section is dead weight `--update` can never remove (it
// only writes) -- a renamed section would leave the old tile green forever.
const orphans = [];
for (const theme of themes) {
  const dir = join(SHOTS, theme);
  if (!existsSync(dir)) continue;
  for (const f of await readdir(dir)) {
    if (!f.endsWith(".png") || f.endsWith(".actual.png") || f.endsWith(".diff.png")) continue;
    if (!slugs.includes(f.slice(0, -4))) orphans.push(join(theme, f));
  }
}
if (orphans.length) {
  console.error(`visual: ${orphans.length} orphaned baseline(s) with no matching section -- delete them:`);
  for (const o of orphans) console.error(`  ${o}`);
  process.exit(1);
}
```

(`readdir` joins the `node:fs/promises` import; `existsSync` is already imported.) Note the plan's guard for the pointer move itself is the regenerated baselines (non-manifesting today); the orphan check is the mutation-testable part of this step.

### 4. #168 -- `fix(site): render every theme extra only under a labelled extras section, and test it`

`site/index.html`:
- Delete the "Wordmark / Eyebrow" section (`:49-55`).
- Buttons: delete the two arrow buttons (`:66`, `:76`). Cards: delete the three `rb-card__tag` lines (`:101`, `:106`, `:111`); the three cards otherwise stay.
- Before the studio extras section (`:341`), insert:

```html
      <section>
        <h2 class="sc-title">Theme extras — wordmark / eyebrow (arcane + kenzen pairs; eyebrow also studio pair)</h2>
        <div class="stack">
          <h1 class="rb-wordmark"><span class="rb-wordmark__spark">&#9670;</span>rackbops console</h1>
          <span class="rb-eyebrow">Design standards</span>
        </div>
      </section>
```

- Retitle `:342` to `Theme extras — rack / principles / tags / arrow / card tag (rackbops-studio pair)` and append inside its `grid3`, after the `rb-tags` list: a `div.stack` holding `<button class="rb-btn rb-btn--primary">Next <span class="rb-btn__arrow">&rarr;</span></button>`, `<button class="rb-btn rb-btn--sm rb-btn--primary">Next <span class="rb-btn__arrow">&rarr;</span></button>`, and one `<div class="rb-card"><div class="rb-card__tag"><span>Design</span><span>01</span></div><h3>Product &amp; interface</h3><p>…</p></div>` (reuse the first card's copy).

New `site/showcase-extras.test.mjs` (`node:test`, no deps): read `site/index.html` and `styles/contract.json`; split the page on `<section>`/`</section>`; a section is "extras-labelled" when its `<h2 class="sc-title">` text starts with `Theme extras`; collect every class token from every `class="..."` attribute per section; assert that for every class in the union of `contract.extras[*]`, no non-extras section contains it. Second test: every extras class that the page renders at all is rendered in at least one extras section (so the demos are not simply deleted). Register it: root `package.json:8` `test` script gains `site/showcase-extras.test.mjs` after `site/serve.test.mjs`.

STANDARD.md (grep, do not trust these numbers): `:506-508` -- "though the showcase's Wordmark / Eyebrow section still renders it without an extras label" becomes "and shown in the showcase only under a labelled extras section (#168) `[tested: site/showcase-extras.test.mjs]`"; the section-13 bullet (`:793-798`) becomes "put theme extras only in sections labelled as extras (`site/index.html`'s two `Theme extras — …` sections), never in a generic section `[tested: site/showcase-extras.test.mjs, #168]`" with the "no tracking issue open" clause removed; the status row (`:986`) becomes `site/showcase-extras.test.mjs` / `live (#168)`. Also grep STANDARD.md and `site/` for the literal `341-342` and for "sole" beside "Theme extras" and fix each.

Baselines, in this same commit: delete the 28 files that will orphan -- `site/__screenshots__/<theme>/wordmark-eyebrow.png` and `site/__screenshots__/<theme>/theme-extras-rack-principles-tags-rackbops-studio.png` for all fourteen themes (`git rm`). Do not hand-edit any PNG.

### 5. Regenerate baselines -- bot commit `chore(visual): update showcase baselines`

`gh workflow run update-visual-baselines.yml --ref <branch>`; wait; `git pull`; paste `git show --stat HEAD -- site/__screenshots__`. **Expected, exactly:** 14 new `theme-extras-wordmark-eyebrow-arcane-kenzen-pairs-eyebrow-also-studio-pair.png` (confirm the slug from `visual.mjs`'s `slugify` before asserting the name), 14 new `theme-extras-rack-principles-tags-arrow-card-tag-rackbops-studio-pair.png`, 14 modified `buttons.png`, 14 modified `cards.png`, nothing else. Any other modified tile means the pointer move de-hovered something that was baked into a baseline -- that is #123 manifesting, a finding to report with the tile name (and the image diff), not to hide. The orchestrator reviews the image diff.

## Mutation guards (each must turn the suite or the job red; paste one failing assertion per row)

| Change | Mutation | Failing check |
| --- | --- | --- |
| #116 304 path | delete the `if (isFresh(...))` block | `If-None-Match with the current ETag answers 304 ...` |
| #116 ETag | compute the etag from `st.size` only | the 304 test still passes -- so instead mutate `isFresh` to `return inm !== undefined` and the stale-tag test fails |
| #116 If-Modified-Since | drop the `ims` branch | the If-Modified-Since test |
| #123 orphan check | leave one `wordmark-eyebrow.png` in place | `pnpm visual` exits 1 naming it (run locally in the Playwright container is not required for this: the orphan scan runs before any capture, so `node scripts/visual.mjs` reaches it even where Chromium is absent -- verify, and if the browser launch precedes the scan, reorder so the scan runs first) |
| #168 placement | move the eyebrow `span` back into the Buttons section | `showcase-extras.test.mjs` names `rb-eyebrow` in section "Buttons" |
| #168 presence | delete the wordmark `h1` entirely | the second test (rendered nowhere) |
| #168 registration | remove the file from the root `test` script | `pnpm test` no longer runs it -- paste the root test line before and after to show it is registered |

## Acceptance to execute and paste

1. `grep -n 'rb-wordmark\|rb-eyebrow\|rb-btn__arrow\|rb-card__tag' site/index.html` -- every hit's line is inside one of the two extras sections (paste with the two section heading lines for reference).
2. `node --test site/showcase-extras.test.mjs` and `node --test site/serve.test.mjs` green, new test names visible; `pnpm test` (root) green.
3. The three STANDARD.md sentences after the edit, pasted, plus `grep -n '341-342\|no tracking issue' STANDARD.md` -> nothing.
4. Manual 304: `pnpm showcase` in one shell; `curl -sI http://localhost:5177/styles/manifest.json` (paste `ETag`), then `curl -sI -H 'If-None-Match: <that etag>' ...` -> `HTTP/1.1 304`; paste both.
5. `git show --stat HEAD -- site/__screenshots__` for the bot commit matching the expected set above; the `visual` CI job green on the branch.
6. The mutation table, one pasted failure per row.
7. `pnpm build` green.

## Exit demo (PR C's share of the epic's exit criterion)

On `main`: the showcase renders its extras only under the two `Theme extras` headings and a test says so; the dev server answers a conditional request with 304; the visual job fails on an orphaned baseline and captures every tile with the pointer parked.

## Sub's operating rules

- Read #168, #116, #123 and #179 in full, including comments, before touching anything. #91 (showcase ARIA) is closed history: read it only to confirm nothing you move carries ARIA you would drop.
- Own worktree from `origin/main`; never `git stash`; `git -C`, never `cd && git`; no force-push.
- Stop conditions -- message the orchestrator: a baseline diff outside the expected set; the orphan scan not reachable without a browser; any `nginx.conf` claim you cannot verify (leave it out instead).
- Review gate as before (two read-only adversarial agents: correctness on the conditional-request logic and the visual script vs. claims-vs-code on the acceptance and STANDARD.md sentences), up to four rounds; report round count and findings; do not merge.

# E3 -- Toolchain and showcase hardening: implementation plan, #186 (snap section captures to integer offsets)

Epic #179. #186 is its own PR, entered via `/work-on 186`. Written by the orchestrator on 2026-09-11 against `origin/main` at `fce6eaf` (PR C merged); line numbers are from that commit -- re-check with `grep -n`. Append this plan as a `# #186` section at the end of the committed `docs/plans/epics/E3-toolchain-and-showcase-hardening.md` in the first commit.

## Locked decisions

1. **Mechanism: per theme, after fonts settle, walk `main > section` in document order and give each section an inline `margin-top` equal to the fractional remainder that brings its document top to an integer.** Sections stack as blocks with no margin rule of their own in the showcase chrome (`site/index.html`'s `<style>`: `section { padding: 1.75rem 0; border-top: ... }`), so a sub-pixel margin is invisible and outside every tile (a `locator.screenshot()` captures the border box, never the margin). Chromium lays out in 1/64 px units, so `1 - frac` (with `frac` read from `getBoundingClientRect().top + scrollY`) lands the next top on an integer; the script **verifies** that after snapping and exits 1 if any section top is still fractional, so a layout-engine surprise cannot pass silently.
2. **Reset before re-measure.** The margins are cleared at the start of every theme's pass (each theme has different heights), then re-derived. Measurement happens at `scrollY` whatever it is -- the document offset is `rect.top + window.scrollY`, so scroll position is irrelevant.
3. **One final baseline regeneration is expected to touch most tiles**, because the snap itself is a phase change for every section that sat at a fractional offset. That is the last time a layout change above a section perturbs the tiles below it; the mutation guard proves it. The regen is reviewed by mechanism (the integer-top probe and the guard), not tile by tile; the PR C shift-residual script may be run on three tiles as a spot check but is not required.
4. **Local `pnpm visual` is valid for the mutation guard even on Windows**, because the guard compares two local runs against each other (with and without the spacer), never against the committed baselines.

## Build order (one commit per step, Conventional Commits)

### 1. Plan section -- `docs(plans): E3 #186, snap section captures to integer offsets`

### 2. The snap -- `ci(visual): snap every section to an integer document offset before capture (#186)`

`scripts/visual.mjs`, inside the per-theme loop, after `await page.evaluate(() => document.fonts.ready);` (`:126` at HEAD; the line after the stylesheet wait) and before `for (const [i, title] of sections)`:

```js
  // #186: a tile's antialiasing and clip rounding depend on the sub-pixel phase
  // of its section's document offset, so any height change ABOVE a section used
  // to re-render every tile below it (PR C: 128 of 156 changed tiles were phase
  // noise). Give each section an inline margin-top that lifts its top to an
  // integer, in document order so each snap accounts for the previous one; the
  // margin sits outside the border box a screenshot captures, so tiles do not
  // change. Cleared first: every theme has different heights.
  const fractional = await page.evaluate(() => {
    const sections = [...document.querySelectorAll("main > section")];
    for (const s of sections) s.style.marginTop = "";
    for (const s of sections) {
      const top = s.getBoundingClientRect().top + window.scrollY;
      const frac = top - Math.floor(top);
      if (frac > 0) s.style.marginTop = `${1 - frac}px`;
    }
    return sections
      .map((s) => s.getBoundingClientRect().top + window.scrollY)
      .filter((t) => Math.abs(t - Math.round(t)) > 1e-6);
  });
  if (fractional.length) {
    console.error(`visual: ${theme}: ${fractional.length} section(s) still at a fractional offset after snapping: ${fractional.join(", ")}`);
    process.exit(1);
  }
```

Also update the header comment (`:1-27`) with one sentence on the snap, and STANDARD.md's section-13 `pnpm visual` bullet (`grep -n 'be photographed' STANDARD.md`) with: "sections are snapped to integer document offsets before capture, so a tile depends only on its own content (#186)".

### 3. Mutation guard, executed locally and pasted -- part of the PR body, no commit

Two self-consistent local pairs (each pair generated in the same environment, so Windows-vs-CI rendering differences cancel):

```
# A. with the snap (this branch)
pnpm visual --update                    # local set A over the committed files
<insert a spacer: in site/index.html, before the Alerts <section>, add <div style="height:0.5px"></div>>
pnpm visual                             # expect: "visual: N tiles match their baselines" -- zero regressed
git checkout -- site/index.html site/__screenshots__

# B. without the snap (temporarily stash-free: comment out the snap block, or `git stash` is forbidden -- edit and revert)
<comment out the #186 block>
pnpm visual --update                    # local set B
<insert the same spacer>
pnpm visual                             # expect: many tiles below Alerts regressed
git checkout -- scripts/visual.mjs site/index.html site/__screenshots__
```

Paste both `pnpm visual` compare outputs (the first must be green with zero regressed; the second must list regressed tiles below Alerts). Confirm `git status --short` is empty afterwards.

### 4. Baseline regeneration -- bot commit `chore(visual): update showcase baselines`

`gh workflow run update-visual-baselines.yml --ref <branch>`; wait; pull; paste `git show --stat HEAD -- site/__screenshots__`. Expected: many or all tiles change (each theme's sections were at fractional offsets). Paste the integer-top probe from a CI-equivalent run if available; otherwise the script's own exit-1 check is the guard (it ran green in the bot's `--update` pass, which would have exited 1 otherwise -- cite the workflow run log line). Optional spot check: the PR C shift-residual script on three tiles, showing phase-only differences.

## Mutation guards (paste one failing output per row)

| Change | Mutation | Failing check |
| --- | --- | --- |
| the snap | comment out the block, spacer above Alerts | step 3 pair B: tiles below Alerts regress (pair A: none) |
| the verification | change the `1e-6` tolerance to `1` (accept anything) and force a fractional top by setting one section's `marginTop` to `0.25px` after snapping (temporary edit) | the script must exit 1 naming the section; with the tolerance loosened it does not -- paste both |

## Acceptance to execute and paste

1. Step 3's two pasted `pnpm visual` outputs (pair A green, pair B regressed) and the clean `git status --short`.
2. The `update-visual-baselines` bot commit's stat, and CI's `visual` job green on the branch afterwards.
3. `grep -n '#186' scripts/visual.mjs STANDARD.md` showing the comment and the section-13 clause.
4. `pnpm test` (root) green (the script has no unit tests; nothing else changes).

## Exit demo

On `main`: inserting a 0.5px spacer above any section and running `pnpm visual` against fresh local baselines changes zero tiles; `scripts/visual.mjs` refuses to capture if any section top is fractional.

## Sub's operating rules

- Read #186 and #179 in full before touching anything; the diagnosis on PR #187's body is the background.
- Own worktree from `origin/main` (fetch first); never `git stash` (step 3 says edit-and-revert instead); `git -C`, never `cd && git`; no force-push.
- Stop conditions -- message the orchestrator: the post-snap probe finding a fractional top (the 1/64 assumption failed); pair A of the guard regressing any tile; the bot regen leaving any theme's tiles unchanged when its sections were at fractional offsets (means the snap did not run in CI).
- Review gate as before (two read-only adversarial agents: correctness on the evaluate block and its verification vs. claims-vs-code on the pasted pairs), up to four rounds; report round count and findings; do not merge.

# E3 -- Toolchain and showcase hardening: implementation plan, PR B (#115 + #118)

Epic #179. PR B closes #115 (two `contract.test.mjs` guards that accept what they should reject) and #118 (the React class-derivation matrix's residual gap), entered via `/work-on 115`. Written by the orchestrator on 2026-09-11 against `origin/main` at `30d2869` (v0.2.31, PR A merged); line numbers are from that commit -- re-check with `grep -n` before editing. Append this plan as a `# PR B` section at the end of the already-committed `docs/plans/epics/E3-toolchain-and-showcase-hardening.md` in the first commit; do not rewrite the PR A section.

## Locked decisions

1. **#115 guard form, two tiers.** (Amended 2026-09-11 after Subordinate #2's pre-implementation scan: site `:290` iterates `themeCssFiles(theme)`, which is `tokens.css` + `base.css` + every component file, and those two root-scope files legitimately use forms the strict prefix rejects -- `:where([data-rb-style="<t>"])` in every `tokens.css` and `:where(html[data-rb-style="<t>"]) body` in every `base.css`, 14 each.) The invariant is: the theme attribute sits inside a **leading `:where(...)`**, never bare. One helper, `assertWhereGuarded(sel, theme, label, { rootScope })`:
   - **Component files (`rootScope: false`, the default):** the selector must *start with* the exact descendant form `:where([data-rb-style="<theme>"], [data-rb-style="<theme>"] *)`, the one string every component rule uses today. Sites `:427`, `:641`, `:668` are component-only and use this tier.
   - **Root-scope files (`rootScope: true`, applied at site `:290` when the file is `tokens.css` or `base.css`):** the selector must either satisfy the tier above or begin with a `:where(...)` group that contains `[data-rb-style="<theme>"]` -- which admits the two root forms and nothing bare.
   A bare-attribute guard (`[data-rb-style="x"] .rb-btn`, specificity 0,2,0) fails both tiers; `:where([data-rb-style="x"]) .rb-btn` fails the component tier (it never matches the canvas element itself and is not the repo's form). `stripGuard` (`:98-101`) stays as the helper the nesting check uses; its `^:where\([^)]*\)` regex is the same "leading `:where`" notion.
2. **#115 import order: a canonical order, not just a set.** Verified across all fourteen `index.css` today: three different orderings (arcane/kenzen pairs and the studio pair start with `button`; the three ports and the four originals start with `card link nav-rail button`; mono-field is alphabetical). Cross-file class references among component sheets (amended 2026-09-11 -- the orchestrator's first scan named only one): there are **four**, each a file referencing a block another file owns per `contract.json`'s `components` -- `nav-rail.css` -> `.rb-link` (owned by `link`), `table.css` -> `.rb-table` (owned by `data-table`, which lists `rb-table` and its `__group-row`/`__sort`/`__sort-icon`/`-scroll` elements; `table` owns only `rb-table--interactive`), `log.css` -> `.rb-pre` (owned by `pre`), `tabstrip.css` -> `.rb-tabs` (owned by `tabs`). Every one of the fourteen current orders already imports the owner before the referrer in all four cases, and the canonical order below does too (`link` < `nav-rail`, `data-table` < `table`, `pre` < `log`, `tabs` < `tabstrip`), so no relative order that could matter flips. Whether any of the four depends on cascade order *at all* is not decidable from source (equal `:where()` specificity plus overlapping targets is what would make it matter); that is exactly what the zero-diff `pnpm visual` run settles -- it is the proof, not a formality. `card.css`'s apparent `.rb-btn` hits were its own `.rb-card` selectors. The canonical order is: `../_shared/structure.css`, `./tokens.css`, `./base.css`, then the shared component files in **`contract.json`'s `components` key order**, then that theme's extras files in any order. To make "utilities last" true, `stepper` moves before `muted` in `contract.json` (a surgical cut-and-paste of its five-line block from after `log` to after `progress`); the SKILL.md table regenerates and STANDARD.md 5.1's `stepper.css` row (`:415`) moves above `muted.css` (`:412`) to match. Result: every theme's shared-component import order becomes `button card link nav-rail form badge alert dialog tabs tabstrip data-table table progress stepper muted pre log`.
3. **#118: a source-literal scan plus type-level exhaustiveness -- no compiler API.** (Amended 2026-09-11 after Subordinate #2 hit the plan's own stop condition: `typescript@7.0.2`, which the lockfile pins and CI installs, no longer ships the classic compiler API -- `import ts from "typescript"` resolves to a version stub, and the monolithic `lib/typescript.js` is gone; the real API lives only under `unstable/*` subpaths with a different, class-based shape. Building the guard on an unstable API, or pinning a second TypeScript just for one test, are both worse than the design below, which needs neither.) Two mechanisms, both in `contract-classes.test.tsx`:
   - **(a) Static literals, by regex.** Every complete `rb-*` string or template literal in the non-test sources (`"rb-…"`, `'rb-…'`, `` `rb-…` `` with no `${`) must be in `EMITTED`. This catches the confirmed #48 counterexample (`rb-btn--lg` behind a `size` value the matrix never renders) and any forgotten static class. Alongside it, the set of **dynamic templates** in the sources (`` `rb-<prefix>${<expr>}` ``) must deep-equal a registry in the test -- today `rb-btn--`/`variant`, `rb-badge--`/`variant`, `rb-alert--`/`variant`, `rb-stepper--`/`state` -- so a new dynamic template fails the test until it is registered *with* a mechanism from (b).
   - **(b) Exported unions, by the type checker `tsc --noEmit` already runs** (the package's `test` script compiles the test files first, so a type error IS a test failure). For each registered template whose expression is an exported prop union, the matrix's value list is declared `as const satisfies readonly <Union>[]` **and** an `Exclude<<Union>, (typeof LIST)[number]>` is asserted `never` -- so widening `ButtonProps["variant"]` with `"outline"` fails compilation until `"outline"` is added to the list, and adding it makes the matrix render it, at which point the existing reconciliation test rejects `rb-btn--outline` as emitted-but-not-in-contract. `SemanticVariant` (Badge, Alert) gets the same treatment. `Stepper`'s `state` is a local, non-exported union derived from index arithmetic (`Stepper.tsx:53`) -- the one residual the type route cannot reach; the test pins that the Stepper matrix entry renders all three states (`0 < current < steps.length - 1`) and STANDARD.md names this residual honestly instead of over-claiming.
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

### 4. #118 -- `test(react): close the matrix gap with a source-literal scan and type-level exhaustiveness for class-bearing prop unions`

(Amended 2026-09-11; the original compiler-API version is unimplementable on `typescript@7.0.2`, see decision 3.) In `components/react/src/contract-classes.test.tsx`:

**(a) The matrix's value lists become typed and exhaustive.** Replace the four hard-coded Button variant entries (`:69-72`) and the `SEMANTIC` constant (`:64`) with:

```tsx
import type { ButtonProps, SemanticVariant } from "./index.js";

/** Compile-time exhaustiveness: `Missing` must be `never`, i.e. every member of the
 * union appears in the list. Widening the union without extending the list fails
 * `tsc --noEmit`, which the package test script runs before any test (#118). */
type AssertNever<T extends never> = T;

type ButtonVariant = Exclude<NonNullable<ButtonProps["variant"]>, "default">;
const BUTTON_VARIANTS = ["primary", "accent", "danger", "ghost"] as const satisfies readonly ButtonVariant[];
type _ButtonVariantsExhaustive = AssertNever<Exclude<ButtonVariant, (typeof BUTTON_VARIANTS)[number]>>;

const SEMANTIC = ["info", "success", "warning", "danger"] as const satisfies readonly SemanticVariant[];
type _SemanticExhaustive = AssertNever<Exclude<SemanticVariant, (typeof SEMANTIC)[number]>>;
```

and `...BUTTON_VARIANTS.map((v) => ({ component: "Button", el: <UI.Button variant={v}>Go</UI.Button> }))` in `RENDERS`. (If the `satisfies`/`AssertNever` pair needs a different spelling under TS 7's checker, keep the *property* -- a widened union must fail compilation -- and say what changed.)

**(b) The source scan, plain `node:fs` + regex, after the `EMITTED` derivation (`:223-226`):**

```tsx
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

// #118: every static rb-* class in the component sources must be exercised by the
// matrix (the #48 counterexample -- `rb-btn--lg` behind a size value RENDERS never
// renders -- fails here), and every dynamic `rb-…${x}` template must be registered
// with the mechanism that keeps its union exhaustive (see the typed lists above).
const SRC = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILES = readdirSync(SRC).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) && f !== "test-dom.ts");
const DYNAMIC_TEMPLATES: Record<string, string> = {
  "rb-btn--": "variant",     // Button: exported union, exhaustive via BUTTON_VARIANTS
  "rb-badge--": "variant",   // Badge: SemanticVariant, exhaustive via SEMANTIC
  "rb-alert--": "variant",   // Alert: same
  "rb-stepper--": "state",   // Stepper: local union derived from index arithmetic -- the residual; all three states rendered, asserted below
};

function scanSources() {
  const literals = new Set<string>();
  const templates: Record<string, string> = {};
  for (const f of SOURCE_FILES) {
    const src = readFileSync(join(SRC, f), "utf-8");
    for (const m of src.matchAll(/(["'`])(rb-[\w-]+)\1/g)) literals.add(m[2]);
    for (const m of src.matchAll(/`(rb-[\w-]+)\$\{([^}]+)\}`/g)) templates[m[1]] = m[2].trim();
  }
  return { literals, templates };
}

test("every static rb-* class literal in the component sources is emitted by the render matrix (#118)", () => {
  const { literals } = scanSources();
  const unexercised = [...literals].filter((c) => !EMITTED.has(c)).sort();
  assert.deepEqual(unexercised, [], `in source but never rendered by RENDERS: ${unexercised.join(", ")} -- add the prop value to the matrix`);
});

test("every dynamic rb-* template in the sources is registered with an exhaustiveness mechanism (#118)", () => {
  const { templates } = scanSources();
  assert.deepEqual(templates, DYNAMIC_TEMPLATES, "a new `rb-…${x}` template must be registered here together with a typed, exhaustive value list for its union");
});

test("the Stepper matrix entry renders all three derived states (#118 residual)", () => {
  for (const s of ["complete", "current", "upcoming"]) assert.ok(EMITTED.has(`rb-stepper--${s}`), `rb-stepper--${s} not emitted`);
});
```

Check the regexes against the real sources before trusting them: `Button.tsx:30` is `` `rb-btn--${variant}` `` (registered), `:31` `"rb-btn--sm"` (literal), `feedback.tsx:36/:62`, `Stepper.tsx:57`; `DataTable.tsx:153/:164/:205`, `Dialog.tsx:64-72`, `Tabs.tsx:72`, `Tabstrip.tsx:87/:91`, `NavLink.tsx:19`, `Card.tsx:21` are all literals. Expected on a clean tree: both scans pass with no matrix change; if a literal is unexercised, that is a finding -- report it, then add the matrix entry.

Then rewrite the file header (`:21-27`) and STANDARD.md 5.2 (`:430-434`): the matrix gap is closed for static literals (scan) and for exported class-bearing unions (compile-time exhaustiveness); the one residual is a template over a local, non-exported union (today only `Stepper`'s three derived states, all rendered) -- named, not hidden. Update the status row for #48 (`:958`) or add a row for #118 beside it.

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
| #118 static literal | in `Button.tsx`, widen `size` to `"sm" \| "md" \| "lg"` and add `size === "lg" && "rb-btn--lg"` | `every static rb-* class literal ... (#118)` names `rb-btn--lg` (the #48 counterexample, reproduced) |
| #118 widened union | add `"outline"` to `ButtonProps.variant` and change nothing else | `pnpm --filter @rackbops/ui-react test` fails at `tsc --noEmit` on `_ButtonVariantsExhaustive` (paste the TS error) |
| #118 widened union, list extended | additionally add `"outline"` to `BUTTON_VARIANTS` | the matrix now renders it and the existing `React emits no rb-* class outside contract.json's React-backed set` names `rb-btn--outline` |
| #118 new dynamic template | in `Card.tsx`, add `` tone && `rb-card--${tone}` `` with a `tone?: "a" \| "b"` prop | `every dynamic rb-* template ... is registered` (deepEqual shows the unregistered `rb-card--`) |
| #118 residual pinned | change the Stepper matrix entry to `current={0}` | `the Stepper matrix entry renders all three derived states` (`rb-stepper--complete` missing) |

## Acceptance to execute and paste

1. `pnpm --filter @rackbops/styles test` green; paste the renamed order test for two themes (one from each old ordering family, e.g. `rackbops-studio` and `summer-cloud`) and the guard-form unit test.
2. `node -e "console.log(Object.keys(require('./styles/contract.json').components).join(' '))"` -> `... progress stepper muted pre log`; `node scripts/generate-skill-table.mjs --check` clean; paste the SKILL.md rows around `stepper`.
3. `git diff --stat main -- styles/*/index.css` shows exactly fourteen files; `git diff main -- styles/*/components styles/*/tokens.css styles/*/base.css` is **empty**.
4. `pnpm visual` green with **zero** baseline changes (no `[gen-baselines]` commit, no `update-visual-baselines` dispatch) -- paste the CI job link. A diff here is a finding (a cross-file cascade the analysis missed), not something to regenerate over.
5. `pnpm --filter @rackbops/ui-react test` green with the three #118 tests visible; paste `grep -n 'satisfies readonly\|AssertNever' components/react/src/contract-classes.test.tsx` to show the typed lists are in place.
6. `grep -n 'residual' components/react/src/contract-classes.test.tsx STANDARD.md` -> no remaining claim that the gap is open; paste the rewritten STANDARD.md 5.2 sentence.
7. The mutation table, one pasted failure per row.
8. `pnpm test` (root) and `pnpm build` green.

## Exit demo (PR B's share of the epic's exit criterion)

On `main`: a `[data-rb-style="x"] .rb-btn` descendant guard fails the contract test; an orphaned `rb-*` class fails the React derivation test; every theme's `index.css` imports in one order the test states.

## Sub's operating rules

- Read #115, #118 and #179 in full, including comments, before touching anything.
- Own worktree from `origin/main` (fetch first); never `git stash`; `git -C`, never `cd && git`; no force-push.
- Stop conditions -- message the orchestrator, do not resolve yourself: any theme's selector that is NOT already in the exact `:where(...)` form once the helper lands (means the analysis missed a form); any `pnpm visual` diff after the reorder; the #118 scan reporting a class on a clean tree; the `satisfies` + `AssertNever` pair not producing a compile error when a union is widened (then the exhaustiveness property is unmet -- stop, do not ship a guard that cannot fail). (The original "typescript failing to load under tsx" condition was hit on 2026-09-11 and resolved by redesigning step 4 to need no compiler API.) `pnpm visual` run locally on Windows is NOT valid evidence for acceptance bullet 4 (a clean `origin/main` also shows every tile regressed there -- different rendering environment); the branch's CI `visual` job is the proof, as the bullet already says.
- Run the review gate yourself (two read-only adversarial agents, different lenses: correctness/failure modes on the AST scan and the guard regex vs. claims-vs-code walking the acceptance list and the STANDARD.md sentences), up to four rounds, then report the round count and findings rather than starting a fifth.
- Report deviations as they arise; do not merge.
# E3 -- #190, phase 2: the fix

Follows phase 1 (comment on #190, 2026-09-11): the compositor's `backdrop-filter` path is chosen per Chromium session, so glass-card tiles on luminous-precision and summer-cloud render in one of two stable ways; with `backdrop-filter: none` injected, ten of ten no-edit control pairs are pixel-clean. Written 2026-09-11 against `origin/main` at `9642b63`. Entered via `/work-on 190`; one PR; plan section appended as `# #190` at the end of `docs/plans/epics/E3-toolchain-and-showcase-hardening.md` (merge `origin/main` into the branch if PR B's or PR D's section landed meanwhile; landing order, yours last).

## Locked decisions

1. **Preferred fix: pin the rendering path, keep the glass.** The baselines are the showcase's visual acceptance test; a job that photographs the three glass themes without their signature effect would stop testing the thing that makes them those themes. So the first attempt is a `chromium.launch({ args })` flag set that makes the compositor's choice deterministic while `backdrop-filter` still renders. Bounded experiment, in this order, ten no-edit control pairs each, **stop at the first set that is 10/10 clean**:
   - A: `["--disable-gpu-compositing"]`
   - B: `["--disable-gpu"]`
   - C: `["--use-gl=angle", "--use-angle=swiftshader"]`
   - D: `["--disable-features=CanvasOopRasterization,UseSkiaRenderer"]` (last resort; feature names must be checked against the pinned Chromium's `chrome://flags`-equivalent -- if a name is unknown, Chromium ignores it silently, so also confirm via `chrome://version` that the switch was applied)
   For the winning set, prove the glass is still rendered: capture luminous-precision Cards once with the flags and once with the flags plus the `backdrop-filter: none !important` style tag; the two must differ (pixelmatch count > 0) -- that is the "kept the glass" proof, without which a flag that merely disabled the filter would look like a win.
2. **Fallback, only if A-D all fail: the override, documented as a limitation.** `page.addStyleTag({ content: "* { backdrop-filter: none !important; }" })` right after the transitions-off tag in `scripts/visual.mjs`, with a header comment naming #190, and a sentence in STANDARD.md section 13's "be photographed" bullet: the visual job captures the three glass themes with `backdrop-filter` disabled because Chromium renders it nondeterministically across sessions (#190); the filter's own rendering is reviewed by eye, not by baseline.
3. **One baseline regeneration either way,** reviewed by mechanism: with a flag set, every tile may change (a different raster path); with the override, only the glass themes' glass tiles change. The stat is pasted and explained by which path was taken. After it, the ten-pair control must be clean on the branch.
4. **The `rackbops-noir/badges` single anomaly is out of scope** here (phase 1 could not reproduce it in a within-session or a one-pair between-session check); if it recurs after this lands, it becomes its own issue. Say so in the PR body.

## Build order

### 1. Plan section -- `docs(plans): E3 #190 phase 2, pin the compositor path`

### 2. The experiment (no commit; results pasted in the PR body and on #190)

For each candidate set in order: edit `chromium.launch()` in `scripts/visual.mjs` (`grep -n 'chromium.launch'`) to pass `{ args }`, run ten no-edit pairs (`pnpm visual --update` then `pnpm visual`, separate processes), record clean/regressed per pair with the tile names and pixel counts. Stop at 10/10 clean. Then the "glass kept" check from decision 1. If every set fails or none keeps the glass, go to the fallback. Paste the full table of what was tried.

### 3. The fix -- `ci(visual): pin Chromium's compositor path so glass tiles render deterministically (#190)` (or `... capture glass themes without backdrop-filter ...` for the fallback)

`scripts/visual.mjs`: the winning `args` (or the override style tag), with a header-comment paragraph: the symptom, the mechanism from phase 1, what was tried (one line per candidate with its pair score), and why this one. STANDARD.md section 13: one clause naming the pin (or the limitation). `scripts/reduced-motion.mjs` (PR D, if merged by then) reads computed styles only and needs no change -- say so.

### 4. Baseline regeneration -- bot commit, then the ten-pair control on the branch, pasted clean

## Mutation guards (paste one output per row)

| Change | Mutation | Failing check |
| --- | --- | --- |
| the pin / override | remove it | the no-edit control regresses a glass tile within five pairs (state the attempt count; environment-dependent) |
| glass kept (flag path only) | none needed -- it is an acceptance item, paste the non-zero pixelmatch count |

## Acceptance to execute and paste

1. The experiment table (candidates, pairs, tiles, counts) and the decision.
2. Ten no-edit control pairs on the final branch: all clean, all fourteen themes.
3. Flag path: the "glass kept" pixelmatch count for luminous-precision Cards (> 0). Fallback path: the STANDARD.md limitation sentence.
4. The bot regen stat, explained by path; CI `visual` green on the branch afterwards.
5. `pnpm test` (root) green.

## Sub's operating rules

- Own worktree from `origin/main`; never `git stash`; `git -C`, never `cd && git`; no force-push; the experiment's edits are reverted between candidates (`git checkout -- scripts/visual.mjs`).
- Ten-pair loops are long: run them in the background, check in, report a decisive candidate as soon as it lands.
- Stop conditions -- message the orchestrator: a candidate that is clean but whose `chrome://version` shows the switch was not applied; a winning set that changes the rendering of NON-glass themes' tiles in the regen by more than phase-shift-scale noise (that is a fidelity question); the fallback being needed (report before committing it).
- Review gate as before, up to four rounds; report; do not merge.

# #192

# Visual job: pin Chromium's compositor path so glass tiles can be photographed deterministically (restore backdrop-filter to the baselines)

## Scope

#190's hotfix makes the visual job deterministic by capturing every theme with `backdrop-filter: none` injected, which means the baselines no longer photograph the glass effect that defines luminous-precision, neon-butterfly and summer-cloud (STANDARD.md 10, "glow and glass"). This issue restores it: find a `chromium.launch({ args })` flag set under which Chromium's compositor renders `backdrop-filter` the same way in every session, prove the glass is still rendered, and remove the override.

Bounded experiment (from #190's phase-2 plan), in order, ten no-edit control pairs each **locally**, stop at the first 10/10 clean: A `--disable-gpu-compositing`; B `--disable-gpu`; C `--use-gl=angle --use-angle=swiftshader`; D a feature-disable set checked against the pinned Chromium's actual switches. For the winner, the "glass kept" proof: a luminous-precision Cards capture with the flags must differ (pixelmatch > 0) from the same capture with the override still injected. Then -- the part #190's local experiment could not give -- **CI proof**: with the override removed and the flags in place, re-run the branch's `visual` job at least five times; all green. Local determinism did not predict CI's (#190 went live in CI at 04:12Z on 2026-09-11 after weeks of green), so CI re-runs are the acceptance, not the local pairs.

If no candidate is both 10/10 clean locally and 5/5 green in CI while keeping the glass, close this issue with the experiment table and the override stays, documented.


## Acceptance

- [ ] The experiment table (candidate, ten pair results with tile names and counts) pasted.
- [ ] Glass kept: the non-zero pixelmatch count between the flagged capture and the override capture, pasted.
- [ ] Five consecutive CI `visual` re-runs green on the branch with the override removed; one baseline regeneration reviewed by mechanism.
- [ ] Mutation: removing the flags reproduces a regressed glass tile within five CI re-runs (state the count).
- [ ] STANDARD.md section 13's limitation sentence from #190 replaced by the pin's description.

## Outcome (deviation, recorded 2026-09-11)

The experiment's own close condition fired: no candidate needed to reach
5/5 CI green, because the "glass kept" proof it exists to protect measures
zero everywhere, for any Chromium configuration, not just the candidates
under test. Candidate A (`--disable-gpu-compositing`) skipped per
Subordinate #3's prior 3/6 measurement; candidate B (`--disable-gpu`) went
10/10 clean locally with the flag verified reaching the real spawned
process's command line, but the mandated pixelmatch-vs-override proof came
back 0 for B **and** for a completely vanilla Chromium launch with no
flags at all. Two sanity checks (the `.rb-bg` underlay genuinely renders,
double-digit-percent full-viewport difference on toggle; every affected
theme's card is genuinely translucent with `blur(12px)` computed) ruled out
a harness bug before trusting that. A full sweep -- 3 glass themes x 4
named glass-bearing tiles, vanilla Chromium, `scripts/visual.mjs`'s own
real thresholds -- came back zero on all 12 combinations (a raw byte-level
check on one tile found only 1-unit-of-255 deltas: the effect is
mathematically present, nowhere near perceptible). Full evidence:
https://github.com/Rackbops/rackbops-ui-ux-std-lib/issues/192#issuecomment-5630039095.
C and D were not run -- there was no bar left for them to clear against.
Closed per the issue's own "if no candidate... close this issue... the
override stays, documented" clause, in #195 (docs-only: STANDARD.md 13's
limitation sentence and `scripts/visual.mjs`'s matching comment corrected
to state the actual finding; candidate B's local result recorded there for
the day a theme's glass is strong enough at a measured location to
matter).
# PR D

# E3 -- Toolchain and showcase hardening: implementation plan, PR D (#125, committed reduced-motion render check)

Epic #179. PR D is #125 alone, entered via `/work-on 125`. Written by the orchestrator on 2026-09-11 against `origin/main` at `9642b63` (#186 merged); line numbers are from that commit -- re-check with `grep -n`. Append this plan as a `# PR D` section at the end of the committed `docs/plans/epics/E3-toolchain-and-showcase-hardening.md` (after whatever sections are there; PR B's may land concurrently -- merge `origin/main` into your branch, no rebase, keep every section in landing order, yours last).

## Locked decisions

1. **The suppression list is contract data, not script data.** `styles/contract.json` gains a `reducedMotion` block: `{ "suppressions": { "<theme>": [ { "file": "card.css", "selector": ".rb-card--floating", "state": "hover", "target": "self" }, ... ] } }`. Today it declares exactly summer-cloud's seven (verified against source): `card.css` `.rb-card--floating` hover/self (`:30-33`); `link.css` `.rb-link` hover/`::after`, focus-visible/`::after`, active/self (`:53-59`); `button.css` `.rb-btn` hover/self, focus-visible/self, active/self (`:117-123`). Every other theme's reduced-motion blocks override `animation` only (neon-butterfly, luminous-precision, the studio pair's rack, every `progress.css`) -- no `transform: none` anywhere else (verified: the only other `transform: none` hits are mono-field's `text-transform: none` and summer-cloud's disabled-button rule outside any media block). Two checks read this data: a **source-level parity test** in `contract.test.mjs` (both directions: every declared suppression has a `transform: none` rule for that selector+state inside a `prefers-reduced-motion` block in the named file, and every `transform: none` inside a reduced-motion block in any theme file is declared), and the **render job** below. So a new suppression must be declared to pass the styles suite, and once declared it is render-checked; a deleted rule fails both.
2. **The render job is `scripts/reduced-motion.mjs`, run as `pnpm visual:reduced`, in its own CI job in the Playwright container**, mirroring `visual` (`ci.yml:37-53`) -- no browser dependency enters `pnpm test`. It reuses `scripts/visual.mjs`'s setup verbatim where it matters (in-process `server`, 1000x900, theme switch through `#theme`, the stylesheet-`sheet` wait, `document.fonts.ready`) but does **not** freeze animations (it reads computed style, never pixels) and does **not** need the #186 snap or the pointer park.
3. **Every assertion is made twice, under `page.emulateMedia({ reducedMotion: "reduce" })` and under `{ reducedMotion: "no-preference" }`, and the two must differ where the contract says they differ.** This is the guard against a vacuous pass: if emulation silently stopped applying, "transition-duration is 0s under reduce" could pass because it was 0s anyway. Concretely: `.rb-btn` `transition-duration` is all-`0s` under reduce and has at least one non-zero entry under no-preference; `.rb-spinner` `animation-duration` is `2s` under reduce and shorter under no-preference (the themes' resting 0.7-0.8s), with `animation-name` never `none` in either.
4. **Pseudo-states are forced through CDP, not simulated with a real pointer or keyboard.** `page.context().newCDPSession(page)` -> `DOM.getDocument`, `DOM.querySelector` for the element, `CSS.forcePseudoState({ nodeId, forcedPseudoClasses: [state] })` with `state` in `hover` / `active` / `focus-visible` (all supported by current Chromium), then `getComputedStyle(el, target === "self" ? null : target).transform` read in the page. Deterministic and independent of the parked pointer; `CSS.forcePseudoState` with an empty list resets it between checks. (If `focus-visible` turns out unsupported by the pinned Chromium, fall back to `page.keyboard.press("Tab")` until `document.activeElement` is the target -- a real key press is what makes `:focus-visible` match, programmatic `focus()` does not -- and say so in the PR.)
5. **The floating card is injected, the rest is already on the page.** The showcase renders `.rb-link` (`site/index.html:172-175`, use a non-active one), `.rb-btn` (`:60`), a checked `.rb-switch` (`:216`) and `.rb-spinner` (`:296`), but no `.rb-card--floating` (a summer-cloud extra with no showcase demo). The script appends `<div class="rb-card rb-card--floating">probe</div>` to `main` before probing and removes it after. For every declared suppression the forced-state computed `transform` must be exactly `none` under reduce; for the same element and state under no-preference it must NOT be `none` (that is what proves the rule is live, not that the transform never existed).
6. **Functional transforms are kept, in every theme:** the checked switch thumb (`.rb-switch:checked::after`, summer-cloud `form.css:138-139` `translateX(1.25rem)`; every theme animates the thumb this way) must have a computed `::after` `transform` that is neither `none` nor the identity `matrix(1, 0, 0, 1, 0, 0)` under reduce -- reduced motion removes decoration, never the state a control's position carries.

## Build order (one commit per step, Conventional Commits)

### 1. Plan section -- `docs(plans): E3 PR D, committed reduced-motion render check`

### 2. Contract data + parity test -- `test(styles): declare decorative reduced-motion suppressions in contract.json and check them against source (#125)`

- `styles/contract.json`: add the `reducedMotion` block after `contrast` (surgical edit; the seven summer-cloud entries above, in file order; a short `"//"` note in the block explaining that a suppression is a per-theme choice -- dropping vs. instant -- so this list is owned by the theme, and that `scripts/reduced-motion.mjs` renders it).
- `styles/test/contract.test.mjs`, beside the existing reduced-motion tests (`:718-810`): `reducedMotionBlocks(css)` (`:722`) already extracts the inner text of each `@media (prefers-reduced-motion: reduce)` block. Add, per theme: (a) for each declared entry, some rule inside a reduced-motion block of `styles/<theme>/components/<file>` has `transform: none` and a selector that contains `<selector>:<state>` followed by the target pseudo when `target` is `::after`; (b) closed-world: every `transform: none` declaration inside any reduced-motion block of any component file of that theme corresponds to a declared entry -- collect the selectors of such rules, split on commas, and require each compound to be covered. Test names: `${theme}: every declared reduced-motion suppression exists in source (#125)` and `${theme}: every transform: none inside a reduced-motion block is declared in contract.json (#125)`.
- STANDARD.md section 7 (`:599-604`, the "MUST be neutralised" bullet): add one sentence that a decorative transform a theme drops under reduce is declared in `contract.json`'s `reducedMotion.suppressions` `[tested: contract.test.mjs both directions, #125]`.

### 3. The render job -- `ci(visual): committed reduced-motion render check in the Playwright container (#125)`

`scripts/reduced-motion.mjs` (new), root `package.json` script `"visual:reduced": "node scripts/reduced-motion.mjs"`. Structure:

```
setup (server, browser, page 1000x900, goto, wait) -- copy visual.mjs:42-47, :64, :103-106 minus the animation freeze and the snap
for mode of ["reduce", "no-preference"]:
  await page.emulateMedia({ reducedMotion: mode })
  for theme of themes:
    switch theme (visual.mjs:118-126 verbatim), then:
    btn  = every comma-separated value of getComputedStyle(.rb-btn).transitionDuration
    spin = getComputedStyle(.rb-spinner).animationName / animationDuration
    thumb = getComputedStyle(.rb-switch:checked, "::after").transform
    for each declared suppression of this theme (inject .rb-card--floating first if needed):
      force the pseudo-state via CDP, read transform, reset
    record { theme, mode, btn, spin, thumb, suppressions: [...] }
assert per theme:
  reduce:  btn all "0s"; spin.name !== "none" && spin.duration === "2s"; thumb not none/identity; every suppression transform === "none"
  no-pref: btn some !== "0s"; spin.name !== "none" && spin.duration !== "2s"; every suppression transform !== "none"
print a per-theme table; exit 1 with every failure listed
```

`.github/workflows/ci.yml`: a `reduced-motion` job after `visual`, same container and steps, `run: pnpm visual:reduced`, no artifact upload. CONTEXT.md's toolchain line for the visual job (`grep -n 'visual' CONTEXT.md`) gains the new script; STANDARD.md's status table (`:963` row for #51) gains a row: "Decorative reduced-motion suppressions resolve to `transform: none` when rendered; transitions collapse and the spinner slows to 2s in every theme" / `scripts/reduced-motion.mjs` / `live (#125)`.

### 4. Nothing else. No baselines change (no pixels are captured), no theme CSS changes.

## Mutation guards (paste one failing output per row)

| Change | Mutation | Failing check |
| --- | --- | --- |
| render check, suppression | delete summer-cloud `card.css`'s reduced-motion block (`:30-33`) | `pnpm visual:reduced`: summer-cloud `.rb-card--floating` hover transform is not `none` under reduce; AND `contract.test.mjs` parity (a): declared but absent in source |
| render check, token collapse | in one theme's `tokens.css`, delete the `--rb-transition: 0s` reduced block | `visual:reduced`: that theme's `.rb-btn` transition-duration non-zero under reduce (the existing source test at `:765` also fails) |
| render check, spinner | change one theme's reduced `animation-duration: 2s` (progress.css) to `1s` | `visual:reduced`: spinner duration is not `2s` |
| emulation is live | remove the `emulateMedia` call | the no-preference and reduce records are identical -> the "must differ" assertions fail (btn non-zero under reduce, suppressions not `none`) |
| parity, closed world | add `transform: none` for `.rb-btn:hover` inside a reduced-motion block in amber-hearth `button.css` without declaring it | `contract.test.mjs` parity (b) names it |
| parity, declared | add a bogus entry (`.rb-badge` hover) to summer-cloud's list | parity (a) names it; `visual:reduced` also fails on it under no-preference (transform already `none`, so "not none without reduce" fails) |

## Acceptance to execute and paste (the #125 bullets, made concrete)

1. `pnpm visual:reduced` locally (Chromium via `playwright-core` is present): the per-theme table for both modes, fourteen rows each, and the green summary. Local is valid here: nothing is compared to committed pixels.
2. `pnpm --filter @rackbops/styles test` green with the two parity tests visible; paste summer-cloud's rows.
3. The `reduced-motion` CI job green on the branch (link), in the Playwright container, separate from `test`.
4. `grep -n 'reducedMotion' styles/contract.json` (the block) and `grep -n '#125' STANDARD.md CONTEXT.md scripts/reduced-motion.mjs .github/workflows/ci.yml`.
5. The mutation table, one pasted failure per row.
6. `pnpm test` (root) and `pnpm build` green.

## Exit demo (closes the epic's "reduced-motion render job in ci.yml beside visual")

On `main`: `ci.yml` runs `reduced-motion` in the Playwright container; deleting summer-cloud's `card.css` reduced-motion block fails two checks (render and parity); the no-preference pass proves the emulation is live.

## Sub's operating rules

- Read #125, #51 (closed; its acceptance bullet 6 is the prior art) and #179 in full before touching anything.
- Own worktree from `origin/main`; never `git stash`; `git -C`, never `cd && git`; no force-push. The plan-file conflict rule above applies.
- Stop conditions -- message the orchestrator: `CSS.forcePseudoState` rejecting `focus-visible` AND the keyboard fallback not matching either; any theme other than summer-cloud turning out to carry a `transform: none` inside a reduced-motion block (the closed-world test will name it; that is a finding about main, declare it only after reporting); the spinner's reduced duration not being `2s` in some theme on a clean tree.
- Review gate as before (correctness on the CDP forcing and the two-mode logic vs. claims-vs-code on the acceptance and the STANDARD.md/CONTEXT.md sentences), up to four rounds; report round count and findings; do not merge.