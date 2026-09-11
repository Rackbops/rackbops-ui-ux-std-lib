---
name: design-system
description: Use the rackbops ui/ux std-lib design system when building or restyling UI in roshne's apps. Trigger whenever creating pages, components, forms, dialogs, or styling in a repo that adopts a rackbops theme — the app should consume @rackbops/styles and @rackbops/ui-react rather than ad-hoc CSS or one-off components.
---

# Using the rackbops design system

roshne's apps standardize their UX on `rackbops-ui-ux-std-lib`
(github.com/Rackbops/rackbops-ui-ux-std-lib). Never write ad-hoc colors, fonts, or
component styles in an app that has adopted a theme — consume the system.

## Rules

1. **Tokens, not literals.** Use `--rb-*` custom properties for every color,
   font, radius, and spacing value in component and layout styling. If a needed
   token doesn't exist, propose adding it to the std-lib rather than hardcoding.
   *Exception — illustration assets.* A self-contained illustration (a mascot,
   logo, or decorative SVG whose palette is fixed by the approved artwork) is
   art, not themeable styling: its literal `fill`/`stroke` colors may stay
   hardcoded. Use `currentColor` or tokens for any part genuinely meant to
   follow the theme, but don't force a fixed-palette illustration onto tokens
   just to satisfy this rule.
2. **Existing components first.** Before building UI, check the component
   inventory below. App-local components are only for genuinely app-specific
   composites — and should still be built from `rb-*` classes.
3. **Read the theme's `design.md`** before designing new screens — it states the
   aesthetic rules that the CSS alone does not encode (e.g. Arcane Obsidian's
   "colour is earned" and the one-gradient ration).
4. **Gaps go upstream.** A missing component belongs in the std-lib as a PR, not
   in the app.
5. **Pick the app's theme by kind, not by taste.** A console or internal tool
   defaults to `arcane-obsidian`, with `arcane-parchment` as its light mode. A
   public-facing or marketing surface defaults to `rackbops-studio`, with
   `rackbops-noir` as its dark mode. The other eight themes are opt-in for
   variety and experiments -- if the app picks one, say why in its own
   `README.md` or `CLAUDE.md`.
6. **Offer a mode toggle only on a pair.** Toggling is one attribute write with
   both themes loaded; a standalone theme (`mono-field`) has no toggle.

## Consuming

Every rule is scoped: nothing applies until an element carries
`data-rb-style="<theme>"`. Put it on `<html>` for a page the app owns, or on a
mount container to theme one subtree (embed-safe: the CSS is inert everywhere
else, and the `:where()` guards add no specificity, so a consumer rule overrides
a base component rule at equal weight -- a few state-driven rules reach
`(0,2,0)` or deeper (up to `(0,4,0)`), which your override then matches).
Several themes can load together;
swapping is an attribute flip.

The full roster is 14 themes. Two pairs are reverse-documented from roshne's
own apps: `arcane-obsidian` (dark) / `arcane-parchment` (light) — the
artifact-console developer console; and `rackbops-studio` (light) /
`rackbops-noir` (dark) — the rackbops editorial studio. Three are ported
(credited) from nazuraki/ui-std-lib: `luminous-precision`, `neon-butterfly`,
`summer-cloud`. The remaining seven are original: `concrete-signal` (dark) /
`concrete-signal-light` (light), `amber-hearth` (light) / `amber-ember` (dark),
`kenzen-midnight` (dark) / `kenzen-cyberhealth` (light) — Kenzen-sei's
cyber-health brand — and standalone `mono-field` (light, no dark sibling
yet). All 14 declare the same `--rb-*` baseline and the same `rb-*` classes,
so changing the attribute restyles the app without touching markup. Fonts are
system stacks everywhere except the three ported themes and the Kenzen pair
(Sora), which declare webfont URLs in the manifest.

The packages publish to **public npm** under `@rackbops` — no auth needed:

```bash
npm install @rackbops/styles @rackbops/ui-react
```

then:

```tsx
import "@rackbops/styles/arcane-obsidian"; // one theme…
import "@rackbops/styles/all";             // …or all of them, for runtime switching
import { Button, Card, Dialog, Tabs, Field, Input, Alert } from "@rackbops/ui-react";
```

```html
<html data-rb-style="arcane-obsidian">
```

`@rackbops/styles/manifest` is the machine-readable roster — theme names,
scheme (`dark`/`light`), and `fonts` (webfont stylesheet URLs, empty for
system-font themes). Validate configured theme names from it rather than
hardcoding a list. A theme with a non-empty `fonts` array needs each URL
injected as a `<link rel="stylesheet">` yourself on theme switch — no
`@rackbops/ui-react` helper does this yet; `site/`'s showcase in the std-lib
repo is the reference implementation. No-build apps can load the CSS from
jsDelivr's npm mirror once published, e.g.
`https://cdn.jsdelivr.net/npm/@rackbops/styles/<theme>/index.css`.

## Component inventory

React exports (each renders the matching `rb-*` CSS class, usable directly in
non-React apps):

This table is generated from `styles/contract.json` — edit that file, then run
`node scripts/generate-skill-table.mjs`, not this table directly
(`scripts/generate-skill-table.test.mjs` fails the suite if they drift).

<!-- contract-table:start -->
| React | CSS class | Notes |
| --- | --- | --- |
| `Button` | `.rb-btn` | variants: primary, accent, danger, ghost; --sm compact size; .rb-icon-btn icon-only square |
| `Card` | `.rb-card` | raised prop; --raised is a documented no-op in the three nazuraki ports (section 5.3) |
| `NavLink` | `.rb-link` | active prop; also matches [aria-current="page"] in every theme |
| `NavRail` | `.rb-nav-rail` | composes .rb-link; owns no active convention; per-item onClick/target/rel/aria-*/data-*/className forward to that item's NavLink (#84) |
| `Field`/`Label`/`Input`/`Textarea`/`Select`/`Checkbox`/`Radio`/`Switch` | `.rb-field` | pair with Field/Label; choice controls wrap in .rb-choice; className/rest still target the control itself -- use wrapperClassName/wrapperStyle to style the .rb-choice row (#84) |
| `Badge` | `.rb-badge` | semantic variants |
| `Alert` | `.rb-alert` | variant + optional title (renders as a heading, replacing the native title tooltip attribute) |
| `Dialog` | `.rb-dialog` | native <dialog>; required open + onClose (onClose keeps the parent in sync after a native Escape close, so it must set open=false to reopen); optional actions; __body is a documented no-op in four themes (section 5.3) |
| `Tabs` | `.rb-tabs` | items: {id, label, content}[]; --active also matches [aria-selected="true"] in every theme; className/rest forward onto the tablist element -- ref targets the outer structural wrapper spanning tabs+panels (#84); optional controlled activeId/onChange pair mirroring NavRail, uncontrolled via defaultId when activeId is omitted (#169) |
| `Tabstrip` | `.rb-tabstrip` | top-level view nav (bordered pill buttons), distinct from Tabs' text-underline tabs inside a panel; controlled tabs/selected/onSelect + label; formerly a two-theme extra (arcane-obsidian/arcane-parchment) -- now a shared component in all fourteen, K4-10 give-back from Kenzen |
| — | `.rb-wordmark` | brand mark: an h1 in the display face with a solid-accent __spark; the text is gradient-clipped only where a theme rations --rb-accent-grad to the wordmark (arcane + kenzen pairs), solid --rb-text everywhere else; formerly a four-theme extra -- shared in all fourteen since #185; markup + class, no React wrapper |
| `DataTable` | `.rb-table` | columns/rows/rowKey; optional groupBy/groupOrder, defaultSortKey/defaultSortDirection, sticky (wraps in rb-table-scroll); numeric columns get rb-num; an inactive sortable header shows a muted rb-table__sort-icon affordance (#175), the active one shows the arrow instead; per-column width renders a <colgroup> and switches to table-layout: fixed (#150) |
| — | `.rb-table--interactive` | clickable-row utility, hand-applied by the consumer to any table (DataTable-rendered or not) -- DataTable itself never sets it, style directly |
| `Progress`/`Spinner` | `.rb-progress` | native <progress> pseudo-element contract enforced separately (not class-based); omit value for the animated :indeterminate state |
| `Stepper` | `.rb-stepper` | --upcoming is the resting state (allowlisted, no rule needed); --current also matches [aria-current="step"] in every theme |
| — | `.rb-muted` | style directly, no React wrapper |
| — | `.rb-pre` | style directly, no React wrapper |
| — | `.rb-log` | pairs with .rb-pre; style directly, no React wrapper |
<!-- contract-table:end -->

`LinksIndex` (React only, no CSS class of its own) composes `Card`/`Badge` into
a data-driven grouped index of links/apps — grouped by category with an
"Other" fallback, external URLs opening in a new tab. It carries no theme
obligation (just the primitives above), so it isn't in the table above — check
here before building a links/app index page from scratch. Its `level` prop
(default 2) sets the category heading level, with each card's heading one
level deeper — set it to match wherever LinksIndex is embedded. Each url's
list key is `label + url`, not `url` alone, so two urls sharing one address
with different labels ("prod" / "canonical") don't collide.

`EmptyState` (React only, no CSS class of its own) composes `Card` into
an empty-guidance surface: `title` (required heading, `level` 2-4, default
3), `children` as guidance, an optional `action` rendered last, `role="status"`
on the root. Like any live region it only announces a state that appears
or changes after mount (content loading in, then coming back empty) --
it says nothing on first paint, and reusing one instance for text that
changes on every keystroke (a live search query) would re-announce the
whole card on every character, so keep it for a stable empty state. It
never renders a spinner -- an empty state is a fact stated in words, so
use `Spinner` for loading and `EmptyState` for genuinely empty. Carries
no theme obligation, so it isn't in the table above.

Theme-specific extras (styled only under that theme — check before using): the
arcane pair adds `.rb-eyebrow`; the
rackbops pair adds `.rb-rack` (equaliser panel), `.rb-principles`/`.rb-principle`,
`.rb-tags`/`.rb-tag`, `.rb-btn__arrow`, `.rb-card__tag`, and `.rb-eyebrow` too;
the kenzen pair (`kenzen-midnight`, `kenzen-cyberhealth`) adds `.rb-eyebrow`;
the three nazuraki ports (`luminous-precision`, `neon-butterfly`,
`summer-cloud`) add `.rb-badge--primary`, `.rb-bg`, and `.rb-progress--accent`;
`summer-cloud` additionally adds `.rb-chip` and `.rb-card--floating`. Full
per-theme lists live in `styles/contract.json`'s `extras`. (`.rb-wordmark` and
`.rb-tabstrip`, once arcane/kenzen extras, are shared components in the table
above — safe under every theme.)

Visual reference: run `pnpm showcase` in the std-lib to render every component
per theme with a switcher.

## Adding a new theme

`pnpm new-theme <id> --scheme dark|light --from <closest-theme>` (issue #53)
scaffolds and registers it in one step: copies the closest theme's
`tokens.css`/`base.css`/`components/*.css`/`index.css` layout, re-guards every
selector to `data-rb-style="<id>"`, renames its `@keyframes` to a new short
prefix (verified against the source theme's real keyframe names, not just
guessed -- pass `--from-short` if it can't verify one, e.g. for the three
nazuraki ports), copies forward the source theme's `contract.json`
extras/allowlist/`dialogBackdropBlur`/`permittedLiterals` exceptions (a copied
theme inherits the source's per-theme documented omissions, like a nazuraki
port's `rb-dialog__body` gap, or class-parity fails -- a `"theme": "*"`
allowlist row, like `rb-stepper--upcoming`'s, already covers every theme and
is never cloned), registers it in
`styles/manifest.json`, `styles/package.json` (`files` + its 5 `exports`
keys), `styles/all.css`, `styles/contract.json`, and README.md's themes
table, and writes a `design.md` stub (Color table pre-filled with the copied
token values; every prose section marked `TODO`) -- then runs
`pnpm --filter @rackbops/styles test`.

Add `--pair <sibling>` for a light/dark counterpart pointer, `--port
<upstream-name>` for a ported theme (adds the attribution block and appends a
`NOTICE` bullet to that upstream's existing block), and `--force` to rebuild
an id that already exists (idempotent -- re-running never duplicates a
registration entry).

The script never designs the theme: it seeds `<id>` with the source theme's
literal palette/typography as a placeholder. Redesigning the tokens and
rewriting `design.md`'s prose is still a manual step (STANDARD.md 14.1).
Porting from nazuraki/ui-std-lib without an existing NOTICE block for that
upstream? Add the license block by hand first -- the script only appends to a
block that already exists.
