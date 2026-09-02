# amber-hearth

An original rackbops theme — warm, hand-crafted editorial design. Clay-terracotta
accent on a warm cream ground, the most generously rounded shape language in the
library, and warm-toned diffused shadows (brown-tinted, never neutral black).
This is the library's **only serif display voice**: headings, card and dialog
titles use a system serif stack, while body copy and UI chrome (buttons, labels,
table text) stay on a humanist system-ui sans. Transitions run a touch slower
than the library default (`0.18s` vs `0.15s`) to read as unhurried and cozy, and
the one clay -> amber -> gold gradient is rationed to a single place — the
active-tab underline — exactly as sparingly as the library's other gradient
themes ration theirs. Light ("Hearth") is the primary look; its dark
counterpart ("Ember") ships as its own theme, documented below.

## Color

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#fbf3e9` (warm cream) | Page canvas |
| Surface | `#ffffff` | Cards, dialogs, panels |
| Surface 2 | `#f5e9d9` | Raised/hover surface, active-tab wash base |
| Surface sunken | `#efe1cd` | Inset fields, progress troughs |
| Text | `#2b1f14` | Body text |
| Text soft | `#5c4a38` | Secondary text |
| Text faint | `#6e5945` | Labels, table headers, meta |
| Border | `#e6d3ba` | Resting hairline borders |
| Border strong | `#d1b98f` | Dialog edges, header rules |
| Accent | `#b5542c` (clay-terracotta, darkened for AA) | The sole brand voice: emphasis, active state, focus (4.67:1 as accent-fg text) |
| Accent fg | `#fff8f0` | Warm-white ink on the solid clay fill |
| Accent wash | `rgba(181,84,44,.14)` | Active/hover tint behind accent text |
| Info | `#3c7ba3` | Informational chips (4.61:1 on white) |
| Success | `#497f4b` | Healthy/live status (4.75:1 on white) |
| Warning | `#9c6b22` | Caution status (darkened from `#c8892c`, 2.97:1, to 4.63:1 on white) |
| Danger | `#b8412a` | Destructive actions, errors (5.49:1 on white) |

**Rules.** Colour is functional. Resting UI is cream, white, and warm neutral
ink; clay-terracotta appears only on interaction, focus, active state, and
emphasis. Colour beyond the accent is *earned* — severity and status badges are
the one place other hues appear. The accent and all four semantic hues are
tuned so every text/border use clears WCAG AA (4.5:1) against `--rb-surface`
(white) — info, success, and warning were all originally under 4.5:1 and were
darkened accordingly; danger already cleared. The one gradient
(`--rb-accent-grad`, clay -> amber -> gold) is rationed to exactly one place
across the whole theme — the active-tab underline — never spent twice; the
progress fill and every other surface stay solid.

## Typography

- **Display / headings:** a system serif stack (`"Iowan Old Style", "Palatino
  Linotype", Palatino, Georgia, serif`), weight 700, tight tracking
  (`-0.01em`). This is the library's only serif voice — reserved for headings,
  card titles, and dialog titles.
- **Body & UI:** `system-ui, -apple-system, "Segoe UI", Roboto, …`, weight 400.
  Buttons, labels, and table text stay on this sans voice even where a heading
  nearby goes serif.
- **Labels:** normal-case, weight 600 (`--rb-font-weight-medium`), tracked
  `0.04em`. No uppercase-shouty labels anywhere in this theme.
- **Bare tags:** unclassed `h1`-`h6` pick up the serif display voice directly
  — weight 700, tracking `-0.01em`, `--rb-space-3` margin below,
  `line-height: 1.2`. Bare `p` shares that margin; bare `ul`/`ol` add it too,
  with `--rb-space-4` marker indent (real disc/decimal markers, not stripped).

## Shape & effects

- Radius `0.875rem` (14px) for buttons, inputs, and rows; `1.25rem` (20px) for
  cards and dialogs; true pills for badges and progress troughs — the most
  generously rounded theme in the library.
- Shadows are warm-toned and diffused: `rgba(80,50,20,…)` brown-tinted, soft
  normal-blur shadows — never a neutral-black hard offset shadow. `shadow-sm`
  resting, `shadow-lg` for raised cards and dialogs.
- Transitions `0.18s` — softer and slightly slower than the library default
  (`0.15s`), so hovers and focus changes read as unhurried rather than snappy.
  Every animation and transition respects `prefers-reduced-motion`.
- Focus is the accent: inputs swap their border for a clay line plus a soft
  `--rb-accent-wash` ring.
- 4px spacing rhythm (`--rb-space-1..5`).

## Components

Class prefix `rb-`; shared token/class contract with the other themes. No
`--rb-code-*` syntax tokens — this isn't a developer-console theme.

- **Button** `.rb-btn` — soft surface-2 ghost by default, sans (not serif);
  `--primary` is the one solid clay fill with a soft shadow-lift on hover (no
  hard transform), `--accent` a clay-wash chip, `--danger` a rose-tinted ghost,
  `--ghost` chromeless. `--sm` is a snugger size for inline and table-row
  actions — tighter padding, a hair smaller type. `.rb-icon-btn` is a square
  icon-only hit target (>=2rem), paired with `.rb-btn`.
- **Card** `.rb-card` (+ `--raised`) — solid panel, hairline border, warm
  diffused shadow; any `h1`-`h3` inside goes serif and bold.
- **NavLink** `.rb-link` — sidebar row; hover fills to surface-2 and lights a
  soft, fully-rounded 3px accent bar on the left edge (rounded to match the
  row's own character, not a hard-edged rule); `--active` carries the accent
  wash.
- **Nav rail** `.rb-nav-rail` — the sidebar container: 14rem fixed-width flex
  column, surface background, a hairline right edge. Composes with `.rb-link`
  for items; introduces no active-state convention of its own.
- **Form** `.rb-input` / `.rb-textarea` / `.rb-select` / `.rb-label` /
  `.rb-field` / `.rb-choice` / `.rb-checkbox` / `.rb-radio` / `.rb-switch` —
  sunken fields; focus swaps to the accent border + soft wash ring; labels
  normal-case, weight 600, sans.
- **Badge** `.rb-badge` — true pill: a 16% tint of its hue behind
  full-strength text (semantic modifiers `--info/--success/--warning/--danger`);
  normal-case, weight 600.
- **Alert** `.rb-alert` — surface panel, 3px left bar carries the semantic
  colour.
- **Dialog** `.rb-dialog` — native `<dialog>`, generously rounded panel,
  blurred backdrop (`backdrop-filter: blur(var(--rb-blur))`), serif bold title.
- **Tabs** `.rb-tabs` / `.rb-tab` / `.rb-tabpanel` — normal-case text tabs; the
  active tab is accent-coloured, underlined with the theme's one rationed
  gradient — the only place `--rb-accent-grad` appears in this theme.
- **Table** `.rb-table` (+ `.rb-num`) — faint header rule, tabular numerals,
  row hover to surface-2 with the theme's own soft transition, normal-case
  weight-600 headers. `--interactive` marks clickable rows: pointer cursor,
  plus a focus-visible ring (and the surface-2 wash) for a `tabindex` row or a
  row-wrapping button/link.
- **Progress / Spinner** `.rb-progress` / `.rb-spinner` — sunken trough with a
  solid accent fill (the gradient stays reserved for tabs); the spinner is a
  single accent arc (`rb-hearth-spin`).
- **Muted text** `.rb-muted` — faint secondary/empty-state text;
  `color: var(--rb-text-faint)`, italic — fits this warm, hand-crafted,
  unhurried editorial voice.
- **Pre / log block** `.rb-pre` — command/log `<pre>`; sunken background,
  hairline border, radius, small mono, horizontal scroll. Pair with `.rb-log`
  (`<pre class="rb-pre rb-log">`) for multi-line streaming output: a capped
  16rem height with vertical scroll, wrapped lines instead of horizontal
  scroll, and roomier line-height for dense text.

## Dark counterpart

`amber-ember` — the dark, espresso-ground counterpart. This theme and it share
the same `--rb-*` baseline and `rb-*` classes, so switching `data-rb-style`
between them restyles a page without touching markup.

## Scoping

Every rule is guarded by `data-rb-style="amber-hearth"` (self or ancestor),
wrapped in zero-specificity `:where()`. Set the attribute on `<html>` for a page
or on a container for an embedded island.
