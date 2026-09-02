# arcane-obsidian

The design language of **artifact-console** — "Arcane Obsidian". A dark-primary
developer console: deep obsidian foundation, tonal indigo surfaces, and a single
brand voice — arcane-violet — used functionally, never for decoration. Depth is
luminance-first (tonal layers + a restrained shadow ramp), not glass or glow;
glass is reserved for the live interactive shell and never used on static report
pages. The display voice is monospace — the gradient-clipped wordmark and mono
labels give it a commanding developer-console feel — over a `system-ui` body,
with tabular numerals so counts, ages, and sizes align in a column. Dark
("Obsidian") is the primary look; an AA-tuned light counterpart ("Parchment") is
documented at the end. Derived from artifact-console#31.

## Color

Values are the dark ("Obsidian") scheme; the light ("Parchment") counterpart is
tabled at the end. Palette parity with `artifact-console/static/style.css` and
`report_theme.py`.

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#0c0f14` (deep obsidian) | Page canvas |
| Surface | `#141922` (indigo) | Cards, header, panels |
| Surface 2 | `#1c2331` | Raised/hover surface, active tab wash base |
| Surface sunken | `#080b10` | Inset fields, log wells, progress troughs |
| Text | `#eceff4` | Body text |
| Text soft | `#a6b0c0` | Secondary text |
| Text faint | `#8290a6` | Labels, table headers, meta |
| Border | `#232c39` | Resting hairline borders |
| Border strong | `#33404f` | Dialog edges, header rules |
| Accent | `#8b7cf6` (arcane-violet) | The sole brand voice: emphasis, active state, focus |
| Accent fg | `#0c0f14` | Dark ink on the solid violet fill (keeps AA) |
| Accent wash | `rgba(139,124,246,.16)` | Active/hover tint behind accent text |
| Info | `#4c9df0` | Informational chips |
| Success | `#43c97e` | Healthy/live status |
| Warning | `#f2a93b` | Caution status |
| Danger | `#f0616d` | Destructive actions, errors |

**Rules.** Colour is functional. Resting UI is obsidian, indigo, and faint;
violet appears only on interaction, focus, active state, and emphasis. Colour
beyond the accent is *earned* — severity and status chips are the one place other
hues appear. The dark resting palette never uses pure white or pure black.
Muted-on-surface is tuned to clear WCAG AA (4.5:1) on every surface; the light
"Parchment" counterpart tabled below does use `#ffffff` for its raised surface.

## Typography

- **Display / wordmark:** the mono stack (`ui-monospace, "Cascadia Code", …`),
  weight 600, tight tracking (`-0.01em`). Monospace *is* the display voice.
- **Body & UI:** `system-ui, -apple-system, "Segoe UI", Roboto, …`, weight 400.
- **Numerals:** `font-variant-numeric: tabular-nums` everywhere data is shown.
- **Labels** (eyebrows, badges, table headers): mono, uppercase, ~11px, tracked
  `0.06em`.
- **Bare tags:** unclassed `h1`-`h6` pick up the mono display voice directly —
  weight 600, tracking `-0.01em`, `--rb-space-3` margin below. `.rb-card`
  renders a bare `<h3>` and gets this treatment too, since `card.css` declares
  no heading rule of its own. Bare `p` shares that margin; bare `ul`/`ol` add
  it too, with `--rb-space-4` marker indent (real disc/decimal markers, not
  stripped).

## Shape & effects

- Radius `0.4375rem` (7px) for buttons, inputs, and rows; `0.75rem` (12px) for
  cards and dialogs; pills reserved for chips/badges and progress troughs.
- Depth is luminance-first: tonal surface layers do most of the work, with a
  two-step shadow ramp (`--rb-shadow-sm` resting, `--rb-shadow-lg` for dialogs
  and raised cards). No glow on resting UI.
- Focus is the accent: inputs swap their border for a violet line plus a soft
  `--rb-accent-wash` ring; interactive elements take a 2px accent outline.
- The **one gradient** (`--rb-accent-grad`, violet → orchid → gold) is rationed
  to exactly two places: the wordmark and the active-tab underline. Primary
  buttons stay a solid AA-safe accent fill — never the gradient.
- Transitions `0.15s`. Every animation and transition respects
  `prefers-reduced-motion`.
- 4px spacing rhythm (`--rb-space-1..5`).

## Components

Class prefix `rb-`; shared token/class contract with the other themes.

- **Wordmark** `.rb-wordmark` (+ `__spark`) — mono h1 with the gradient clipped
  into the text; the spark mark stays solid accent.
- **Button** `.rb-btn` — surface-2 ghost by default; `--primary` is the one solid
  violet fill (dark ink), `--accent` a violet-wash chip, `--danger` a rose ghost,
  `--ghost` chromeless. `--sm` is a compact size — tighter padding, type down
  ~1px — for inline and table-row actions. `.rb-icon-btn` is a square icon-only
  hit target (>=2rem) — pair it with `.rb-btn` (+ an optional color variant)
  for close/edit/delete glyph buttons.
- **Card** `.rb-card` (+ `--raised`) — solid panel, hairline border, shadow-sm.
- **NavLink** `.rb-link` — tree/sidebar row; hover fills to surface-2 and lights a
  2px accent bar on the left edge; `--active` carries the accent wash.
- **Nav rail** `.rb-nav-rail` — the sidebar container: 14rem fixed-width flex
  column, surface background, a hairline right edge. Composes with `.rb-link`
  for items; introduces no active-state convention of its own.
- **Form** `.rb-input` / `.rb-textarea` / `.rb-select` / `.rb-label` / `.rb-field`
  / `.rb-choice` / `.rb-checkbox` / `.rb-radio` / `.rb-switch` — sunken fields;
  focus swaps to the accent border + wash ring; controls use `accent-color`.
- **Badge** `.rb-badge` — mono uppercase pill: a 16% tint of its hue behind
  full-strength text (semantic modifiers `--info/--success/--warning/--danger`).
- **Alert** `.rb-alert` — surface panel, 3px left bar carries the semantic colour.
- **Dialog** `.rb-dialog` — native `<dialog>`, obsidian pane, blurred backdrop,
  mono title.
- **Tabs** `.rb-tabs` / `.rb-tab` / `.rb-tabpanel` — text tabs; the active tab is
  accent, underlined with the rationed gradient.
- **Tabstrip** `.rb-tabstrip` — top-level view nav: bordered pill buttons; active
  gets accent text + wash + accent-tinted border.
- **Table** `.rb-table` (+ `.rb-num`) — dense data table, faint header rule,
  tabular numerals, row hover to surface-2. `--interactive` marks clickable
  rows: pointer cursor, plus a focus-visible ring (and the surface-2 wash) for
  a `tabindex` row or a row-wrapping button/link.
- **Progress / Spinner** `.rb-progress` / `.rb-spinner` — sunken trough with an
  accent fill; the spinner is a single accent arc.
- **Eyebrow** `.rb-eyebrow` — small mono uppercase section label in the accent,
  wide-tracked; subtler than the studio eyebrow (no leading rule).
- **Muted text** `.rb-muted` — faint secondary/empty-state text;
  `color: var(--rb-text-faint)`, italic.
- **Pre / log block** `.rb-pre` — command/log `<pre>`; surface-sunken
  background, hairline border, radius, small mono, horizontal scroll. Pair
  with `.rb-log` (`<pre class="rb-pre rb-log">`) for multi-line streaming
  output: a capped 16rem height with vertical scroll, wrapped lines instead
  of horizontal scroll, and roomier line-height for dense text.

## Code syntax

Tokens `--rb-code-*` (a per-theme extra, since only this theme renders code):
violet keywords, green strings, gold numbers, info-blue functions, light-violet
types, soft-rose variables, dimmed comments, faint meta — the palette's own
voices reused, never new decorative hues.

## Light counterpart — "Parchment"

The AA-tuned light secondary. Not shipped as a separate theme yet; documented so
it can become one additively.

| Role | Value |
| --- | --- |
| Background | `#f6f7f9` |
| Surface | `#ffffff` |
| Surface 2 | `#f1f3f7` |
| Surface sunken | `#edeff3` |
| Text | `#191d26` |
| Text soft | `#4a5261` |
| Text faint | `#5f6b7d` (a touch darker than report's `#7c8598` so muted-on-surface clears AA) |
| Border | `#e2e6ec` |
| Border strong | `#cbd2dc` |
| Accent | `#6a4fe0` |
| Accent fg | `#ffffff` |
| Gradient | `linear-gradient(120deg,#6a4fe0,#a25be0 46%,#d99a2a)` |

## Scoping

Every rule is guarded by `data-rb-style="arcane-obsidian"` (self or ancestor),
wrapped in zero-specificity `:where()`. Set the attribute on `<html>` for a page
or on a container for an embedded island.
