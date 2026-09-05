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

## Consuming

Every rule is scoped: nothing applies until an element carries
`data-rb-style="<theme>"`. Put it on `<html>` for a page the app owns, or on a
mount container to theme one subtree (embed-safe: the CSS is inert everywhere
else, and the `:where()` guards are zero-specificity so any consumer rule
overrides). Several themes can load together; swapping is an attribute flip.

The full roster is 12 themes. Two pairs are reverse-documented from roshne's
own apps: `arcane-obsidian` (dark) / `arcane-parchment` (light) — the
artifact-console developer console; and `rackbops-studio` (light) /
`rackbops-noir` (dark) — the rackbops editorial studio. Three are ported
(credited) from nazuraki/ui-std-lib: `luminous-precision`, `neon-butterfly`,
`summer-cloud`. The remaining five are original: `concrete-signal` (dark) /
`concrete-signal-light` (light), `amber-hearth` (light) / `amber-ember` (dark),
and standalone `mono-field` (light, no dark sibling yet). All 12 declare the
same `--rb-*` baseline and the same `rb-*` classes, so changing the attribute
restyles the app without touching markup. Fonts are system stacks everywhere
except the three ported themes, which declare webfont URLs in the manifest.

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
| `NavRail` | `.rb-nav-rail` | composes .rb-link; owns no active convention |
| `Field`/`Label`/`Input`/`Textarea`/`Select`/`Checkbox`/`Radio`/`Switch` | `.rb-field` | pair with Field/Label; choice controls wrap in .rb-choice |
| `Badge` | `.rb-badge` | semantic variants |
| `Alert` | `.rb-alert` | variant + optional title |
| `Dialog` | `.rb-dialog` | native <dialog>; required open + onClose (onClose keeps the parent in sync after a native Escape close, so it must set open=false to reopen); optional actions; __body is a documented no-op in four themes (section 5.3) |
| `Tabs` | `.rb-tabs` | items: {id, label, content}[]; --active also matches [aria-selected="true"] in every theme |
| — | `.rb-table` | style directly, no React wrapper |
| `Progress`/`Spinner` | `.rb-progress` | native <progress> pseudo-element contract enforced separately (not class-based) |
| — | `.rb-muted` | style directly, no React wrapper |
| — | `.rb-pre` | style directly, no React wrapper |
| — | `.rb-log` | pairs with .rb-pre; style directly, no React wrapper |
| `Stepper` | `.rb-stepper` | --upcoming is the resting state (allowlisted, no rule needed); --current also matches [aria-current="step"] in every theme |
<!-- contract-table:end -->

`LinksIndex` (React only, no CSS class of its own) composes `Card`/`Badge` into
a data-driven grouped index of links/apps — grouped by category with an
"Other" fallback, external URLs opening in a new tab. It carries no theme
obligation (just the primitives above), so it isn't in the table above — check
here before building a links/app index page from scratch.

Theme-specific extras (styled only under that theme — check before using): the
arcane pair adds `.rb-wordmark`, `.rb-tabstrip`, and `.rb-eyebrow`; the
rackbops pair adds `.rb-rack` (equaliser panel), `.rb-principles`/`.rb-principle`,
`.rb-tags`/`.rb-tag`, `.rb-btn__arrow`, `.rb-card__tag`, and `.rb-eyebrow` too;
the three nazuraki ports (`luminous-precision`, `neon-butterfly`,
`summer-cloud`) add `.rb-badge--primary`, `.rb-bg`, and `.rb-progress--accent`;
`summer-cloud` additionally adds `.rb-chip` and `.rb-card--floating`. Full
per-theme lists live in `styles/contract.json`'s `extras`.

Visual reference: run `pnpm showcase` in the std-lib to render every component
per theme with a switcher.

## Adding a new theme

Copy the `styles/arcane-obsidian/` layout: `tokens.css` (the full baseline
`--rb-*` set, every rule guarded by `data-rb-style="<name>"`, plus a
`color-scheme`), `base.css`, `components/*.css` (guarded selectors, theme-unique
`@keyframes` names), `index.css`, and a `design.md`. Then register it:

1. `styles/manifest.json` — name, scheme, fonts (empty for a system-font theme).
2. `styles/package.json` — add the directory to `files` and its four `exports`.
3. `styles/all.css` — add `@import "./<name>/index.css";`.
4. `README.md` — the themes table.

Porting from nazuraki/ui-std-lib instead of designing an original theme? Also
credit it in `NOTICE`.

Run `pnpm --filter @rackbops/styles test` — the contract test enforces steps 1-3
(plus the CSS layout above); README.md and NOTICE aren't test-checked, so
double-check those by hand.
