# summer-cloud

> **Source & attribution.** Ported from
> [`nazuraki/ui-std-lib`](https://github.com/nazuraki/ui-std-lib)'s
> `@nazuraki/styles` "summer-cloud" theme (MIT, Copyright (c) 2026 nazuraki — see
> the repo [`NOTICE`](../../NOTICE)), re-namespaced from `--nb-*` / `.nb-*` /
> `data-nb-style` to the rackbops `--rb-*` contract. The aesthetic below is
> nazuraki's; only the token/class names changed.

Light, airy, high-velocity retail aesthetic — "Airy Energetic." Frosted white
glass floating on a sky gradient, with a vivid violet doing all the work of
emphasis. Where neon-butterfly is a command console, summer-cloud is a summer
storefront: weightless, optimistic, effortless. Nothing sits flat on the page;
everything hovers.

Derived from the Stitch project *Summer Cloud UI System*
(`15973631330153907862`): Style Guide, Components Showcase, Retail Dashboard.

## Token mapping (dual accent + tinted shadows)

summer-cloud is a two-accent design; the rackbops baseline carries a single
`--rb-accent`. It also ships real shadow/tracking/pill tokens that fill baseline
slots the darker themes had to synthesize:

| Role | rackbops token | Value |
| --- | --- | --- |
| Primary / brand voice (violet) | `--rb-accent` (+ `--rb-accent-fg`, `--rb-accent-bright`, `--rb-accent-glow`, `--rb-accent-border`) | `#4500d9` |
| Active / secondary (sky blue) | `--rb-accent-2` (+ `--rb-accent-2-glow`, `--rb-accent-2-deep`) — theme extras | `#0cb3ff` |
| Glass tiers | `--rb-surface-glass` / `--rb-surface-glass-high` — extras | `0.6` / `0.8` white |
| Tinted shadows | `--rb-shadow-sm` / `--rb-shadow-lg` (+ `--rb-shadow-raised`, `--rb-shadow-raised-hover` extras) | primary-tinted |
| Display tracking | `--rb-heading-tracking` | `-0.02em` |

summer-cloud's shadow scale is airy by design: `--rb-shadow-sm` is a soft
`0 10px 30px` ambient (not the tight 1–3px the console themes use), and `.rb-card`
wears `--rb-shadow-lg` at rest — the "everything hovers" look. A shared component
written against the usual sm=resting / lg=elevated convention will read heavier
here; that is intended, not a bug.

## Color

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#f6fafe` | Flat page ground; the `.rb-bg` sky gradient runs `--rb-sky-start` `#f0f4f8` → `--rb-sky-end` `#c9e6ff` at 135°, `fixed` |
| Surface | `#ffffff` | Dialogs and fully opaque panels |
| Surface sunken | `#f0f4f8` | Inset form fields |
| Surface glass | `rgba(255,255,255,0.6)` + 12px blur | Cards, alerts (Level 1) |
| Surface glass high | `rgba(255,255,255,0.8)` + 20px blur | Floating/hover cards, modals (Level 2) |
| Text | `#171c1f` | Body text |
| Text faint | `#484457` | Secondary text, labels, idle nav |
| Accent (violet) | `#4500d9` | Headings, CTAs, active states, prices, progress |
| Accent bright | `#5d2bff` | Shadow/glow tint and primary hover fill |
| Accent-2 (sky blue) | `#0cb3ff` | Focus rings, secondary path, info — the interactive signal |
| Accent-2 deep | `#006492` | Sky blue as *text* (the bright value fails contrast) |
| Info | `#0cb3ff` | Informational callouts and badges |
| Success | `#30e330` | Switch "on" state — deliberately vibrant, the one high-energy pop |
| Warning | `#f2c025` | Caution states, "New" badges |
| Danger | `#ff4d4d` (retail red) | Errors, "Sale" badges, alert rules — carries dark text, never white |
| Danger deep | `#cc1f1f` | Danger where white text sits on it (destructive buttons) |
| Border | `rgba(255,255,255,0.4)` | Glass edges — the highlight that makes glass read as glass |
| Outline | `#c9c3da` | Hairlines on opaque surfaces (chips, table rules, checkboxes) |
| Sky tint | `rgba(255,255,255,0.7)` | Hover wash on ghost/nav elements |

Rules: the violet is the only loud color and carries emphasis alone — resting UI
is faint grey on white glass. Sky blue means "you can interact with this" (focus,
secondary actions, info). Never use pure black; never use a grey shadow. The
gradient is not decoration — on a flat white page the glass has nothing to be
glass against, and the theme collapses.

## Typography

Three voices, per the project's design system:

- **Display & headings:** Plus Jakarta Sans (600/700/800), letter-spacing
  `-0.02em` (`--rb-heading-tracking`) at display sizes — friendly rounded
  terminals, tucked in tight.
- **Body:** Inter 400, 16px/24px. Sentence case, always.
- **Data & labels:** JetBrains Mono 500, 12px, tracking `0.05em`
  (`--rb-label-tracking`). Field labels, badges, table headers, prices, metadata.
  Uppercase for badges and table headers (furniture); sentence case for field
  labels, which people read as words.

Interactive text (buttons, links, tabs) is Plus Jakarta Sans 600 at 14px,
sentence case. Uppercase never appears outside the mono voice.

Bare (unclassed) `h1`-`h6` carry the display voice directly — Plus Jakarta
Sans 700, `--rb-heading-tracking`, `--rb-space-3` margin below. Bare `p`
shares that margin; bare `ul`/`ol` add it too, with `--rb-space-4` marker
indent (real disc/decimal markers, not stripped).

The three webfonts are declared in `styles/manifest.json` (`summer-cloud.fonts`);
consumers load that stylesheet or self-host. Every stack falls back to a system
family.

## Shape & effects

- Radius `1rem` (16px) for cards, panels, and fields; **pills**
  (`--rb-radius-pill`) for every button, badge, and chip; `--rb-radius-sm`
  (`0.25rem`) minimum anywhere else. Never 0.
- Depth is **blur + tinted shadow**, never grey drop shadows. Shadows are tinted
  with `#5d2bff`: `--rb-shadow-lg` (`0 20px 40px rgba(93,43,255,0.08)`) at rest,
  `--rb-shadow-raised` (`0 4px 14px rgba(93,43,255,0.39)`) for raised CTAs.
- Two elevation tiers only — Level 1 glass (0.6 white / 12px blur) for content,
  Level 2 (0.8 white / 20px blur + lift) for interactive and floating things.
- **Bouncy, not linear.** Buttons scale to 1.03 on hover and 0.95 on press with
  `--rb-ease-bounce` (`cubic-bezier(0.34,1.56,0.64,1)`); floating cards translate
  `-4px`.
- Focus is a 4px sky-blue ring (`0 0 0 4px rgba(12,179,255,0.2)`), never an
  outline suppression without a replacement.
- Spacing is strictly multiples of 8px. When in doubt, add 8.
- Respect `prefers-reduced-motion` — every transform is dropped.

## Components

Class prefix `rb-` (shared across themes so `@rackbops/ui-react` stays
theme-agnostic). Variants use BEM-ish modifiers (`rb-btn--primary`).

- **Card** `.rb-card` — glass panel; `--floating` adds the Level 2 hover lift.
- **NavLink** `.rb-link` — pill, sky-tint wash, `→` slides 4px on hover;
  `--active` / `[aria-current=page]` becomes the violet underline rule.
- **Button** `.rb-btn` — glass by default; `--primary` (solid violet CTA, one
  per view), `--accent` (sky-edged glass), `--ghost`, `--danger`.
- **Form** `.rb-input`, `.rb-textarea`, `.rb-select`, `.rb-label`, `.rb-field`,
  `.rb-checkbox`, `.rb-radio`, `.rb-switch`, `.rb-choice` — sunken fields, no
  resting border, sky-blue ring on focus. The switch is the oversized
  "cloud-toggle": squishy, and green when live.
- **Badge** `.rb-badge` + semantic modifiers — solid pills, mono uppercase.
  **Chip** `.rb-chip` — outlined filter chip; `--selected` fills violet (a
  summer-cloud extra, beyond the shared component set).
- **Alert** `.rb-alert` — glass card with a 4px semantic left rule.
- **Dialog** `.rb-dialog` — native `<dialog>`, opaque white, blurred backdrop.
- **Tabs** `.rb-tabs`/`.rb-tab`/`.rb-tabpanel` — violet underline when active.
- **Table** `.rb-table` — mono uppercase headers, sky-tint row hover; add
  `.rb-num` to numeric cells for the mono/right-aligned treatment.
- **Progress** `.rb-progress`, **Spinner** `.rb-spinner` — glowing violet.

This port carries nazuraki's original component set (plus its `.rb-chip` and
`.rb-card--floating` extras); the rackbops-specific `eyebrow`, `tabstrip`,
`wordmark`, and `card--raised` surfaces are not part of it.

## Deviations from the Stitch source

*(nazuraki's own authoring record for this theme, carried over with the port — it
describes nazuraki's decisions when building summer-cloud, not the rackbops copy.)*

- The generated screens flattened all three type voices to Plus Jakarta Sans.
  This theme follows the project's written design system instead (Inter body,
  JetBrains Mono labels), the richer and intended spec.
- The project's stored theme carried an earlier palette (near-black primary
  `#01020e`, lavender secondary `#7248ae`). The rendered screens — all three, in
  agreement — use violet `#4500d9` and sky blue `#0cb3ff`. This theme matches the
  screens, since that is what Summer Cloud actually looks like.
- Tabs, table, dialog, and spinner do not appear in the source screens; they are
  extrapolated from the rules above to complete the component inventory.
- The source screens set white text on retail red (`#ff4d4d`), which is 3.27:1 —
  below AA at badge and button sizes. This theme keeps the vivid red and puts
  dark text on it (4.97:1), and uses `--rb-danger-deep` for the solid destructive
  button (5.55:1 on white). Every other foreground/background pair in the palette
  clears AA.

## Code syntax

Tokens `--rb-code-*` (theme extra). Palette hues deepened for contrast on white:
violet keywords, deep-green strings, deep-amber numbers, accent-deep functions,
deep-teal types, danger-deep variables, muted-faint comments, faint meta.

## Scoping

Every rule is guarded by `data-rb-style="summer-cloud"` (self or ancestor),
wrapped in zero-specificity `:where()`. Set the attribute on `<html>` for a page
or on a container for an embedded island.
