# rackbops-ui-ux-std-lib -- toolchain & build ledger

The paid-for-once facts about how this repo is built, tested, published, and deployed. The design
**contract** (tokens, classes, theme anatomy, a11y) is [`STANDARD.md`](STANDARD.md); the definition of
done and the authoring conventions are [`CLAUDE.md`](CLAUDE.md); this file is the toolchain. Verify a
toolchain claim here against `package.json` / the workflow files, **not** against STANDARD.md -- its
line citations and counts are known to drift (issues #95, #56).

---

## Workspace

pnpm monorepo (`pnpm@11.15.1`, `pnpm-workspace.yaml`: `styles` + `components/*`), two publishable packages:

| Package | Dir | What it ships |
|---|---|---|
| `@rackbops/styles` | `styles/` | The CSS themes + the `--rb-*` / `rb-*` contract (`contract.json`, `manifest.json`, `all.css`). **No build step** -- CSS ships as authored. |
| `@rackbops/ui-react` | `components/react/` | React components; **built** with `tsc -p tsconfig.build.json` to `dist/` (the published artifact). |

Both are `@rackbops`-scoped and **public on npm** (currently `v0.2.25`). `esbuild`'s postinstall is
disabled in `pnpm-workspace.yaml` (`allowBuilds: esbuild: false`) -- `tsx` resolves its platform binary
at runtime without it.

---

## Testing & checks

The test runner is **`node --test` (node:test) everywhere** -- no vitest/jest. Run before staging:

- **`pnpm --filter @rackbops/styles test`** -- the eight `styles/test/` suites (all `node:test`): the
  theme **contract** (the DoD gate), light/dark **pair-parity**, **base-typography** parity, a TS
  side-effect-import **types** check (spawns `tsc`), computed WCAG **contrast** ratios, per-theme
  **bundle**.css generation, and the **release** / **bump** version logic.
- **`pnpm --filter @rackbops/ui-react test`** -- `tsc --noEmit`, then the component render tests
  (`node --import tsx --test "src/**/*.test.tsx"`, react-dom/server + jsdom).
- **`pnpm --filter @rackbops/ui-react build`** -- strict `tsc`; the React package must typecheck + build.
- **`node --test site/serve.test.mjs scripts/generate-skill-table.test.mjs scripts/copy-license.test.mjs scripts/new-theme.test.mjs`**
  -- the showcase-server containment tests and the three generator/scaffold tests.

`pnpm test` chains `pnpm -r test` with those root tests; `pnpm build` = `pnpm -r build`. **The contract
test is the definition-of-done gate** -- see `CLAUDE.md`.

**CI** ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs exactly that chain -- `pnpm install
--frozen-lockfile`, `pnpm build`, `pnpm test` -- as its `test` job on Node 24, on **both** `pull_request`
and `push:[main]`, plus two separate browser-dependency jobs in the Playwright container: `visual`
(`pnpm visual`, pixel comparison against committed baselines) and `reduced-motion` (`pnpm visual:reduced`,
issue #125 -- renders the showcase under emulated `prefers-reduced-motion` and asserts computed style,
never pixels; no baseline to regenerate).

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
