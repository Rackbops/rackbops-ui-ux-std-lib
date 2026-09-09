# kenzen-midnight

Kenzen-sei's own brand, original to this library and reverse-measured from
the mascot concept sheet's cyber-health palette (Code Stream Koi, Komainu
guardian, status shields — `Rackbops/kenzen`'s `brand/source/`, per
[rackbops-ui-ux-std-lib#158](https://github.com/Rackbops/rackbops-ui-ux-std-lib/issues/158)).
Dark ("Midnight") is the primary look; a light counterpart ("Cyberhealth"),
sharing this theme's exact palette under a documented contrast exception
(#171), is documented at the end. Five signature traits: a deep navy
chassis with tonal navy surfaces, a single vibrant-teal accent voice, three
status shields (mint/amber/crimson) that never carry meaning through colour
alone, luminance-first depth with a restrained shadow ramp (no glow, no
glass), and a geometric-sans display face (Sora) over a plain system-ui body
with tabular numerals. Labels — badges and eyebrows — read mono, uppercase,
and tracked (`0.06em`); headings and the wordmark use the Sora display face
at its medium weight with the display voice's tighter `-0.01em` tracking, not
the label voice's wide `0.06em`. Table headers are the one stated exception,
body-sans and normal case, matching the arcane pair's own convention.

## Color

Values are the dark ("Midnight") scheme; the light ("Cyberhealth")
counterpart is tabled at the end. Palette measured from `Rackbops/kenzen`'s
brand source images (koi/shield artwork), not from any shipped app CSS — no
Kenzen release has used this theme yet.

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#0a2038` (deep navy) | Page canvas |
| Surface | `#102a48` | Cards, header, panels |
| Surface 2 | `#183456` | Raised/hover surface, active tab wash base |
| Surface sunken | `#081a2e` | Inset fields, log wells, progress troughs |
| Text | `#e8e8e8` | Body text |
| Text soft | `rgba(232,232,232,.82)` | Secondary text |
| Text faint | `rgba(232,232,232,.6)` | Labels, table headers, meta |
| Border | `rgba(232,232,232,.14)` | Resting hairline borders |
| Border strong | `rgba(232,232,232,.28)` | Dialog edges, header rules |
| Accent | `#18c0d0` (vibrant teal) | The sole brand voice: emphasis, active state, focus |
| Accent strong | `#5fe0ec` | Hover/active on `--primary` (lightens toward white — the dark-scheme convention) |
| Accent fg | `#0a2038` | Dark navy ink on the solid teal fill (AA) |
| Accent wash | `rgba(24,192,208,.16)` | Active/hover tint behind accent text |
| Info | `#5fb0e8` | Informational chips |
| Success | `#50f8a0` (mint) | Healthy/live status — the "healthy" shield's colour |
| Warning | `#f0b030` (amber) | Caution status — the "attention" shield's colour |
| Danger | `#d02030` (crimson) | Destructive actions, errors — the "vulnerability" shield's colour |

**Rules.** Colour is functional. Resting UI is navy and faint; teal appears
only on interaction, focus, active state, and emphasis. Colour beyond the
accent is *earned* — severity and status chips are the one place other hues
appear, and status is never colour-only (badges/alerts carry text, per
STANDARD.md 9). The dark resting palette never uses pure white or pure
black. Muted-on-surface is tuned to clear WCAG AA (4.5:1) on every surface.
`--rb-info` has no counterpart in the source concept sheet (the mascot's
three shields are healthy/vulnerable/attention only) — a distinct blue was
picked for informational chips, kept clearly separate in hue from the teal
accent and the three status colours.

## Typography

- **Display / wordmark:** Sora (`"Sora", ui-sans-serif, system-ui,
  sans-serif`) — a geometric sans already in the roster (shared with
  luminous-precision, so this spends no new webfont budget), weight 600,
  tight tracking (`-0.01em`).
- **Body & UI:** `system-ui, -apple-system, "Segoe UI", Roboto, …`, weight 400.
- **Numerals:** `font-variant-numeric: tabular-nums` everywhere data is shown.
- **Labels** (eyebrows, badges): mono (`ui-monospace, …`), uppercase, ~11px,
  tracked `0.06em` — same label voice as the arcane pair this was scaffolded
  from. Table headers are the one stated departure — body-sans, normal case
  (`components/table.css:9-15`; badges stay mono uppercase, `badge.css:10-14`).
- **Bare tags:** unclassed `h1`-`h6` pick up the Sora display voice directly —
  weight 600, tracking `-0.01em`, `--rb-space-3` margin below. `.rb-card`
  renders a bare `<h3>` and gets this treatment too, since `card.css` declares
  no heading rule of its own. Bare `p` shares that margin; bare `ul`/`ol` add
  it too, with `--rb-space-4` marker indent (real disc/decimal markers, not
  stripped).

## Shape & effects

- Radius `0.4375rem` (7px) for buttons, inputs, and rows; `0.75rem` (12px) for
  cards and dialogs; pills reserved for chips/badges and progress troughs —
  the arcane pair's own radii, per the issue's "radius/spacing per the arcane
  pair unless the mockups say otherwise."
- Depth is luminance-first: tonal surface layers do most of the work, with a
  two-step shadow ramp (`--rb-shadow-sm` resting, `--rb-shadow-lg` for dialogs
  and raised cards). No glow, no glass on resting UI.
- Focus is the accent: inputs swap their border for a teal line plus a soft
  `--rb-accent-wash` ring; interactive elements take the `--rb-focus-ring`
  outline (`2px solid var(--rb-accent)`).
- The **one gradient** (`--rb-accent-grad`, teal → mint) is rationed to
  exactly two places: the wordmark and the active-tab underline. It runs at
  full brand saturation independent of the AA-adjusted `--rb-accent` below,
  since a gradient is never itself a tested contrast-pair token. Primary
  buttons stay a solid AA-safe accent fill — never the gradient.
- Transitions `0.15s` (`--rb-transition`), `--rb-ease` timing. Every animation
  and transition respects `prefers-reduced-motion`.
- 4px spacing rhythm (`--rb-space-1..5`).

## Accessibility

The token pairs `styles/test/contrast.test.mjs` computes — `--rb-text` /
`--rb-text-soft` on their surfaces, `--rb-accent-fg` on `--rb-accent`,
`--rb-accent` as non-text on `--rb-bg`, and `--rb-text-faint` on
`--rb-surface`/`--rb-bg` — all clear their WCAG targets (4.5:1 text, 3:1
non-text) on this theme. No deviations on the automated fixed pairs.

Two things worth stating that the fixed-pair test does not check, because the
issue's acceptance bullet asked for status-colour ratios explicitly (computed
by hand, `styles/test/contrast.test.mjs`'s own formula, reproduced in a
throwaway script — not asserted as anything, this is documentation only):

- **Status as large UI accents on `--rb-bg`:** success 11.97:1, warning
  8.58:1 — both comfortably clear AA (4.5:1) even as plain text. **Danger is
  the exception: 3.08:1** — crimson and navy sit close in luminance on this
  theme, so `--rb-danger` clears the 3:1 non-text floor (a border, an icon)
  but not the 4.5:1 STANDARD.md 9 sets for a control label, which is exactly
  what `.rb-btn--danger` uses it for (`color: var(--rb-danger)` on the
  ghost button's label, `components/button.css:64`). This is not a
  regression unique to kenzen: neither `contract.json`'s fixed pairs nor any
  existing theme's `design.md` holds status colours to this bar as button
  text, and arcane-parchment's own `--rb-danger` (`#d64550`) on its `--rb-bg`
  is 4.06:1 — also under 4.5:1 — shipped with no equivalent note. Recorded
  here rather than silently repeated, and filed as
  [rackbops-ui-ux-std-lib#163](https://github.com/Rackbops/rackbops-ui-ux-std-lib/issues/163)
  since fixing it (a token change, a component-CSS change, or a documented
  allowlist entry, decided per theme) is out of this PR's scope — it
  predates kenzen and affects other themes too.
- **Status as small badge text on its own 16% tint fill** (`badge.css`'s
  `color-mix(in srgb, var(--rb-x) 16%, transparent)`, composited over
  `--rb-bg`): success 7.91:1, warning 6.36:1, info 5.17:1, **danger 2.89:1
  — below AA**, the same crimson-on-navy proximity as above, compounded by
  the 16% tint. Per STANDARD.md 9 ("semantic colours as small text ... often
  below AA ... a theme renders them as a tint fill with ink text ... rather
  than as text") this is the same class of documented exception
  arcane-parchment already carries for its own semantic chips — badges
  always carry a text label (never colour-only, STANDARD.md 9), so the
  colour is reinforcement, not the sole signal.

## Components

Class prefix `rb-`; shared token/class contract with the other themes, per
STANDARD.md section 5.1.

- **Button** `.rb-btn` — surface-2 ghost by default; `--primary` is the one
  solid teal fill (dark-navy ink), `--accent` a teal-wash chip, `--danger` a
  rose ghost, `--ghost` chromeless. `--sm` is a compact size for inline and
  table-row actions. `.rb-icon-btn` is a square icon-only hit target
  (>=2rem). **Pair divergence, documented per STANDARD.md 5.2:**
  `components/button.css`'s `--primary` hover/focus-visible fill differs
  from kenzen-cyberhealth's by direction, not just value — this theme
  lightens toward white (`color-mix(in srgb, var(--rb-accent) 88%, #fff)`,
  matching arcane-obsidian's own dark-scheme convention), while the light
  counterpart darkens toward `--rb-text` instead, because lightening on a
  light ground would drop the white label below AA (see
  kenzen-cyberhealth's own design.md for its exact ratio).
- **Card** `.rb-card` (+ `--raised`) — solid panel, hairline border, shadow-sm.
- **NavLink** `.rb-link` — tree/sidebar row; hover fills to surface-2 and lights a
  2px accent bar on the left edge; `--active` carries the accent wash.
- **Nav rail** `.rb-nav-rail` — the sidebar container: 14rem fixed-width flex
  column, surface background, a hairline right edge. Composes with `.rb-link`
  for items; introduces no active-state convention of its own.
- **Form** `.rb-input` / `.rb-textarea` / `.rb-select` / `.rb-label` / `.rb-field`
  / `.rb-choice` / `.rb-checkbox` / `.rb-radio` / `.rb-switch` — sunken fields
  on the navy ground; focus swaps to the accent border + wash ring; controls
  use `accent-color`.
- **Badge** `.rb-badge` — mono uppercase pill: a 16% tint of its hue behind
  full-strength text (semantic modifiers `--info/--success/--warning/--danger`
  — see Accessibility above for the one deviation). **Pair divergence,
  documented per STANDARD.md 5.2:** `components/badge.css`'s default,
  `--success`, and `--warning` variants keep colour-on-tint here since this
  theme's exact hexes all pass on navy; kenzen-cyberhealth's light-ground
  version of the same file uses ink (`--rb-text`) as those variants' text
  colour instead, because the exact hexes are far below AA there (see
  kenzen-cyberhealth's own design.md, #171, for the ratios).
- **Alert** `.rb-alert` — surface panel, 3px left bar carries the semantic colour.
- **Dialog** `.rb-dialog` — native `<dialog>`, navy pane, blurred backdrop,
  Sora title.
- **Tabs** `.rb-tabs` / `.rb-tab` / `.rb-tabpanel` — text tabs; the active tab is
  accent, underlined with the rationed gradient.
- **Tabstrip** `.rb-tabstrip` (+ `__tab`, `--active`, `__badge`) — top-level view
  nav: bordered pill buttons on surface-2; the active tab gets accent text, an
  accent-tinted border, and the accent wash; an optional trailing badge in
  faint text.
- **Table** `.rb-table` (+ `.rb-num`) — dense data table, faint header rule,
  tabular numerals, row hover to surface-2. `--interactive` marks clickable
  rows: pointer cursor, plus a focus-visible ring (and the surface-2 wash) for
  a `tabindex` row or a row-wrapping button/link. `DataTable` (the React
  component) adds `__group-row` for a labelled group-header row, `__sort` for
  the clickable sort-header button, and the separate top-level
  `.rb-table-scroll` for a sticky-header scroll wrapper.
- **Progress / Spinner** `.rb-progress` / `.rb-spinner` — sunken trough with an
  accent fill; the spinner is a single accent arc.
- **Muted text** `.rb-muted` — faint secondary/empty-state text;
  `color: var(--rb-text-faint)`, italic.
- **Pre / log block** `.rb-pre` — command/log `<pre>`; surface-sunken
  background, hairline border, radius, small mono, horizontal scroll. Pair
  with `.rb-log` (`<pre class="rb-pre rb-log">`) for multi-line streaming
  output: a capped 16rem height with vertical scroll, wrapped lines instead
  of horizontal scroll, and roomier line-height for dense text. Kenzen has no
  current use for either — carried over from the arcane pair this was
  scaffolded from, token-driven so it costs nothing to keep contract-complete.
- **Stepper** `.rb-stepper` (+ `__step` / `__node` / `__label`, `--complete` /
  `--current` / `--upcoming`) — a milestone rail: complete nodes solid accent
  with a checkmark, current a surface-fill ring with an accent border and a
  `shadow-lg` lift, upcoming faint surface-2 (`--upcoming` is the universal
  resting-state allowlist entry every theme carries, STANDARD.md 5.1).

### Theme extras

Carried over from the arcane pair this was scaffolded from — token-driven, so
they render correctly with no further edits, though Kenzen's own app does not
currently use either:

- **Wordmark** `.rb-wordmark` (+ `__spark`) — Sora h1 with the gradient clipped
  into the text; the spark mark stays solid accent.
- **Eyebrow** `.rb-eyebrow` — small mono uppercase section label in the accent,
  wide-tracked.

## Light counterpart — "Cyberhealth"

The light secondary, shipped as its own theme: `kenzen-cyberhealth`
(`styles/kenzen-cyberhealth/design.md`). It shares this theme's exact accent,
success, and warning hexes rather than a darkened substitute — roshne's
decision, [#171](https://github.com/Rackbops/rackbops-ui-ux-std-lib/issues/171)
— under a documented contrast exception (see that theme's own Accessibility
section for the ratios and mitigations).

| Role | Value |
| --- | --- |
| Background | `#ffffff` |
| Surface | `#f4f6f8` |
| Surface 2 | `#e8e8e8` |
| Surface sunken | `#edeff3` |
| Text | `#0a2038` |
| Text soft | `rgba(10,32,56,.82)` |
| Text faint | `rgba(10,32,56,.6)` |
| Border | `rgba(10,32,56,.14)` |
| Border strong | `rgba(10,32,56,.28)` |
| Accent | `#18c0d0` (exact, same as this theme — see kenzen-cyberhealth's own design.md for the documented exception) |
| Accent fg | `#0a2038` (navy, not white — see kenzen-cyberhealth's own design.md) |
| Gradient | `linear-gradient(120deg,#18c0d0,#50f8a0)` — same brand gradient, both themes |

## Scoping

Every rule is guarded by `data-rb-style="kenzen-midnight"` (self or ancestor),
wrapped in zero-specificity `:where()`. Set the attribute on `<html>` for a
page or on a container for an embedded island.
