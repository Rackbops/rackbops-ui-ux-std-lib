# rackbops-ui-ux-std-lib

Private UX/design-standards library for roshne's apps — the same shape as
[`nazuraki/ui-std-lib`](https://github.com/nazuraki/ui-std-lib), re-namespaced to
the rackbops brand (`--rb-*`, `.rb-*`, `data-rb-style`). Two layers:

- **`styles/`** (`@roshne/styles`) — framework-agnostic CSS: design tokens, base
  styles, and component classes, organized per theme. Any app (React, Svelte,
  plain HTML) can adopt this layer immediately.
- **`components/react/`** (`@roshne/ui-react`) — React components that render the
  style layer's classes, for behavior-heavy UI.

Each theme is a **design language reverse-documented from one of roshne's apps**,
captured as a written `design.md` spec plus its CSS. One shared `--rb-*` token /
`rb-*` class contract means themes are drop-in swappable — one attribute flip.

## Themes

Two app design languages, each shipped as a light/dark pair — one `--rb-*` /
`rb-*` contract, so any two swap with a single `data-rb-style` flip.

| Theme | Scheme | Source | Description |
| --- | --- | --- | --- |
| `arcane-obsidian` | dark | artifact-console | Deep obsidian console, sole arcane-violet accent, one rationed violet→gold gradient, luminance-first depth, mono display voice + tabular numerals. |
| `arcane-parchment` | light | artifact-console | The AA-tuned light counterpart of arcane-obsidian — same console language on a cool parchment ground. |
| `rackbops-studio` | light | rackbops.com | Cool-paper editorial studio, vermillion over navy ink, heavy 800 headlines, mono eyebrows, the rack-equaliser panel + Boppy mascot, soft-shadow depth. |
| `rackbops-noir` | dark | rackbops.com | The dark counterpart of rackbops-studio — the mode rackbops.com toggles into, deep slate with brighter vermillion. |

Each theme ships a `design.md` — a written spec of the aesthetic (palette,
typography, shape rules, component inventory). Read it before designing new
screens. `styles/manifest.json` (exported as `@roshne/styles/manifest`) is the
machine-readable roster. Fonts are system stacks (`system-ui` + `ui-monospace`) —
nothing to load, and the manifest carries no font URLs.

## Consuming

The packages publish to **GitHub Packages** (private, tied to the `roshne`
account — hence the `@roshne` scope while the design namespace stays `rb`). Add a
one-line `.npmrc` with a `read:packages` token:

```
@roshne:registry=https://npm.pkg.github.com
```

### Styles (any app)

```css
@import "@roshne/styles/arcane-obsidian";        /* full theme */
@import "@roshne/styles/arcane-obsidian/tokens";  /* tokens only */
@import "@roshne/styles/all";                     /* every theme, for runtime switching */
```

```html
<html data-rb-style="arcane-obsidian">
```

Everything is scoped: nothing applies until an element carries
`data-rb-style="<theme>"` — put it on `<html>` for a page or on any container to
theme just that subtree (embed-safe; the `:where()` guards are zero-specificity
so your own rules override). Several themes can load at once and swapping is one
attribute flip.

A **private repo can't be served by jsDelivr**, so no-build apps consume the CSS
via a git dependency instead of a CDN link.

### React components

```tsx
import "@roshne/styles/arcane-obsidian";
import { Button, Card, NavLink } from "@roshne/ui-react";
```

Import a theme's CSS once at the app root; components carry only class names
(`rb-btn`, `rb-card`, `rb-link`), so themes stay swappable.

## Showcase

```bash
pnpm install
pnpm showcase   # http://localhost:5177/site/
```

Renders every component under a theme switcher. This is a **private** design
system, so it is deliberately **not** published to GitHub Pages (Pages from a
private repo is a public site on non-Enterprise plans). To host it privately,
deploy `site/` behind Cloudflare Access on the box — the same pattern
rackbops.com uses.

## Developing

```bash
pnpm install
pnpm build                              # tsc the React package
pnpm --filter @roshne/styles test       # theme contract + release-bump tests
```

The contract test (`styles/test/contract.test.mjs`) enforces the theme rules:
every selector guarded by its `data-rb-style`, keyframe names `rb-`-prefixed and
unique, the baseline token set complete, `color-scheme` matching the manifest,
and manifest/exports/directories in sync. A new theme that passes it works in
every manifest-reading consumer.

## Publishing

Merging package changes to `main` runs the `release` workflow: it bumps both
package versions (patch by default; a `type!:` subject or `BREAKING CHANGE:`
footer bumps the minor while the major is 0), tags, creates the GitHub release,
and the tag triggers `publish.yml`, which publishes both packages to GitHub
Packages.

> The publish workflow ships wired but is **inert until a `RELEASE_TOKEN` secret
> is added** (a PAT that can push past branch protection). Until then, cut
> releases locally with `.github/scripts/release.sh`.

## Agent skill

[`skills/design-system/SKILL.md`](skills/design-system/SKILL.md) teaches coding
agents to consume this system instead of writing ad-hoc styles. Install it in an
app repo by symlinking or copying into `.claude/skills/design-system/`.

## Layout

```
styles/                    @roshne/styles
  manifest.json            theme roster: name, scheme, fonts
  all.css                  every theme in one import
  arcane-obsidian/         tokens.css, base.css, components/*.css, index.css, design.md
  rackbops-studio/         same layout + assets/boppy.svg + studio extras
  test/                    contract + release-bump tests (node:test)
components/react/          @roshne/ui-react (tsc -> dist/)
site/                      local showcase (index.html + serve.mjs, no build)
skills/design-system/      agent skill for consuming the system
```

Relationship to `roshne/ui-std-lib`: that repo is roshne's **fork of Nazu's**
shared system (for consuming / contributing upstream). *This* repo is roshne's
own, separately-branded design-standards library.
