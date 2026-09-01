# mono-field

The library's deliberately restrained theme — a quiet foil to the glow,
gradient, and neon themes elsewhere in the roster. Near-flat grayscale
surfaces carry close to zero visual flourish: hierarchy comes from thin 1px
hairline borders and generous spacing rather than color contrast between
surface layers, shadows are barely perceptible, there is no glass and no
glow, and type stays small, tight, and system-ui with no uppercase tricks
anywhere — no shouty labels, everything stays normal sentence/title case. The
accent is a near-black ink-blue rather than any saturated hue — just enough
to be findable as "the interactive color" without ever reading as
decoration. This is a **standalone** theme: it ships no light/dark pair and
has no ported or reverse-documented source — it is purpose-built directly to
the library's `--rb-*` contract.

## Color

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#ffffff` | Page canvas |
| Surface | `#ffffff` | Cards, dialogs, default buttons — same as bg |
| Surface 2 | `#f7f7f7` | Link/row hover, the alert panel — the one non-white fill |
| Surface sunken | `#f0f0f0` | Inset fields, progress trough |
| Text | `#111111` | Body text |
| Text soft | `#5a5a5a` | Secondary text, labels |
| Text faint | `#6b6b6b` | Meta, table headers |
| Border | `#e0e0e0` | Resting hairline borders |
| Border strong | `#c4c4c4` | Hover/emphasis borders |
| Accent | `#1d2733` (near-black ink-blue) | The sole interactive color: buttons, focus, active state |
| Accent fg | `#ffffff` | White ink on the solid accent fill |
| Accent wash | `rgba(29,39,51,.06)` | Focus ring — deliberately barely-there |
| Info | `#4a6fa5` | Informational chips (desaturated vs. the rest of the roster; 4.77:1 on surface-2) |
| Success | `#3f7d4f` | Positive status (desaturated; 4.60:1 on surface-2) |
| Warning | `#91681b` | Caution status (desaturated; darkened from `#a9791f`, 3.60:1, to 4.67:1 on surface-2) |
| Danger | `#a13a3a` | Destructive/error (desaturated; 6.16:1 on surface-2) |

**Rules.** Visual hierarchy comes from thin 1px hairline borders and spacing,
not from color contrast between surface layers — `--rb-surface` equals
`--rb-bg`, and `--rb-surface-2` is spent in exactly two places (link/row
hover, the alert panel). Even the required semantic status colors are
desaturated compared to how other themes in the library render them, to keep
this theme's voice consistently quiet. Colour beyond the accent is earned,
and the accent itself is spent sparingly — never for decoration.

## Typography

- **Display & body:** the system-ui stack
  (`system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif`)
  for both — there is no separate display voice.
- **Mono:** `ui-monospace, "Cascadia Code", …` reserved for the `--rb-font-mono`
  token; the baseline component set doesn't render code.
- **Weight:** 400 body, 500 medium (labels, buttons, badges, table headers),
  600 bold — this theme never goes past 600; there is no true bold-800 weight
  anywhere, part of the quiet voice.
- **Case:** normal sentence/title case everywhere. Buttons, badges, labels,
  and table headers are never uppercase — unusual among the library's themes,
  but consistent with this one's no-shouting rule.
- **Size & tracking:** small and tight — `--rb-text-sm` is 13px,
  `--rb-heading-tracking` is `-0.005em`, `--rb-label-tracking` is `0.02em`.
- **Bare tags:** unclassed `h1`-`h6` pick up the same system-ui voice as the
  body (weight 600, tracking `-0.005em`, `--rb-space-3` margin below,
  relaxed `line-height: 1.3` — quiet, not tight). Bare `p` shares that
  margin; bare `ul`/`ol` add it too, with `--rb-space-4` marker indent (real
  disc/decimal markers, not stripped).

## Shape & effects

- Radius `0.25rem` for buttons, inputs, and alerts; `0.375rem` for cards and
  dialogs; pills for badges and the progress trough.
- Shadows are barely perceptible (`--rb-shadow-sm` resting, `--rb-shadow-lg`
  for raised cards, dialogs, and the primary button's hover state) — no
  glass, no glow, anywhere in this theme.
- Focus is a plain 2px accent outline on buttons and choice controls; form
  fields instead swap their border to accent and add a thin accent-wash ring
  (the wash token itself is only 6% alpha, so the ring reads as barely-there,
  consistent with the theme). Nav-link rows (`.rb-link`) don't carry a
  themed focus style — matching this library's existing baseline (e.g.
  arcane-obsidian) — so keyboard focus there falls back to the browser's
  default outline.
- The **one gradient** (`--rb-accent-grad`, a subtle two-stop near-grayscale
  ramp) is rationed to exactly one place: the active-tab underline. It
  appears nowhere else — primary buttons stay a solid accent fill, never the
  gradient.
- Transitions `0.12s` — quick, not showy. Every transition and animation
  respects `prefers-reduced-motion`.
- Spacing rhythm `--rb-space-1..5` (0.25rem to 1.5rem).

## Components

Class prefix `rb-`; shared token/class contract with the other themes. Only
the baseline ten — no theme extras.

- **Button** `.rb-btn` — plain bordered ghost on white by default;
  `--primary` is the one solid accent fill (barely-there shadow lift on
  hover, no transform, no lift); `--accent` an accent-wash chip; `--danger` a
  danger-colored ghost; `--ghost` chromeless.
- **Card** `.rb-card` (+ `--raised`) — white panel; the hairline border does
  most of the definition work since surface equals bg.
- **NavLink** `.rb-link` — sidebar/tree row; hover fills to surface-2 (the
  one non-white fill besides the alert) and lights a thin 2px accent bar on
  the left edge on hover/active.
- **Form** `.rb-input` / `.rb-textarea` / `.rb-select` / `.rb-label` /
  `.rb-field` / `.rb-choice` / `.rb-checkbox` / `.rb-radio` / `.rb-switch` —
  sunken fields; focus swaps to the accent border plus a barely-there wash
  ring; labels are normal case, weight 500.
- **Badge** `.rb-badge` — pill, normal case (unusual for a badge, but matches
  this theme's no-shouting rule), weight 500, a 12%-alpha tint of its hue
  behind full-strength (but desaturated) text.
- **Alert** `.rb-alert` — surface-2 panel, a rare use of the theme's one
  non-white surface so a flagged message reads as such; a thin 2px semantic
  left bar (not a bold 3-6px bar).
- **Dialog** `.rb-dialog` — native `<dialog>`, white pane, subtle shadow, a
  light blurred backdrop over a lighter-than-usual `rgba(0,0,0,.3)` scrim,
  normal-case weight-600 title.
- **Tabs** `.rb-tabs` / `.rb-tab` / `.rb-tabpanel` — normal-case text tabs;
  the active tab is accent-colored and underlined with the theme's one
  rationed gradient.
- **Table** `.rb-table` (+ `.rb-num`) — faint header rule, tabular numerals,
  row hover to surface-2, normal-case weight-500 headers (never uppercase).
- **Progress / Spinner** `.rb-progress` (+ `__bar`) / `.rb-spinner` — sunken
  trough, solid accent fill (no gradient here — that stays rationed to tabs
  only).

## Scoping

Every rule is guarded by `data-rb-style="mono-field"` (self or ancestor),
wrapped in zero-specificity `:where()`. Set the attribute on `<html>` for a
page or on a container for an embedded island.
