# concrete-signal

A brutalist-industrial design language: raw poured concrete and hazard
signage. It is the coldest, hardest theme in the library — zero
border-radius everywhere, thick hairline borders, and its signature trait,
**hard offset shadows instead of blur** (`Npx Npx 0 rgba(...)`, no blur
radius at all), so depth reads as a literal physical offset — a stamped
card, not a glow. The sole accent is safety-orange, used exactly as
functionally as arcane-obsidian's violet: interaction, focus, and emphasis
only, never decoration. Labels are heavy-weight and uppercase; numerals are
tabular; transitions are snappy (`0.1s`, no easing softness — brutalism
doesn't ease). Dark ("concrete-signal") is the primary look; its light
counterpart ("concrete-signal-light") is documented at the end.

## Color

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#121212` | Page canvas |
| Surface | `#1a1a1a` | Cards, header, panels |
| Surface 2 | `#232323` | Raised/hover surface, row hover |
| Surface sunken | `#0a0a0a` | Inset fields, progress troughs |
| Text | `#f2f2f0` | Body text |
| Text soft | `#b8b8b4` | Secondary text |
| Text faint | `#8f8f8a` | Labels, idle tabs, meta |
| Border | `#3a3a38` | Resting hairline borders |
| Border strong | `#55534e` | Card/table/dialog structural rules |
| Accent | `#ff5e1a` (safety-orange) | The sole brand voice: emphasis, active state, focus |
| Accent fg | `#121212` | Dark ink on the solid orange fill |
| Accent wash | `rgba(255,94,26,.16)` | Default badge tint, active-link wash |
| Gradient | `linear-gradient(90deg,#ff5e1a,#e8342a)` | The one rationed gradient: active-tab underline only |
| Info | `#4ea1e0` | Informational chips |
| Success | `#4caa5c` | Healthy/live status |
| Warning | `#e8b23a` | Caution status |
| Danger | `#e8342a` | Destructive actions, errors |

**Rules.** Colour is functional. Resting UI is concrete grey and faint;
safety-orange appears only on interaction, focus, active state, and
emphasis — never as decoration. Colour beyond the accent is *earned*:
severity and status chips are the one place other hues appear. The theme
never softens with glow, blur, or gradient — the one exception is the
2-stop hard gradient rationed to the active-tab underline, and even that
gradient has no soft midpoint.

## Typography

- **Display / labels:** `system-ui` throughout — no serif, no
  monospace-as-display. The industrial voice comes from weight, case, and
  tracking, not font family. Buttons, badges, tabs, and table headers are
  uppercase at weight 800, tracked `var(--rb-label-tracking)` (`0.08em`).
- **Body:** `system-ui`, weight 400.
- **Numerals:** `font-variant-numeric: tabular-nums` on tables, so counts
  and sizes align in a column.
- **Mono:** `ui-monospace` stack reserved for code-shaped content; not the
  display voice.

## Shape & effects

- Radius `0` everywhere — buttons, cards, dialogs, inputs, tabs. The one
  concession is `--rb-radius-pill` (`0.125rem`), used for badges: near-square,
  never a true rounded pill.
- Depth is a literal offset, not blur: `--rb-shadow-sm` (`2px 2px 0`) resting,
  `--rb-shadow-lg` (`4px 4px 0`) for dialogs and raised cards. `--rb-blur` is
  `0px` — this theme never applies `backdrop-filter` or any soft blur.
  Dialog backdrops are a flat `rgba(0,0,0,.6)` scrim.
  Focus is a hard border-weight change (1px to 2px solid accent), never a
  soft wash ring or glow.
- Primary buttons carry the theme's signature interaction: the offset shadow
  disappears and the button translates by the shadow's own offset on
  hover/active (`transform: translate(2px, 2px); box-shadow: none;`) — the
  classic "pressed into the surface" brutalist button.
- The **one gradient** (`--rb-accent-grad`, orange → red, 2-stop, no soft
  midpoint) is rationed to exactly one place: the active-tab underline.
  Everywhere else that reads as accent is a solid fill.
- Transitions `0.1s`, no easing softness. Every animation and transition
  respects `prefers-reduced-motion`.
- 4px spacing rhythm (`--rb-space-1..5`).

## Components

Class prefix `rb-`; shared token/class contract with the other themes. Only
the baseline ten — no theme-specific extras.

- **Button** `.rb-btn` — outlined ghost by default; `--primary` is a solid
  accent fill with the offset-shadow press interaction; `--accent` an
  accent-wash chip; `--danger` a danger-colored ghost; `--ghost` chromeless.
- **Card** `.rb-card` (+ `--raised`) — surface panel, a thicker
  `border-strong` edge, `shadow-sm` (`--raised` upgrades to `shadow-lg`).
- **Link** `.rb-link` (nav/sidebar row) — hover fills to surface-2 and stamps
  a hard 3px solid accent bar on the left edge; `--active` adds the accent
  wash and bold text.
- **Form** `.rb-input` / `.rb-textarea` / `.rb-select` / `.rb-label` /
  `.rb-field` / `.rb-choice` / `.rb-checkbox` / `.rb-radio` / `.rb-switch` —
  sunken square fields; focus swaps the border from 1px to 2px solid accent;
  checked checkbox/radio/switch states are a flat accent fill, not a tint
  ring; labels are uppercase, tracked, weight 600.
- **Badge** `.rb-badge` — uppercase weight 700, near-square (`radius-pill`);
  a 16%-tint fill of its hue behind full-strength text, plus a 1px solid
  border of that same hue — badges carry a border here, unlike softer themes.
- **Alert** `.rb-alert` — surface panel with a 6px solid left bar (thicker
  than the library norm) in the semantic colour, square corners.
- **Dialog** `.rb-dialog` — native `<dialog>`, surface bg, a 2px
  `border-strong` edge, `shadow-lg`, a flat unblurred backdrop, uppercase
  weight-800 title.
- **Tabs** `.rb-tabs` / `.rb-tab` / `.rb-tabpanel` — uppercase text tabs; the
  active tab is accent, underlined with the rationed 2-stop gradient.
- **Table** `.rb-table` (+ `.rb-num`) — dense, uppercase weight-700 headers,
  1px `border-strong` rules throughout (a spec-sheet read, not faint
  hairlines), tabular numerals, instant row hover to surface-2.
- **Progress / Spinner** `.rb-progress` / `.rb-spinner` — sunken square
  trough, solid accent fill (no gradient fill); the spinner keeps the
  zero-radius signature as a square rotating frame.

## Light counterpart

`concrete-signal-light` — the AA-tuned light secondary, same brutalist
mechanics, same `rb-*` classes and behaviour, only the palette inverted onto
a poured-concrete off-white ground.

| Role | Value |
| --- | --- |
| Background | `#eeece6` |
| Surface | `#f7f6f2` |
| Surface 2 | `#e4e2da` |
| Surface sunken | `#dcdad2` |
| Text | `#141311` |
| Text soft | `#4a4844` |
| Text faint | `#5f5d58` |
| Border | `#c9c6bc` |
| Border strong | `#a8a59a` |
| Accent | `#cc4611` |
| Accent fg | `#ffffff` |
| Gradient | `linear-gradient(90deg,#cc4611,#b8281f)` |

See `concrete-signal-light`'s own `design.md` for its full color table and
notes — the behaviour is identical; only the palette is light.

## Scoping

Every rule is guarded by `data-rb-style="concrete-signal"` (self or
ancestor), wrapped in zero-specificity `:where()`. Set the attribute on
`<html>` for a page or on a container for an embedded island.
