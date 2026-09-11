# rackbops-ui-ux-std-lib -- toolchain & build ledger

The paid-for-once facts about how this repo is built, tested, published, and deployed. The design
**contract** (tokens, classes, theme anatomy, a11y) is [`STANDARD.md`](STANDARD.md); the definition of
done and the authoring conventions are [`CLAUDE.md`](CLAUDE.md); this file is the toolchain. Verify a
toolchain claim here against `package.json` / the workflow files, **not** against STANDARD.md -- its
line citations and counts are known to drift (issues #95, #56).

---

## Workspace

pnpm monorepo (pnpm 12, pinned by the root `package.json` `packageManager` field -- Renovate keeps the pin current; `pnpm-workspace.yaml`: `styles` + `components/*`), two publishable packages:

| Package | Dir | What it ships |
|---|---|---|
| `@rackbops/styles` | `styles/` | The CSS themes + the `--rb-*` / `rb-*` contract (`contract.json`, `manifest.json`, `all.css`). **No build step** -- CSS ships as authored. |
| `@rackbops/ui-react` | `components/react/` | React components; **built** with `tsc -p tsconfig.build.json` to `dist/` (the published artifact). |

Both are `@rackbops`-scoped and **public on npm** (`styles/package.json` and `components/react/package.json` carry the same version, cut by the release pipeline below). `esbuild`'s postinstall is
disabled in `pnpm-workspace.yaml` (`allowBuilds: esbuild: false`) -- `tsx` resolves its platform binary
at runtime without it.

**Run pnpm through a launcher that is itself >= 12** (`npm i -g pnpm@latest`, or Corepack). An
older npm-global launcher (this machine's was `pnpm@11.15.1` until 2026-09-11) self-switches to the pin --
so `pnpm --version` still prints 12.x -- but first rewrites `pnpm-lock.yaml`'s
`packageManagerDependencies` with an extra `@pnpm/exe` entry on EVERY command, even
`install --frozen-lockfile`, leaving the lockfile dirty in every local checkout. CI never sees it
(`pnpm/action-setup` installs the pin directly). Check the launcher with `npm ls -g pnpm --depth=0`,
not `pnpm --version`; if the lockfile turns dirty with an `@pnpm/exe` block, restore it
(`git checkout -- pnpm-lock.yaml`) and never commit it (#203).

---

## Testing & checks

The test runner is **`node --test` (node:test) everywhere** -- no vitest/jest. Run before staging:

- **`pnpm --filter @rackbops/styles test`** -- the eleven `styles/test/` suites (all `node:test`): the
  theme **contract** (the DoD gate), light/dark **pair-parity**, **base-typography** parity, a TS
  side-effect-import **types** check (spawns `tsc`), computed WCAG **contrast** ratios, per-theme
  **bundle**.css generation, the **release** / **bump** version logic, the contrast contract's
  **accessibility-docs** documentation half, the arcane pair's **arcane-tabstrip-underline** gradient
  fidelity check, and the shared **wordmark-paint** anatomy pin across all themes.
- **`pnpm --filter @rackbops/ui-react test`** -- `tsc --noEmit`, then the component render tests
  (`node --import tsx --test "src/**/*.test.tsx"`, react-dom/server + jsdom).
- **`pnpm --filter @rackbops/ui-react build`** -- strict `tsc`; the React package must typecheck + build.
- **`node --test site/serve.test.mjs site/showcase-extras.test.mjs scripts/generate-skill-table.test.mjs scripts/copy-license.test.mjs scripts/new-theme.test.mjs scripts/visual-control.test.mjs scripts/visual-diff-probe.test.mjs`**
  -- the showcase-server containment tests, the theme-extras placement tests, the three
  generator/scaffold tests, and the pure parts (shift arithmetic, output parsing, env wiring) of the
  two visual-job diagnostics below.

`pnpm test` chains `pnpm -r test` with those root tests; `pnpm build` = `pnpm -r build`. **The contract
test is the definition-of-done gate** -- see `CLAUDE.md`.

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs exactly that chain -- `pnpm install
--frozen-lockfile`, `pnpm build`, `pnpm test` -- as its `test` job on Node 24, on **both** `pull_request`
and `push:[main]`, plus two separate browser-dependency jobs in the Playwright container: `visual`
(`pnpm visual`, pixel comparison against committed baselines) and `reduced-motion` (`pnpm visual:reduced`,
issue #125 -- renders the showcase under emulated `prefers-reduced-motion` and asserts computed style,
never pixels; no baseline to regenerate).

**Visual-job diagnostics** (`scripts/visual-control.mjs`, `scripts/visual-diff-probe.mjs`, #198) are
tracked scripts, not throwaways -- three separate sessions rebuilt an equivalent of each from scratch
in one night (#186/#190/#192) because the working versions lived as untracked files. Reach for
`visual-control.mjs` to ask "is the visual job deterministic here?" (N no-edit update-then-compare
pairs against a scratch copy of the baselines, never the committed ones -- `--themes`/`--launch-args`/
`--keep-glass` are the #192 compositor-pin experiment hooks). Reach for `visual-diff-probe.mjs` to ask
"is this baseline diff a phase shift or a content change?" (raw pixel diff, a -2..+2 row-shift residual,
and a bounding box, for two PNGs or `--theme/--tile/--old/--new` read straight from git -- the method
#186's PR C used by hand to show 128 of 156 changed tiles were pure phase noise).

---

## Generated vs authored

| File(s) | Produced by | Rule |
|---|---|---|
| each package's `LICENSE` / `NOTICE` | `scripts/copy-license.mjs` (both packages' `prepack`) | Never hand-edit; edit the root `LICENSE`/`NOTICE` and let pack regenerate. `copy-license.test.mjs` pins the wiring. |
| `skills/design-system/SKILL.md`'s component table | `scripts/generate-skill-table.mjs` (from `styles/contract.json`) | Regenerate; don't hand-edit the table. `generate-skill-table.test.mjs` asserts it stays in sync. |
| `components/react/dist/` | `tsc -p tsconfig.build.json` | Build output -- never committed as source. |

---

## Release & publish (automated, tag-driven)

- **Release** ([`release.yml`](.github/workflows/release.yml) + `.github/scripts/next-version.sh` /
  `release-lib.sh` / `release.sh`): Conventional Commits drive the bump -- a `type!:` subject or
  `BREAKING CHANGE:` footer gives the minor bump (major stays `0`); `release.sh`'s `VERSION_FILES`
  bumps every package's version to match the new `v*` tag. Landed as `chore(release): vX.Y.Z`, tagged,
  and pushed in one atomic `git push --atomic origin main <tag>` (issue #88) -- either both land or
  neither does, so release.sh has no partial state to resume from and never calls `gh`. Release notes
  (`release-notes.sh`) group subjects by type -- feat, fix, revert, perf, refactor, chore, docs, style,
  test, build, ci -- and prefix a `type!:` subject with `BREAKING:`; a `BREAKING CHANGE:` footer drives
  the bump but is not visible to the subjects-only notes (#113).
- **Publish** ([`publish.yml`](.github/workflows/publish.yml), on a `v*` tag): the default path is
  **OIDC trusted publishing** (no long-lived token; provenance emitted automatically), with the trusted
  publisher configured on npmjs.com as *org Rackbops / repo rackbops-ui-ux-std-lib / workflow
  publish.yml*. **`NPM_TOKEN` is a break-glass fallback only** (classic token auth, no provenance) --
  leave it **unset** for normal operation. Before publishing, the workflow refuses if the tag doesn't
  match every package's version, and skips a package already on the registry at that version (rerun-safe).
  Once publishing succeeds, a final step creates the GitHub release itself
  (`.github/scripts/release-notes.sh` / `publish-release.sh`, idempotent -- issue #88) using
  `RELEASE_TOKEN` (falling back to the default `GITHUB_TOKEN`) so the release is attributed to roshne.
  - **Gotcha (paid for once, #99/#107):** never give `setup-node` a `registry-url` here -- it writes an
    empty `_authToken=` into `.npmrc`, which makes npm skip the OIDC exchange and fail with a bare
    `ENEEDAUTH` (actions/setup-node#1551). Trusted publishing needs npm >= 11.5.1.

---

## Showcase & deploy

`node site/serve.mjs` serves the local theme showcase (`site/`). It is deployed via `deploy/` (a systemd
`.timer` + `.service` running `deploy-pull.sh`) with `nginx.conf` / `compose.yaml` -- see
[`deploy/README.md`](deploy/README.md). `site/serve.test.mjs` guards the dev server's path-containment /
`.git`-exclusion behaviour.

---

## Gotchas

- **Verify toolchain facts against `package.json` / the workflows, not STANDARD.md** -- its citations
  and counts drift (#95/#56). STANDARD.md still owns the design *contract*; its *line numbers* are not
  load-bearing.
- **`node:test`, not vitest** -- the whole suite (styles, react-via-`tsx`, site, scripts) is Node's
  built-in runner; a "pick a test framework" instinct reaches for the wrong tool here.
