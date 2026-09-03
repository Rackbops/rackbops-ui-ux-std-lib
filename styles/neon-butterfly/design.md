# neon-butterfly

> **Source & attribution.** Ported from
> [`nazuraki/ui-std-lib`](https://github.com/nazuraki/ui-std-lib)'s
> `@nazuraki/styles` "neon-butterfly" theme (MIT, Copyright (c) 2026 nazuraki —
> see the repo [`NOTICE`](../../NOTICE)), re-namespaced from `--nb-*` / `.nb-*` /
> `data-nb-style` to the rackbops `--rb-*` contract. The aesthetic below is
> nazuraki's; only the token/class names changed.

Dark, mono-spaced, neon-accented terminal aesthetic. Deep navy backgrounds with
frosted-glass surfaces; lilac is the primary voice, neon lime the accent that
signals activity. Everything is uppercase, tracked-out JetBrains Mono — the UI
should feel like a beautiful command console, not a document.

## Token mapping (dual accent)

neon-butterfly is a two-accent design, but the rackbops baseline carries a single
`--rb-accent`. The mapping:

| Role | rackbops token | Value |
| --- | --- | --- |
| Primary / brand voice (lilac) | `--rb-accent` (+ `--rb-accent-fg`, `--rb-accent-glow`, `--rb-accent-border`) | `#d2bbff` |
| Active / critical (neon lime) | `--rb-accent-2` (+ `--rb-accent-2-glow`) — theme extra | `#39ff14` |
| Lit glass edge | `--rb-border-strong` | `rgba(255,255,255,0.25)` |
| Glass pane fill | `--rb-surface-glass` — theme extra | `rgba(23,31,51,0.55)` |

## Color

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#0b1326` | Page background (often blended over imagery with `luminosity`) |
| Surface | `#171f33` | Solid panels, inputs, dialogs |
| Surface glass | `rgba(23,31,51,0.55)` + 12px blur | Cards, nav links, alerts |
| Text | `#dae2fd` | Body text |
| Text faint | `#958da1` | Secondary text, labels, idle chevrons |
| Accent (lilac) | `#d2bbff` | Emphasis, hover states, active tabs, glow |
| Accent-2 (neon lime) | `#39ff14` | Activity signals: checked states, chevrons on hover, success |
| Info | `#4dc9ff` | Informational callouts and badges |
| Success | `#39ff14` | Shares the accent-2 hue — success *is* the neon signal |
| Warning | `#ffd23f` | Caution states |
| Danger | `#ff2d78` | Destructive actions, errors |
| Border | `rgba(255,255,255,0.1)` | All resting borders |

The signature page background is the butterfly-circuit artwork
(`assets/butterfly-circuit.png`) blended into the navy with `luminosity` — apply
via `.rb-bg` on `<body>`. Optional; plain `--rb-bg` navy is also correct.

Rules: color is communication — resting UI stays in navy/faint; lilac and lime
appear only on interaction or state. Never use pure white or pure black.

## Typography

- **Family:** JetBrains Mono (weights 450 regular, 700 bold; `--rb-font-weight`
  is 450, `--rb-font-weight-medium`/`-bold` are 700); fallback `ui-monospace`.
- **Interactive text** (buttons, links, tabs, labels, table headers): uppercase,
  700, 14px (labels/headers 11–12px), letter-spacing `0.1em` (`--rb-label-tracking`).
- **Body text:** sentence case, 450.
- **Bare tags:** unclassed `h1`-`h6` carry the mono voice at 700 (the same
  weight as everything else marked "interactive" — only 450/700 load), with
  the wide `--rb-heading-tracking` (`0.1em`) and `--rb-space-3` margin below.
  Bare `p` shares that margin; bare `ul`/`ol` add it too, with `--rb-space-4`
  marker indent (real disc/decimal markers, not stripped).

Webfonts (JetBrains Mono) are declared in `styles/manifest.json`
(`neon-butterfly.fonts`); consumers load that stylesheet or self-host, and the
token stack falls back to `ui-monospace`.

## Shape & effects

- Radius `0.5rem` everywhere (`--rb-radius` == `--rb-radius-lg`); pills
  (`--rb-radius-pill`) for switches/progress.
- Borders are 1px hairlines; emphasis comes from border *color*, not weight.
- Glow, not shadow: elevation is expressed with colored `box-shadow` glows
  (`rb-nb-pulse-glow` on hover) rather than dark drop shadows. `--rb-shadow-*`
  exist for baseline parity but the components lean on glow.
- Transitions 0.3s; hover motion is a 4px `translateX` slide on links.
- Respect `prefers-reduced-motion`.

## Components

Class prefix `rb-`. Variants use BEM-ish modifiers (`rb-btn--accent`).

- **Card** `.rb-card` — frosted glass panel.
- **NavLink** `.rb-link` — the switchboard link: `>` chevron turns lime on hover.
- **Nav rail** `.rb-nav-rail` — the sidebar container: 14rem fixed-width flex
  column, the same glass panel + blur as `.rb-card`, a hairline right edge.
  Composes with `.rb-link` for items; introduces no active-state convention
  of its own.
- **Button** `.rb-btn` — `--primary`, `--accent`, `--danger` variants; `--sm`
  compact size for inline/table-row actions; `.rb-icon-btn` a square icon-only
  hit target (>=2rem), paired with `.rb-btn`.
- **Form** `.rb-input`, `.rb-textarea`, `.rb-select`, `.rb-label`, `.rb-field`,
  `.rb-checkbox`, `.rb-radio`, `.rb-switch`, `.rb-choice` — checked states glow lime.
- **Badge** `.rb-badge` + semantic modifiers.
- **Alert** `.rb-alert` — left accent bar carries the semantic color.
- **Dialog** `.rb-dialog` — native `<dialog>`, lilac border + glow, blurred backdrop.
- **Tabs** `.rb-tabs`/`.rb-tab`/`.rb-tabpanel` — active tab underlined in lilac with text glow.
- **Table** `.rb-table` — lilac header rule, glass row hover. `--interactive`
  marks clickable rows: pointer cursor, plus a focus-visible ring (and the
  same glass wash) for a `tabindex` row or a row-wrapping button/link.
- **Progress** `.rb-progress`, **Spinner** `.rb-spinner` — glowing lilac indicators.
- **Stepper** `.rb-stepper` (+ `__step` / `__node` / `__label`, `--complete` /
  `--current` / `--upcoming`) — a milestone rail: complete nodes solid accent
  with a checkmark, current a surface-fill ring with an accent border, both
  the rail fill and the current node glowing with the same `--rb-accent-glow` box-shadow
  `.rb-progress`'s value fill uses. Upcoming reads faint surface-2; rail track is
  `surface` (matching how `.rb-progress` itself sits), and each connector
  segment picks up that same glow once its own step is reached (complete or
  current) -- no separate progress value to keep in sync with the step
  states.
- **Muted text** `.rb-muted` — faint secondary/empty-state text;
  `color: var(--rb-text-faint)` only, no italic — this theme's mono/uppercase
  terminal voice never reaches for a literary flourish.
- **Pre / log block** `.rb-pre` — command/log `<pre>`; sunken background,
  hairline border, radius, small mono, horizontal scroll. Pair with `.rb-log`
  (`<pre class="rb-pre rb-log">`) for multi-line streaming output: a capped
  16rem height with vertical scroll, wrapped lines instead of horizontal
  scroll, and roomier line-height for dense text.

This port carries nazuraki's original component set; the rackbops-specific
`eyebrow`, `tabstrip`, `wordmark`, and `card--raised` surfaces are not part of it.

## Code syntax

Tokens `--rb-code-*` (theme extra). Lilac keywords, neon-lime strings, gold
numbers, info-cyan functions, light-cyan types, softened-pink variables,
dimmed-faint comments, faint meta.

## Scoping

Every rule is guarded by `data-rb-style="neon-butterfly"` (self or ancestor),
wrapped in zero-specificity `:where()`. Set the attribute on `<html>` for a page
or on a container for an embedded island.
