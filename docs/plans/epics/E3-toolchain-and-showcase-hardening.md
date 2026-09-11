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
