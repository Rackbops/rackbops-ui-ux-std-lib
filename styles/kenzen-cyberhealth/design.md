# kenzen-cyberhealth

The light counterpart of **kenzen-midnight** — Kenzen-sei's own brand,
original to this library and reverse-measured from the mascot concept
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
the palette differs (two documented exceptions, below) — and swaps in with a
single attribute flip.

## Color

Palette measured from `Rackbops/kenzen`'s brand source images, not from any
shipped app CSS. This scheme shares kenzen-midnight's **exact** accent,
success, and warning hexes — roshne's decision
([rackbops-ui-ux-std-lib#171](https://github.com/Rackbops/rackbops-ui-ux-std-lib/issues/171)),
overriding the AA-darkened palette
[#164](https://github.com/Rackbops/rackbops-ui-ux-std-lib/pull/164) shipped:
"the brand teal is the identity; a darker teal is a different brand." That
trade means several of these pairs sit below the automated contrast floors on
this light background — see the Accessibility section for the documented
exception this creates and how the theme mitigates it without touching the
hexes.

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
| Accent | `#18c0d0` (exact source teal — see Accessibility) | The sole brand voice: emphasis, active state, focus |
| Accent strong | `#1890a8` (the palette's own darker teal, measured from the artwork) | Hover/active on `--primary` (darkens further toward `--rb-text` — the light-scheme convention) |
| Accent fg | `#0a2038` (navy) | Navy on the solid teal fill — white is worse here (see Accessibility) |
| Accent wash | `rgba(24,192,208,.12)` | Active/hover tint behind accent text |
| Info | `#1e6fb0` | Informational chips |
| Success | `#50f8a0` (exact source mint — see Accessibility) | Healthy/live status |
| Warning | `#f0b030` (exact source amber — see Accessibility) | Caution status |
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
- Inputs swap to a teal border + a soft `--rb-accent-wash` ring on focus, but
  the keyboard-focus indicator itself is navy: interactive elements take the
  `--rb-focus-ring` outline (`2px solid var(--rb-text)`, not `--rb-accent` —
  see Accessibility) — this covers every `:focus-visible` element uniformly,
  tabstrip/tabs included, since none of them override the base outline.
- The **one gradient** (`--rb-accent-grad`, teal → mint) is rationed to the
  wordmark and the active-tab underline only, at full brand saturation
  (independent of the AA-adjusted `--rb-accent`); primary buttons stay a
  solid accent fill.
- Transitions `0.15s` (`--rb-transition`), `--rb-ease` timing; every animation
  respects `prefers-reduced-motion`.
- 4px spacing rhythm.

## Accessibility

roshne's decision (#171) is to ship the **exact** brand hexes for accent,
success, and warning rather than the AA-darkened substitutes #164 shipped —
"the brand teal is the identity; a darker teal is a different brand." That
means this theme carries real, documented deviations below the automated
floors, unlike kenzen-midnight, whose identical hexes all pass unchanged on
navy. Nothing here is silently below target: every deviation is either
allowlisted in `contract.json`'s `contrast` block (the one automated pair
that fails) or recorded here as a documented-only gap (the two pairs the
automated suite doesn't check at all), and the theme carries two compensating
mitigations that leave the hexes untouched.

Every fixed token pair `styles/test/contrast.test.mjs` computes (the list is
`styles/contract.json`'s `contrast.pairs`, not restated here so it cannot go
stale) clears its required 3:1/4.5:1 floor on this theme **except one**:

- **Accent as non-text, allowlisted.** The exact teal, `#18c0d0`, is only
  **2.21:1** as non-text on `--rb-bg` — below the 3:1 floor
  `styles/test/contrast.test.mjs` enforces for every theme's `accent`/`bg`
  pair. Entered in `contract.json`'s `contrast.allowlist` as
  `{ theme: "kenzen-cyberhealth", fg: "accent", bg: "bg" }`, reason "exact
  brand palette by owner decision (kenzen#88)" — the ratio is still computed
  by the test every run (a stale-entry guard fails if it ever climbs back
  above 3:1), it just no longer blocks the suite.
- **Accent-fg on accent still passes, comfortably.** `--rb-accent-fg` reverts
  to navy `#0a2038` rather than staying white: navy on `#18c0d0` is **7.43:1**
  (`accent-fg`/`accent`'s 4.5:1 floor, cleared with room to spare), while
  white on the exact teal is only **2.21:1** — the same pair as `accent`/`bg`
  above, since `--rb-bg` is white on this theme — worse, not better. The
  button hover/focus fill (`color-mix(in srgb, var(--rb-accent), var(--rb-text)
  12%)` → darkens further; navy text stays comfortably above 4.5:1 there too)
  is unaffected by this change since it never carried the accent-fg pairing.
- **Danger.** The source crimson, `#d02030`, is unchanged: it clears the
  4.5:1 control-label bar the fixed-pair test holds `--rb-danger` to since
  #163 — 5.34:1 on `--rb-bg` (white) and 4.93:1 on `--rb-surface` (the same
  hex as kenzen-midnight, whose navy ground is what fails there).
- **`--rb-text-faint` is below AA on every surface** — it is the navy at 60%
  (`rgba(10, 32, 56, 0.6)`), which the test composites over each opaque
  surface: ~4.4:1 on `--rb-bg`, ~4.3:1 on `--rb-surface`, ~4.1:1 on
  `--rb-surface-2`. All three clear the 3:1 non-text floor, so the suite
  warns rather than fails; the usual rule applies — `.rb-muted` and other
  faint uses carry non-essential meta only, never the sole label of
  essential content.

**Success / warning as plain text — documented-only, no automated pair.**
`contract.json`'s `contrast.pairs` list has no entry for `success`/`bg` or
`warning`/`bg` (by decision, #163: both are designed as fills, and a text
pair would fail half the library for a pairing nothing renders), so there is
nothing to allowlist and no automated check to fail if this regresses —
recorded here instead, per STANDARD.md 9's "every deviation is documented,
never discovered." The exact mint `#50f8a0` and amber `#f0b030` are **1.37:1**
and **1.92:1** as plain text on white — far below AA, and below even the 3:1
non-text floor. Kenzen doesn't render either as plain body text (per the
issue's scope, they're status-badge text only), so the mitigation lives in
`components/badge.css` rather than the tokens — see below.

**Focus-ring mitigation.** `--rb-focus-ring` keys off `--rb-text` (navy) on
this theme instead of `--rb-accent` (`kenzen-cyberhealth/tokens.css`), so
every `:focus-visible` outline — buttons, links, form controls, table
rows, tabs/tabstrip (none of which override the base rule) — stays a crisp
navy ring regardless of the teal's own 2.21:1 non-text ratio. This is the
theme's answer to "the literal focus-ring colour is now under the 3:1 floor":
don't rely on it for focus visibility at all.

**Badge / status-text mitigation, a pair divergence from kenzen-midnight
(`components/badge.css`, STANDARD.md 5.2).** Status as small badge text on
its own tint fill, computed the same way as the pairs above (documentation
only, nothing here is asserted by an automated test): with the exact hexes,
colour-on-tint would be **2.00:1** (default badge, accent on its own 12%
wash), **1.29:1** (success on its own 16% tint), and **1.73:1** (warning) —
functionally unreadable, a real regression from the AA-darkened palette's
4.32:1/4.73:1 on the same fill. `components/badge.css` compensates by using
ink (`--rb-text`) instead of the hue as the label's own colour on the default
badge and the `--success`/`--warning` variants: navy on those same tints is
**14.9:1**, **15.4:1**, and **14.9:1** — the tint alone still carries the hue,
per STANDARD.md 9's "a theme renders them as a tint fill with ink text ...
rather than as text," the same pattern `rackbops-studio/components/badge.css`
already established for this exact scenario. `--info`/`--danger` are
untouched by #171 (their hexes didn't change) and keep colour-on-tint at
their pre-existing **4.26:1**/**4.11:1** — the same close-to-but-under-AA
class of documented exception arcane-parchment already carries for its own
semantic chips; badges always carry a text label, so colour is reinforcement,
not the sole signal.

**Accent as text/border elsewhere — accepted, not mitigated here.** The exact
teal also renders as small text or a hairline border in most other component
CSS that reads `--rb-accent` directly rather than through a tint fill --
grepping every `color`/`border-color`/`border-top-color: var(--rb-accent)`
declaration in this theme finds at least: the bare `a` rule in
`base.css:47-49`, the wordmark, `.rb-link`'s active/hover state, the active
tab in both `.rb-tabs` and `.rb-tabstrip` (text and, for the strip, a
hover/active border), the *default* `.rb-btn`'s hover/focus-visible border
(`components/button.css:39-45`, every button variant, not just
`--accent`) and `.rb-btn--accent`'s own label, the focused input's border
(`components/form.css:37`), the stepper's current/complete state,
`.rb-eyebrow`, and the spinner's `border-top-color`
(`components/progress.css:45`). This list is what one full-repo grep turned
up, not a claim of exhaustive audit coverage -- treat it as "most of the
theme," not "all of it." Each instance sits in the same 2.0-2.2:1 range as
the allowlisted `accent`/`bg` pair above (or worse on the accent-wash fill)
— below both the 3:1 non-text and 4.5:1 text floors. This issue's scope
named two specific mitigations (the keyboard-focus ring and status-badge
text) and this theme ships exactly those two; the wider implication that
*most* uses of the exact accent as text or a thin border are now sub-AA on
white is a direct, accepted consequence of "the brand teal is the identity,
not a darker one" rather than something #171 asked to fix.
STANDARD.md 4.4's cross-theme base table already carries this same class of
divergence for `rackbops-studio`'s own bare `a` rule (`color: inherit`,
accent-as-text below AA there too) — the base contract only pins that `color`
is *present*, never its value, precisely so a theme can make this call.
Recorded here rather than silently repeated — the same treatment
kenzen-midnight's own design.md gives its pre-existing
`--rb-danger`-as-button-text gap, filed as
[#163](https://github.com/Rackbops/rackbops-ui-ux-std-lib/issues/163) — so a
future decision to tint-fill or bolden these too has the numbers already on
hand.

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
