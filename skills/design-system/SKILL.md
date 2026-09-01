---
name: design-system
description: Use the rackbops ui/ux std-lib design system when building or restyling UI in roshne's apps. Trigger whenever creating pages, components, forms, dialogs, or styling in a repo that adopts a rackbops theme — the app should consume @rackbops/styles and @rackbops/ui-react rather than ad-hoc CSS or one-off components.
---

# Using the rackbops design system

roshne's apps standardize their UX on `rackbops-ui-ux-std-lib`
(github.com/roshne/rackbops-ui-ux-std-lib). Never write ad-hoc colors, fonts, or
component styles in an app that has adopted a theme — consume the system.

## Rules

1. **Tokens, not literals.** Use `--rb-*` custom properties for every color,
   font, radius, and spacing value. If a needed token doesn't exist, propose
   adding it to the std-lib rather than hardcoding.
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

Themes come as light/dark pairs: `arcane-obsidian` (dark) / `arcane-parchment`
(light) — the artifact-console developer console; and `rackbops-studio` (light) /
`rackbops-noir` (dark) — the rackbops editorial studio. All declare the same
`--rb-*` baseline and the same `rb-*` classes, so changing the attribute restyles
the app without touching markup. Fonts are system stacks for the app themes; the
ported themes (e.g. `luminous-precision`) declare webfont URLs in the manifest.

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

`@rackbops/styles/manifest` is the machine-readable roster — theme names and
scheme (`dark`/`light`). Validate configured theme names from it rather than
hardcoding a list. No-build / private-repo apps can consume the CSS via a git
dependency (jsDelivr can't serve a private repo).

## Component inventory

React exports (each renders the matching `rb-*` CSS class, usable directly in
non-React apps):

| React | CSS class | Notes |
| --- | --- | --- |
| `Button` | `.rb-btn` | variants: `primary`, `accent`, `danger`, `ghost` |
| `Card` | `.rb-card` | `raised` prop |
| `NavLink` | `.rb-link` | `active` prop |
| `Input`/`Textarea`/`Select` | `.rb-input` etc. | pair with `Field`/`Label` |
| `Checkbox`/`Radio`/`Switch` | `.rb-checkbox` etc. | `label` prop wraps in `.rb-choice` |
| `Badge` | `.rb-badge` | semantic variants |
| `Alert` | `.rb-alert` | `variant` + optional `title` |
| `Dialog` | `.rb-dialog` | native `<dialog>`, `open`/`onClose`/`actions` |
| `Tabs` | `.rb-tabs` | `items: {id, label, content}[]` |
| `Progress`/`Spinner` | `.rb-progress`/`.rb-spinner` | |
| — (CSS only) | `.rb-table`, `.rb-eyebrow` | style directly |

Theme-specific extras (styled only under that theme — check before using):
`arcane-obsidian` adds `.rb-wordmark` and `.rb-tabstrip`; `rackbops-studio` adds
`.rb-rack` (equaliser panel), `.rb-principles`/`.rb-principle`, and `.rb-tags`/`.rb-tag`.

Visual reference: run `pnpm showcase` in the std-lib to render every component
per theme with a switcher.

## Adding a new theme

Copy the `styles/arcane-obsidian/` layout: `tokens.css` (the full baseline
`--rb-*` set, every rule guarded by `data-rb-style="<name>"`, plus a
`color-scheme`), `base.css`, `components/*.css` (guarded selectors, theme-unique
`@keyframes` names), `index.css`, and a `design.md`. Then register it:

1. `styles/manifest.json` — name, scheme, fonts (empty for a system-font theme).
2. `styles/package.json` — add the directory to `files` and its four `exports`.
3. `README.md` — the themes table.

Run `pnpm --filter @rackbops/styles test` — the contract test enforces all of the
above and is the definition of done.
