# luminous-precision

> **Source & attribution.** Ported from
> [`nazuraki/ui-std-lib`](https://github.com/nazuraki/ui-std-lib)'s
> `@nazuraki/styles` "luminous-precision" theme (MIT, Copyright (c) 2026
> nazuraki — see the repo [`NOTICE`](../../NOTICE)), re-namespaced from `--nb-*` /
> `.nb-*` / `data-nb-style` to the rackbops `--rb-*` contract. The aesthetic below
> is nazuraki's; only the token/class names changed.

Professional, nocturnal evolution of neon-butterfly — "Luminous Precision".
Deep obsidian foundation, glassmorphic indigo surfaces, and light used as the
interaction language: instead of heavy borders, elements glow. Vibrant orchid
is the primary voice; electric teal marks active paths and critical signals.
Sora headlines over JetBrains Mono body give it a commanding, high-tech,
developer-console feel without going full terminal. Derived from the
InfraPulse Stitch mockups (Stitch project 18185577263375001507).

## Token mapping (dual accent)

luminous-precision is a two-accent design, but the rackbops baseline carries a
single `--rb-accent`. The mapping:

| Role | rackbops token | Value |
| --- | --- | --- |
| Primary / brand voice (orchid) | `--rb-accent` (+ `--rb-accent-fg`, `--rb-accent-glow`, `--rb-accent-border`) | `#c6a5ff` |
| Active / critical (electric teal) | `--rb-accent-2` (+ `--rb-accent-2-glow`) — theme extra | `#00f5ff` |
| Lit glass edge | `--rb-border-strong` | `rgba(255,255,255,0.2)` |
| Glass pane fill | `--rb-surface-glass` — theme extra | `rgba(26,29,41,0.4)` |

`--rb-accent-2*`, `--rb-surface-glass`, and `--rb-accent-border`/`--rb-accent-glow`
are theme extras (beyond the baseline set) that only this theme's own components
rely on.

## Color

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#0a0c10` (deep obsidian) | Page background; `.rb-bg` adds soft orchid/teal radial underlays |
| Surface | `#1a1d29` (indigo) | Solid panels, dialogs |
| Surface sunken | `#0c0e14` | Inset fields, log wells, progress troughs |
| Surface glass | `rgba(26,29,41,0.4)` + 12px blur | Cards, nav links, alerts |
| Text | `#e2e2eb` | Body text |
| Text faint | `#958e9b` | Secondary text, labels, idle tabs |
| Accent (orchid) | `#c6a5ff` | Primary buttons (solid fill), emphasis, glow |
| Accent-2 (teal) | `#00f5ff` | Active states, focus rings, success paths, list-edge bars |
| Info | `#83b7ff` | Informational callouts and chips |
| Success | `#47e34e` | Live/healthy status |
| Warning | `#ffb86c` (amber) | Caution states |
| Danger | `#ff4d6d` (rose) | Destructive actions, errors |
| Border | `rgba(255,255,255,0.08)` | Resting borders |
| Border strong | `rgba(255,255,255,0.2)` | Top edge of glass panes — simulates overhead light |

Rules: color is functional, never decorative. Resting UI stays obsidian/faint;
orchid and teal appear on interaction, focus, and state. Depth comes from
tonal layers and glow, not drop shadows. Never pure white or pure black.

## Typography

- **Headlines:** Sora (500 md / 600 lg / 700 xl), tight letter-spacing
  (−0.01 to −0.02em; `--rb-heading-tracking`); fallback `ui-sans-serif`.
- **Body & UI:** JetBrains Mono 400; fallback `ui-monospace`.
- **Labels & interactive text** (buttons, tabs, table headers): uppercase,
  600, 12–14px, letter-spacing `0.05em` (`--rb-label-tracking`).

Webfonts are declared in `styles/manifest.json` (`luminous-precision.fonts`);
consumers load that stylesheet (Sora + JetBrains Mono) or self-host. The token
stacks fall back to system families when the webfonts are absent.

## Shape & effects

- Radius `0.5rem` for buttons and inputs; `1rem` for cards, dialogs, and large
  containers. Pills (`--rb-radius-pill`) reserved strictly for chips/badges and
  switches.
- Glass panes: 1px hairline borders with a lighter top edge
  (`--rb-border-strong`) to simulate overhead lighting; `backdrop-filter` 12px.
- Focus is electric teal: inputs drop the resting border for a teal line plus
  soft teal outer glow.
- Elevation = glow (`rb-lp-pulse-glow` orchid, `rb-lp-pulse-glow-accent` teal),
  not dark shadows. `--rb-shadow-*` exist for baseline parity but the components
  lean on glow. Transitions 0.3s. Respect `prefers-reduced-motion`.
- 8px spacing rhythm; generous negative space so glows can breathe.

## Components

Class prefix `rb-` (shared token/class contract with the other themes).

- **Card** `.rb-card` — glass pane, 1rem radius, lit top edge.
- **NavLink** `.rb-link` — glass list row; hover shifts to solid indigo and
  lights a 2px teal bar on the left edge.
- **Button** `.rb-btn` — ghost by default; `--primary` is the one solid fill
  (orchid, dark text), `--accent` teal ghost, `--danger` rose ghost.
- **Form** `.rb-input`, `.rb-textarea`, `.rb-select`, `.rb-label`,
  `.rb-field`, `.rb-checkbox`, `.rb-radio`, `.rb-switch`, `.rb-choice` —
  checked/focus states glow teal.
- **Badge** `.rb-badge` — pill chip: 15% tint of its hue behind
  full-saturation text (+ semantic modifiers).
- **Alert** `.rb-alert` — glass, 3px left bar carries the semantic color.
- **Dialog** `.rb-dialog` — native `<dialog>`, indigo pane with orchid glow,
  Sora title, blurred obsidian backdrop.
- **Tabs** `.rb-tabs`/`.rb-tab`/`.rb-tabpanel` — active tab underlined in
  teal with text glow.
- **Table** `.rb-table` — lit header rule; row hover shifts glass and lights
  the teal left bar.
- **Progress** `.rb-progress`, **Spinner** `.rb-spinner` — glowing orchid
  indicators (`--accent` bar variant in teal).

This port carries nazuraki's original component set; the rackbops-specific
`eyebrow`, `tabstrip`, `wordmark`, and `card--raised` surfaces are not part of
it. It also keeps nazuraki's `.rb-badge--primary` variant (orchid pill), which
the other rackbops themes don't define — a `@roshne/ui-react` `Badge` never
emits it, so it is a theme extra, harmless where unused.

## Code syntax

Tokens `--rb-code-*` (theme extra). Orchid keywords, teal types, info-blue
functions, amber numbers, success-green strings, soft-rose variables,
dimmed-faint comments, faint meta — palette voices reused, never new hues for
decoration.

## Scoping

Every rule is guarded by `data-rb-style="luminous-precision"` (self or
ancestor), wrapped in zero-specificity `:where()`. Set the attribute on
`<html>` for a page or on a container for an embedded island.
