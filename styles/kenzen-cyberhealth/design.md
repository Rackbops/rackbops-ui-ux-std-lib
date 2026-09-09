# kenzen-cyberhealth

The light, AA-tuned counterpart of **kenzen-midnight** — Kenzen-sei's own
brand, original to this library and reverse-measured from the mascot concept
sheet's cyber-health palette (Code Stream Koi, Komainu guardian, status
shields — `Rackbops/kenzen`'s `brand/source/`, per
[rackbops-ui-ux-std-lib#158](https://github.com/Rackbops/rackbops-ui-ux-std-lib/issues/158)).
Same five signature traits as the dark primary (a single vibrant-teal accent
voice, three status shields that never carry meaning through colour alone,
flat shadow-based depth, a geometric-sans display face over a plain
system-ui body with tabular numerals, and the same mono uppercase tracked
label voice for badges/eyebrows), rendered on a sterile white chassis with
navy structure instead of navy-on-navy. It ships the identical `rb-*`
component set as kenzen-midnight — the components are token-driven, so only
the palette differs (one documented exception, below) — and swaps in with a
single attribute flip.

## Color

Palette measured from `Rackbops/kenzen`'s brand source images, not from any
shipped app CSS. Unlike kenzen-midnight, this scheme's accent is **darkened**
from the source teal for AA on white — see the Accessibility section for why
and by how much.

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#ffffff` | Page canvas |
| Surface | `#f4f6f8` | Cards, header, panels |
| Surface 2 | `#e8e8e8` | Raised/hover surface, active-tab wash base |
| Surface sunken | `#edeff3` | Inset fields, log wells, progress troughs |
| Text | `#0a2038` (deep navy) | Body text |
| Text soft | `rgba(10,32,56,.82)` | Secondary text |
| Text faint | `rgba(10,32,56,.6)` | Labels, headers, meta |
| Border | `rgba(10,32,56,.14)` | Resting hairline borders |
| Border strong | `rgba(10,32,56,.28)` | Dialog edges, header rules |
| Accent | `#177e93` (darkened teal — see Accessibility) | The sole brand voice: emphasis, active state, focus |
| Accent strong | `#146f82` | Hover/active on `--primary` (darkens further toward `--rb-text` — the light-scheme convention) |
| Accent fg | `#ffffff` | White on the solid teal fill |
| Accent wash | `rgba(23,126,147,.12)` | Active/hover tint behind accent text |
| Info | `#1e6fb0` | Informational chips |
| Success | `#0f7a47` (darkened from the source `#50f8a0` mint — see Accessibility) | Healthy/live status |
| Warning | `#8a5a00` (darkened from the source `#f0b030` amber — see Accessibility) | Caution status |
| Danger | `#d02030` (source crimson, unchanged — already AA on white) | Destructive actions, errors |

**Rules.** Colour is functional. Resting UI is white, faint-navy, and
structural; teal appears only on interaction, focus, active state, and
emphasis. Colour beyond the accent is *earned* — severity and status chips
are the one place other hues appear, and status is never colour-only.
Muted-on-surface is tuned to clear WCAG AA (4.5:1) on every surface.
`--rb-info` has no counterpart in the source concept sheet — see
kenzen-midnight's design.md for the same note (both themes share this
reasoning).

## Typography

Identical to kenzen-midnight: Sora display voice (the wordmark, weight 600,
tracking `-0.01em`) over a `system-ui` body (weight 400); `tabular-nums`
wherever data is shown; mono uppercase labels tracked `0.06em` (table headers
are the one stated departure — body-sans, normal case,
`components/table.css:9-15`). Bare `h1`-`h6`/`p`/`ul`/`ol` get the same
treatment as kenzen-midnight too: unclassed headlines carry the Sora voice
with `--rb-space-3` margin, and bare `ul`/`ol` add `--rb-space-4` marker
indent with real disc/decimal markers.

## Shape & effects

- Radius `0.4375rem` (7px) for buttons/inputs/rows; `0.75rem` (12px) for cards
  and dialogs; pills for chips/badges and progress troughs — the arcane
  pair's own radii, per the issue's "radius/spacing per the arcane pair
  unless the mockups say otherwise."
- Flat, shadow-based depth: a two-step light shadow ramp (`--rb-shadow-sm`
  resting, `--rb-shadow-lg` for dialogs/raised cards). No glow.
- Focus is the accent: inputs swap to a teal border + a soft
  `--rb-accent-wash` ring; interactive elements take the `--rb-focus-ring`
  outline (`2px solid var(--rb-accent)`).
- The **one gradient** (`--rb-accent-grad`, teal → mint) is rationed to the
  wordmark and the active-tab underline only, at full brand saturation
  (independent of the AA-adjusted `--rb-accent`); primary buttons stay a
  solid accent fill.
- Transitions `0.15s` (`--rb-transition`), `--rb-ease` timing; every animation
  respects `prefers-reduced-motion`.
- 4px spacing rhythm.

## Accessibility

The token pairs `styles/test/contrast.test.mjs` computes — `--rb-text` /
`--rb-text-soft` on their surfaces, `--rb-accent-fg` on `--rb-accent`,
`--rb-accent` as non-text on `--rb-bg`, and `--rb-text-faint` on
`--rb-surface`/`--rb-bg` — all clear their required 3:1/4.5:1 floors on this
theme (test-run diagnostics: `text-faint`/`surface` is 4.31:1 and
`text-faint`/`bg` is 4.43:1 — both above the 3:1 non-text floor `text-faint`
is actually held to, just under the informational 4.5:1 `warnBelow` the test
also diagnoses for non-essential text; per STANDARD.md 9, faint/meta text MAY
sit here as long as it never carries essential body copy, which it does not
in this theme's `.rb-muted`/table-header/label usage). No failing pairs — but
two of the *literal source hexes the issue proposed* fail the automated
3:1/4.5:1 floors outright, and were adjusted here (never in kenzen-midnight,
whose numbers all pass unchanged):

- **Accent.** The source teal, `#18c0d0` (used as-is in kenzen-midnight), is
  only **2.21:1** as non-text on `--rb-bg` — below the 3:1 floor
  `styles/test/contrast.test.mjs` enforces for every theme's `accent`/`bg`
  pair. Since `--rb-accent` is the literal colour of this theme's focus ring
  (`--rb-focus-ring: 2px solid var(--rb-accent)`) and of hairline borders on
  `--rb-btn--accent`/`--rb-btn--danger`, that's a real keyboard-focus
  visibility problem on white, not just a documentation gap — the same
  reasoning arcane-parchment already applied to its own light-mode accent
  ("darker on light for AA"). Darkened to `#177e93` (4.73:1 non-text on
  `--rb-bg`) and paired with white as `--rb-accent-fg` instead of navy (navy
  on `#177e93` is only 3.48:1, well under the 4.5:1 `accent-fg`/`accent`
  floor; white on `#177e93` is 4.73:1, comfortably above it). The button
  hover/focus fill (`color-mix(in srgb, var(--rb-accent), var(--rb-text)
  12%)` → `#157388`) keeps white at 5.47:1.
- **Success / warning.** The source mint (`#50f8a0`) and amber (`#f0b030`)
  are 1.37:1 and 1.92:1 as text on white — nowhere close to AA. Both are used
  as plain status text in some Kenzen surfaces, not only inside a tinted
  badge, so darkening was the right fix rather than a documented exception.
  Darkened to `#0f7a47` (5.39:1) and `#8a5a00` (5.93:1).
- **Danger.** The source crimson, `#d02030`, is unchanged: it already clears
  4.5:1 on white (5.34:1) as plain text, so no adjustment was needed (matches
  kenzen-midnight, which also keeps it unchanged).

One more thing worth stating that the fixed-pair test does not check, because
the issue's acceptance bullet asked for status-colour ratios explicitly
(computed by hand, `styles/test/contrast.test.mjs`'s own formula, reproduced
in a throwaway script — documentation only, nothing here is asserted by an
automated test): **status as small badge text on its own 16% tint fill**
(`badge.css`'s `color-mix(in srgb, var(--rb-x) 16%, transparent)`, composited
over `--rb-bg`): success 4.32:1, warning 4.73:1, danger 4.11:1, info 4.26:1 —
all close to but under 4.5:1, the same class of documented exception
arcane-parchment already carries for its own semantic chips (STANDARD.md 9:
"semantic colours as small text on a light surface are often below AA");
badges always carry a text label, so colour is reinforcement, not the sole
signal.

## Components

Class prefix `rb-`; the full kenzen-midnight inventory, styled identically
from tokens: `.rb-btn` (+ `--primary/--accent/--danger/--ghost`, `--sm`
compact size, `.rb-icon-btn` icon-only square), `.rb-card` (+ `--raised`),
`.rb-link`, `.rb-nav-rail`, the form set, `.rb-badge`, `.rb-alert`,
`.rb-dialog`, `.rb-tabs`, `.rb-tabstrip` (+ `__tab`, `--active`, `__badge`),
`.rb-table` (+ `.rb-num`, `--interactive`, `__group-row`, `__sort`,
`.rb-table-scroll`), `.rb-progress` / `.rb-spinner`, `.rb-muted`, `.rb-pre`
(+ `.rb-log`), `.rb-stepper`. See kenzen-midnight's `design.md` for the
per-component notes — the behaviour is the same, with one exception:
**`components/button.css`'s `--primary` hover/focus-visible fill darkens
toward `--rb-text` here** (`color-mix(in srgb, var(--rb-accent), var(--rb-text)
12%)` → `#157388`, white text 5.47:1), rather than lightening toward white as
kenzen-midnight does — lightening on this light ground would push the fill
even closer to white and drop white-on-fill contrast rather than raise it.
This is the same documented pair divergence STANDARD.md 5.2 requires, stated
in both design.md's, matching the arcane pair's own precedent for this exact
CSS file. Otherwise only the palette is light.

### Theme extras

`.rb-wordmark` (+ `__spark`) and `.rb-eyebrow` — identical to kenzen-midnight's;
carried over from the arcane pair this was scaffolded from, token-driven, not
currently used by Kenzen's own app. See kenzen-midnight's `design.md` for the
per-extra notes.

## Dark counterpart

`kenzen-midnight` — the primary, dark look. This theme and it share the same
`--rb-*` baseline and `rb-*` classes, so switching `data-rb-style` between
them restyles a page without touching markup.

## Scoping

Every rule is guarded by `data-rb-style="kenzen-cyberhealth"` (self or
ancestor), wrapped in zero-specificity `:where()`. Set the attribute on
`<html>` for a page or on a container for an embedded island.
