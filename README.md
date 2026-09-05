# rackbops-ui-ux-std-lib

UX/design-standards library for roshne's apps — the same shape as
[`nazuraki/ui-std-lib`](https://github.com/nazuraki/ui-std-lib), re-namespaced to
the rackbops brand (`--rb-*`, `.rb-*`, `data-rb-style`). Two layers:

- **`styles/`** (`@rackbops/styles`) — framework-agnostic CSS: design tokens, base
  styles, and component classes, organized per theme. Any app (React, Svelte,
  plain HTML) can adopt this layer immediately.
- **`components/react/`** (`@rackbops/ui-react`) — React components that render the
  style layer's classes, for behavior-heavy UI.

Each theme is a **design language** captured as a written `design.md` spec plus
its CSS — most reverse-documented from one of roshne's apps, some ported (and
credited) from [`nazuraki/ui-std-lib`](https://github.com/nazuraki/ui-std-lib),
and some original designs built directly for this library. One shared `--rb-*`
token / `rb-*` class contract means themes are drop-in swappable — one
attribute flip.

## Themes

Two of roshne's app design languages (each a light/dark pair), three themes
ported — credited — from [`nazuraki/ui-std-lib`](https://github.com/nazuraki/ui-std-lib),
and five original designs built for this library (two light/dark pairs plus
one standalone). One `--rb-*` / `rb-*` contract, so any two swap with a single
`data-rb-style` flip.

| Theme | Scheme | Source | Description |
| --- | --- | --- | --- |
| `arcane-obsidian` | dark | artifact-console | Deep obsidian console, sole arcane-violet accent, one rationed violet→gold gradient, luminance-first depth, mono display voice + tabular numerals. |
| `arcane-parchment` | light | artifact-console | The AA-tuned light counterpart of arcane-obsidian — same console language on a cool parchment ground. |
| `rackbops-studio` | light | rackbops.com | Cool-paper editorial studio, vermillion over navy ink, heavy 800 headlines, mono eyebrows, the rack-equaliser panel + Boppy mascot, soft-shadow depth. |
| `rackbops-noir` | dark | rackbops.com | The dark counterpart of rackbops-studio — the mode rackbops.com toggles into, deep slate with brighter vermillion. |
| `luminous-precision` | dark | nazuraki/ui-std-lib | Glassmorphic obsidian console — orchid brand voice, electric-teal active paths, glow-as-elevation; Sora headlines over JetBrains Mono. Ported (credited) from nazuraki/ui-std-lib. |
| `neon-butterfly` | dark | nazuraki/ui-std-lib | Mono-spaced neon terminal — lilac brand voice, neon-lime activity signals, glass over deep navy, all-uppercase JetBrains Mono. Ported (credited) from nazuraki/ui-std-lib. |
| `summer-cloud` | light | nazuraki/ui-std-lib | Airy retail glass — vivid violet emphasis, sky-blue interaction, white glass floating on a sky gradient, bouncy motion. Ported (credited) from nazuraki/ui-std-lib. |
| `concrete-signal` | dark | original | Brutalist industrial — zero radius, hard offset shadows instead of blur, sole safety-orange accent, snappy 0.1s transitions, all-uppercase heavy labels. |
| `concrete-signal-light` | light | original | The light counterpart of concrete-signal — same hard-edged mechanics on a poured-concrete off-white ground. |
| `amber-hearth` | light | original | Warm hand-crafted editorial — clay-terracotta accent on cream, the library's only serif display voice, the most generously rounded shape language, warm-toned diffused shadows. |
| `amber-ember` | dark | original | The dark, espresso-ground counterpart of amber-hearth — same serif-and-clay language on a warm dark night palette. |
| `mono-field` | light | original | Deliberately restrained quiet monochrome — near-flat grayscale surfaces, hairline-driven hierarchy, near-black ink accent, no uppercase, no glow. Standalone, no pair. |

Each theme ships a `design.md` — a written spec of the aesthetic (palette,
typography, shape rules, component inventory). Read it before designing new
screens. `styles/manifest.json` (exported as `@rackbops/styles/manifest`) is the
machine-readable roster. Most themes use system stacks (`system-ui` +
`ui-monospace`) — nothing to load. A theme that needs webfonts (e.g.
`luminous-precision`: Sora + JetBrains Mono) lists its stylesheet URL(s) in that
theme's manifest `fonts` array; consumers inject those `<link>`s (the `site/`
showcase does this on theme switch). Ported themes are credited in
[`NOTICE`](NOTICE).

## Consuming

The packages publish to **public npm** under the `@rackbops` scope (the *design*
namespace stays `rb` — don't conflate). No auth or `.npmrc` needed:

```bash
npm install @rackbops/styles @rackbops/ui-react
```

### Styles (any app)

```css
@import "@rackbops/styles/arcane-obsidian";        /* full theme */
@import "@rackbops/styles/arcane-obsidian/tokens";  /* tokens only */
@import "@rackbops/styles/all";                     /* every theme, for runtime switching */
```

```html
<html data-rb-style="arcane-obsidian">
```

Everything is scoped: nothing applies until an element carries
`data-rb-style="<theme>"` — put it on `<html>` for a page or on any container to
theme just that subtree (embed-safe; the `:where()` guards are zero-specificity
so your own rules override). Several themes can load at once and swapping is one
attribute flip.

No-build apps can load a theme's CSS from a CDN — jsDelivr mirrors public npm,
e.g. `https://cdn.jsdelivr.net/npm/@rackbops/styles/luminous-precision/index.css`
(once the package is published).

### React components

```tsx
import "@rackbops/styles/arcane-obsidian";
import { Button, Card, NavLink } from "@rackbops/ui-react";
```

Import a theme's CSS once at the app root; components carry only class names
(`rb-btn`, `rb-card`, `rb-link`), so themes stay swappable.

## Showcase

```bash
pnpm install
pnpm showcase   # http://localhost:5177/site/
```

Renders every component under a theme switcher. It runs locally (above), and is also
hosted at `styles.rackbops.com` behind Cloudflare Access — see `deploy/README.md` for
the hosting setup (a per-app tunnel + pull-model auto-deploy, not the pattern
rackbops.com uses).

## Developing

```bash
pnpm install
pnpm build                              # tsc the React package
pnpm --filter @rackbops/styles test       # theme contract + release-bump tests
pnpm --filter @rackbops/ui-react test     # typecheck + render-to-string component tests + ref-forwarding (jsdom)
```

The contract test (`styles/test/contract.test.mjs`) enforces the theme rules:
every selector guarded by its `data-rb-style`, keyframe names `rb-`-prefixed and
unique, the baseline token set complete, `color-scheme` matching the manifest,
and manifest/exports/directories in sync. A new theme that passes it works in
every manifest-reading consumer.

## Publishing

Merging package changes to `main` runs the `release` workflow: it bumps both
package versions (patch by default; a `type!:` subject or `BREAKING CHANGE:`
footer bumps the minor while the major is 0), tags, and creates the GitHub
release. Pushing a `v*` tag triggers `publish.yml`, which runs
`npm publish --access public` for both packages against the public npm
registry (`registry.npmjs.org`).

The two steps authenticate differently:

- **`release`** needs a `RELEASE_TOKEN` (a PAT that can push past branch
  protection, and whose tag push actually triggers `publish.yml` below —
  a plain `GITHUB_TOKEN` push wouldn't) to create the bump commit and tag.
  That secret **is configured and live** — the workflow runs automatically
  on qualifying merges to `main`, unattended; `v0.1.9` and `v0.1.10` were
  both cut this way. If the secret were ever unset, the workflow no-ops
  instead (`RELEASE_TOKEN not set — release/publish is inert. Skipping.`),
  and a release can still be cut by running `.github/scripts/release.sh`
  locally as a fallback — it commits the version bump, pushes it to
  `main`, tags, pushes the tag, and creates the GitHub release itself, so
  there's nothing left to push by hand afterward. It needs push rights to
  the repo and an authenticated `gh` CLI.
- **`publish`** uses **OIDC trusted publishing** — no stored npm token.
  `publish.yml` requests a short-lived `id-token` (its `permissions:` grant
  `id-token: write`), and npm exchanges it against the trusted publisher that
  must be configured on npmjs.com **for each package** — organization
  `Rackbops`, repository `rackbops-ui-ux-std-lib`, workflow `publish.yml`, with
  the optional **Environment** field left blank (the workflow declares no
  GitHub environment — filling it in would break the OIDC match). npm also
  generates and publishes provenance attestations automatically on every
  publish (the repo is public, which provenance requires). A `v*` tag pushed
  **before** both `@rackbops/styles` and `@rackbops/ui-react` have that trusted
  publisher configured fails to publish — set it up on npm first. setup-node
  intentionally omits `registry-url` so it doesn't write an empty `_authToken`
  line that would make npm skip the OIDC exchange
  ([actions/setup-node#1551](https://github.com/actions/setup-node/issues/1551)).
  A **preflight step** checks these prerequisites up front and, on failure,
  prints exactly which one is missing instead of the bare `ENEEDAUTH` npm emits
  for any auth problem.
  - **Break-glass token fallback.** Setting an `NPM_TOKEN` secret (a granular
    read+write token on the `@rackbops` scope) switches `publish.yml` to classic
    token auth and bypasses OIDC — an escape hatch for when the trusted
    publisher isn't configured yet or npm's OIDC is down. It's **unset by
    default** (OIDC is the intended path); token-auth publishes carry no
    provenance. Unset the secret to return to OIDC.

## Agent skill

[`skills/design-system/SKILL.md`](skills/design-system/SKILL.md) teaches coding
agents to consume this system instead of writing ad-hoc styles. Install it in an
app repo by symlinking or copying into `.claude/skills/design-system/`.

## Layout

```
styles/                    @rackbops/styles
  manifest.json            theme roster: name, scheme, fonts
  all.css                  every theme in one import
  arcane-obsidian/         tokens.css, base.css, components/*.css, index.css, design.md
  rackbops-studio/         same layout + assets/boppy.svg + studio extras
  test/                    contract + release-bump tests (node:test)
components/react/          @rackbops/ui-react (tsc -> dist/)
site/                      showcase (index.html + serve.mjs, no build)
deploy/                    hosted-showcase auto-deploy: pull script + systemd timer + README
compose.yaml, nginx.conf   the hosted-showcase compose stack (repo root -- see deploy/README.md)
skills/design-system/      agent skill for consuming the system
```

Relationship to `roshne/ui-std-lib`: that repo is roshne's **fork of Nazu's**
shared system (for consuming / contributing upstream). *This* repo is roshne's
own, separately-branded design-standards library.

## License

MIT, matching the upstream `nazuraki/ui-std-lib` this library ports themes
from. See [`LICENSE`](LICENSE). The `luminous-precision`, `neon-butterfly`,
and `summer-cloud` themes retain nazuraki's own MIT copyright notice; see
[`NOTICE`](NOTICE).
