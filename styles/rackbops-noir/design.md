# rackbops-noir

The dark counterpart of **rackbops-studio** — the mode rackbops.com toggles into.
Same editorial studio language (heavy 800 headlines with tight tracking, the mono
eyebrow, vermillion as the single warm voice, the rack-equaliser motif, soft
two-step shadow depth) rendered on a deep slate canvas instead of paper. It ships
the identical `rb-*` component set as rackbops-studio — token-driven, so only the
palette differs, plus a dark-appropriate accent-fg and a lighter accent ramp —
and swaps in with a single attribute flip. Derived from rackbops.com's dark scheme.

## Color

Palette values match rackbops.com's dark scheme. On the dark ground the vermillion
accent clears **~5.5:1 as text**, so — unlike the light studio theme — noir's
accent labels are AA.

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#0d141d` (deep slate) | Page canvas |
| Surface | `#141f2a` | Cards, fields, raised panels |
| Surface 2 | `#19242f` | Hover wash, secondary sections |
| Surface sunken | `#0f1720` | Progress troughs, insets |
| Text | `#e9eff4` | Headlines and body |
| Text soft | `#a4b4c3` | Lead paragraphs, secondary text |
| Text faint | `#697a8c` | Meta, footnotes, placeholders (below AA as normal text — secondary use only; the shared table header uses `--rb-text-soft`) |
| Border | `#243140` | Hairline dividers |
| Border strong | `#31404f` | Field borders, ghost-button outline |
| Accent | `#ff5d3d` (vermillion) | The single warm voice: emphasis, CTAs, the equaliser (~5.5:1 as text) |
| Accent fg | `#0d141d` | Dark ink on the vermillion fill (keeps it AA) |
| Accent wash | `rgba(255,93,61,.13)` | Focus ring, faint accent tint |
| Info | `#4c9df0` | Informational chips (std-lib addition; brightened for the dark ground) |
| Success | `#43c97e` | Positive status |
| Warning | `#f2a93b` | Caution status |
| Danger | `#f0616d` | Destructive/error |

**Rules.** The canvas is deep and calm; vermillion is spent sparingly — CTAs, the
eyebrow rule, the live dot, the equaliser. Elevation is soft shadow (deeper on the
dark ground), not frosted glass — the one blurred surface is the dialog backdrop.
The marketing site itself uses no colour beyond the accent; `--rb-surface-sunken`
and the four semantic hues are std-lib additions for the shared components
(progress trough, badges, alerts) the marketing site lacks.

## Typography

Identical to rackbops-studio: the system sans at weight **800** for headlines
(tracking `-0.02em`, `text-wrap: balance`), the same sans body, and the mono voice
(`ui-monospace, "SF Mono", …`) for eyebrows, nav, tags, and the rack readouts. The
eyebrow is mono, uppercase, tracked `0.18em`, accent-coloured, with a leading rule.
Bare `h1`-`h6`/`p`/`ul`/`ol` get the same treatment as rackbops-studio too:
unclassed headlines, `--rb-space-3` margin on headings/paragraphs/lists, and
`--rb-space-4` marker indent with real disc/decimal markers on `ul`/`ol`.

## Shape & effects

- Radius `0.6875rem` (11px) for buttons/inputs; `0.9375rem` (15px) for cards;
  pills for tags and troughs.
- Depth is a soft two-step shadow (`--rb-shadow-sm` resting, `--rb-shadow-lg` on
  hover/lift), deepened for the dark ground. Cards lift `-4px` on hover.
- Focus is a `2.5px` vermillion outline offset `3px`; fields add an accent border
  plus a soft wash ring.
- Primary buttons are a **bright neutral fill with dark ink** that warms to
  vermillion on hover (the studio's ink-fill idiom, inverted for dark); a press
  dips the button `1px`; an optional arrow slides on hover.
- The gradient (`--rb-accent-grad`) is a vertical vermillion ramp — spent on the
  rack equaliser bars.
- Every animation respects `prefers-reduced-motion`.

## Components

Class prefix `rb-`; the full rackbops-studio inventory, styled identically from
tokens — `.rb-btn`, `.rb-card` (+ `__tag`), `.rb-link`, the form set, `.rb-badge`,
`.rb-alert`, `.rb-dialog`, `.rb-tabs`, `.rb-table`, `.rb-progress`/`.rb-spinner`,
`.rb-eyebrow` — plus the studio extras `.rb-rack` (equaliser panel; its panel palette
matches rackbops.com's dark-mode rack — a near-canvas block set off by its border), `.rb-principles`/
`.rb-principle`, and `.rb-tags`/`.rb-tag`. See rackbops-studio's `design.md` for
the per-component notes. The Boppy mascot asset ships with rackbops-studio
(`styles/rackbops-studio/assets/boppy.svg`) and is shared.

## Light counterpart

`rackbops-studio` — the canonical light look. Same `--rb-*` baseline and `rb-*`
classes, so switching `data-rb-style` restyles a page without touching markup.

## Scoping

Every rule is guarded by `data-rb-style="rackbops-noir"` (self or ancestor),
wrapped in zero-specificity `:where()`. Set the attribute on `<html>` for a page
or on a container for an embedded island.
