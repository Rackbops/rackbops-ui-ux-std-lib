# rackbops-studio

The design language of **rackbops.com** — the studio's own editorial brand.
A light, paper-cool canvas; heavy, balanced headlines with tight tracking; a
single warm voice — vermillion — over deep navy ink. The texture is print-like,
not console-like: elevation is soft two-step shadows rather than frosted panels,
roomy spacing, and a mono "eyebrow" that kickers every section. Two motifs carry the identity: the
**rack panel** — a dark equaliser unit that puns on "the rack" (infrastructure)
and "the bops" (signal) — and **Boppy**, the mascot. This theme ships the
canonical **light** look; the dark mode rackbops.com toggles into is tabled at
the end. Derived from rackbops/site/index.html.

## Color

Values are the light (primary) scheme; the dark counterpart is tabled at the end.
Every value matches rackbops.com's token block, except `Surface sunken` and the
four semantic hues (Info/Success/Warning/Danger), which are std-lib additions for
the shared components (progress trough, badges, alerts) the marketing site lacks.

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#eaeef1` (cool paper) | Page canvas |
| Surface | `#ffffff` | Cards, fields, raised panels |
| Surface 2 | `#f3f6f8` | Hover wash, secondary sections |
| Surface sunken | `#e4e9ed` | Progress troughs, insets |
| Text | `#131e29` (navy ink) | Headlines and body |
| Text soft | `#4c5b6b` | Lead paragraphs, secondary text |
| Text faint | `#8091a1` | Meta, footnotes, table headers |
| Border | `#d8e0e6` | Hairline dividers |
| Border strong | `#c3ced7` | Field borders, ghost-button outline |
| Accent | `#ef4d28` (vermillion) | The single warm voice: emphasis, CTAs, the equaliser |
| Accent fg | `#ffffff` | Text on the vermillion fill |
| Accent wash | `rgba(239,77,40,.09)` | Focus ring, faint accent tint |
| Info | `#1e6fd0` | Informational chips (std-lib addition; see the Accessibility note) |
| Success | `#1f9d57` | Positive status |
| Warning | `#c07d12` | Caution status |
| Danger | `#d64550` | Destructive/error (distinct rose vs. the vermillion accent) |

**Rules.** The canvas is calm and cool; vermillion is spent sparingly — CTAs,
the eyebrow rule, the live dot, the equaliser. Elevation is soft shadow on white,
not frosted glass — the one blurred surface is the dialog backdrop (the source
site also blurs its sticky header, which this library does not ship as a
component). The marketing site itself uses no colour beyond the accent.

## Typography

- **Headlines:** the system sans at weight **800** with tight tracking
  (`-0.02em`), `text-wrap: balance`, tight line-height (1.08). Heavy and
  editorial — the studio signature.
- **Body:** the same system sans, 17px / 1.6, weight 400.
- **Mono voice:** `ui-monospace, "SF Mono", …` for eyebrows, nav, meta, tags, and
  the rack readouts.
- **Eyebrow:** mono, uppercase, wide-tracked (`0.18em`), accent-coloured, with a
  short leading rule — the kicker above every section headline.
- **Bare tags:** unclassed `h1`-`h6` carry the same headline treatment above
  with no `.rb-*` class needed, plus `--rb-space-3` margin below. Bare `p`
  gets that same margin; bare `ul`/`ol` add it too, with `--rb-space-4`
  marker indent (real disc/decimal markers, not stripped).

## Shape & effects

- Radius `0.6875rem` (11px) for buttons and inputs; `0.9375rem` (15px) for cards;
  16–20px for the large feature panels; pills for tags and troughs.
- Depth is a soft two-step shadow (`--rb-shadow-sm` resting, `--rb-shadow-lg` on
  hover/lift). Cards lift `-4px` on hover.
- Focus is a `2.5px` vermillion outline offset `3px`; fields add an accent border
  plus a soft wash ring.
- Overlay surfaces (the dialog) use a blurred backdrop (`--rb-blur`); the source
  site also blurs its sticky header, which this library does not ship.
- Primary buttons are an **ink fill that warms to vermillion** on hover; a press
  dips the button `1px`; an optional arrow slides right on hover.
- The gradient (`--rb-accent-grad`) is a vertical vermillion ramp — spent on the
  rack equaliser bars.
- Every animation (equaliser, live-dot pulse, hovers) respects
  `prefers-reduced-motion`.

## Accessibility

This theme faithfully reproduces rackbops.com's editorial palette, and that
palette makes deliberate below-AA choices for decorative text. Documented so
consumers can compensate rather than discover it:

- **Vermillion as text is ~3.6:1 on white** (below the 4.5:1 AA bar for normal
  text). The source uses it exactly this way for the eyebrow kicker, the card
  kicker tag, the `/0N` principle markers, and the active nav link — all
  reproduced here. Treat accent-coloured text as decorative; never set body copy
  or the sole label of an interactive control in `--rb-accent`.
- **`--rb-text-faint` (#8091a1) is below AA on white** — use it only for
  genuinely secondary meta (as the source does for footnotes), never for
  essential text. The shared `.rb-table` header therefore uses `--rb-text-soft`,
  which passes.
- **White on the vermillion fill is ~3.6:1** — the `.rb-btn--accent` fill and the
  `.rb-btn--primary` hover state. Fine for large/bold button text; for small
  labels prefer the default primary (ink fill, ~15:1).
- **The semantic badge stays AA** by rendering a tint fill + ink text rather than
  coloured text on white.
- The dark **arcane-obsidian** theme is much stronger on contrast (text ramp
  5.4–8.8:1, semantic chips 4.5–6.5:1; only a few accent-on-tint states — the
  default chip, the active link/tab — sit near ~4.3:1). Reach for it where
  full-contrast UI matters.

## Components

Class prefix `rb-`; shared token/class contract with the other themes.

- **Button** `.rb-btn` — `--primary` ink-fill→vermillion, `--accent` solid
  vermillion, `--ghost` bordered outline, `--danger` rose outline; `.rb-btn__arrow`
  slides on hover. `--sm` is a compact size for inline/table-row actions — the
  arrow scales with it. `.rb-icon-btn` is a square icon-only hit target
  (>=2rem), paired with `.rb-btn`.
- **Card** `.rb-card` (+ `__tag`) — white panel, soft shadow, `-4px` hover lift.
- **NavLink** `.rb-link` — mono header nav; hover fills to a surface pill; accent
  on the active route.
- **Nav rail** `.rb-nav-rail` — the sidebar container: 14rem fixed-width flex
  column, surface background, a hairline right edge. Composes with `.rb-link`
  for items; introduces no active-state convention of its own.
- **Form** `.rb-input` / `.rb-textarea` / `.rb-select` / `.rb-label` / `.rb-field`
  / `.rb-choice` / `.rb-checkbox` / `.rb-radio` / `.rb-switch` — white fields;
  focus is a vermillion border + wash ring.
- **Badge** `.rb-badge` — bordered mono pill; semantic modifiers tint the border
  and text.
- **Alert** `.rb-alert` — white surface card, soft shadow, 4px semantic left bar.
- **Dialog** `.rb-dialog` — native `<dialog>`, white pane, deep lift shadow,
  blurred navy backdrop, heavy title.
- **Tabs** `.rb-tabs` / `.rb-tab` / `.rb-tabpanel` — understated; active goes ink
  with a vermillion underbar.
- **Table** `.rb-table` (+ `.rb-num`) — mono uppercase header rule, generous rows,
  quiet hover wash. `--interactive` marks clickable rows: pointer cursor, plus
  a bolder 2.5px focus-visible ring (and the same hover wash) for a `tabindex`
  row or a row-wrapping button/link.
- **Progress / Spinner** `.rb-progress` / `.rb-spinner` — pill trough with a
  vermillion fill; single-arc spinner.
- **Eyebrow** `.rb-eyebrow` — the mono kicker with leading rule.
- **Muted text** `.rb-muted` — faint secondary/empty-state text;
  `color: var(--rb-text-faint)`, italic — reads naturally in this editorial,
  print-like theme.
- **Pre / log block** `.rb-pre` — command/log `<pre>`; surface-sunken
  background, hairline border, radius, small mono, horizontal scroll. Pair
  with `.rb-log` (`<pre class="rb-pre rb-log">`) for multi-line streaming
  output: a capped 16rem height with vertical scroll, wrapped lines instead
  of horizontal scroll, and roomier line-height for dense text.

### Theme extras

- **Rack** `.rb-rack` (+ `__top` / `__live` / `__bars` / `__foot`) — the dark navy
  equaliser panel; a pulsing live dot and animated vermillion bars. Its inverted
  panel palette is fixed dark regardless of the light canvas.
- **Principles** `.rb-principles` / `.rb-principle` (+ `__n` / `__body`) — the
  numbered `/0N` "how we work" list.
- **Tags** `.rb-tags` / `.rb-tag` — mono capability pills in a flex-wrap row.
- **Boppy** — the mascot ships as `assets/boppy.svg` (navy body, round eyes, a
  vermillion equaliser smile).

## Dark counterpart

The dark mode rackbops.com toggles into. Not shipped as a separate theme yet;
documented so it can become one additively.

| Role | Value |
| --- | --- |
| Background | `#0d141d` |
| Surface | `#141f2a` |
| Surface 2 | `#19242f` |
| Text | `#e9eff4` |
| Text soft | `#a4b4c3` |
| Text faint | `#697a8c` |
| Border | `#243140` |
| Border strong | `#31404f` |
| Accent | `#ff5d3d` |
| Accent soft | `#ff7a5f` |

## Scoping

Every rule is guarded by `data-rb-style="rackbops-studio"` (self or ancestor),
wrapped in zero-specificity `:where()`. Set the attribute on `<html>` for a page
or on a container for an embedded island.
