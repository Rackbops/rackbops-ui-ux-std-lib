# arcane-parchment

The light, AA-tuned counterpart of **arcane-obsidian** — artifact-console's
"Parchment" scheme. Same developer-console language (monospace display voice over
a `system-ui` body, tabular numerals, the sole arcane-violet accent, the one
rationed violet→gold gradient, flat shadow-based depth) rendered on a cool
off-white ground instead of obsidian. It ships the identical `rb-*` component set
as arcane-obsidian — the components are token-driven, so only the palette differs
— and swaps in with a single attribute flip. Derived from artifact-console#31.

## Color

Palette values match artifact-console's light scheme. Unlike the studio themes,
the arcane accent (a darker violet) stays **above WCAG AA as text on white**
(~5.5:1), so accent labels, body text, and the muted ramp all clear AA. The one
exception — inherited from artifact-console itself — is the semantic chip colours
(`--rb-success/--rb-warning/...`) used as small text on their faint tint, which
sit below 4.5:1; treat those as status accents, not body copy.

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#f6f7f9` (cool parchment) | Page canvas |
| Surface | `#ffffff` | Cards, header, panels |
| Surface 2 | `#f1f3f7` | Raised/hover surface, active-tab wash base |
| Surface sunken | `#edeff3` | Inset fields, log wells, progress troughs |
| Text | `#191d26` | Body text |
| Text soft | `#4a5261` | Secondary text |
| Text faint | `#5f6b7d` | Labels, headers, meta (tuned darker than report's `#7c8598` for AA) |
| Border | `#e2e6ec` | Resting hairline borders |
| Border strong | `#cbd2dc` | Dialog edges, header rules |
| Accent | `#6a4fe0` (arcane-violet) | The sole brand voice: emphasis, active state, focus (~5.5:1 on white) |
| Accent fg | `#ffffff` | White on the solid violet fill |
| Accent wash | `rgba(106,79,224,.12)` | Active/hover tint behind accent text |
| Info | `#1e6fd0` | Informational chips |
| Success | `#1f9d57` | Healthy/live status |
| Warning | `#c07d12` | Caution status |
| Danger | `#d64550` | Destructive actions, errors |

**Rules.** Colour is functional. Resting UI is parchment, white, and faint;
violet appears only on interaction, focus, active state, and emphasis. Colour
beyond the accent is *earned* — severity and status chips are the one place other
hues appear. Muted-on-surface is tuned to clear WCAG AA (4.5:1) on every surface.

## Typography

Identical to arcane-obsidian: monospace display voice (the wordmark, weight 600,
tracking `-0.01em`) over a `system-ui` body (weight 400); `tabular-nums` wherever
data is shown; mono uppercase labels tracked `0.06em` (table headers are the
one stated departure — body-sans, normal case, `components/table.css:9-15`).
Bare `h1`-`h6`/`p`/`ul`/`ol`
get the same treatment as arcane-obsidian too: unclassed headlines carry that
same mono voice with `--rb-space-3` margin, and bare `ul`/`ol` add
`--rb-space-4` marker indent with real disc/decimal markers.

## Shape & effects

- Radius `0.4375rem` (7px) for buttons/inputs/rows; `0.75rem` (12px) for cards
  and dialogs; pills for chips/badges and progress troughs.
- Flat, shadow-based depth: a two-step light shadow ramp (`--rb-shadow-sm`
  resting, `--rb-shadow-lg` for dialogs/raised cards). No glow.
- Focus is the accent: inputs swap to a violet border + a soft `--rb-accent-wash`
  ring; interactive elements take a 2px accent outline.
- The **one gradient** (`--rb-accent-grad`, violet → orchid → gold) is rationed
  to the wordmark and the active-tab underline only; primary buttons stay a solid
  accent fill.
- Transitions `0.15s`; every animation respects `prefers-reduced-motion`.
- 4px spacing rhythm.

## Components

Class prefix `rb-`; the full arcane-obsidian inventory, styled identically from
tokens: `.rb-wordmark` (+ `__spark`), `.rb-btn` (+ `--primary/--accent/--danger/--ghost`, `--sm` compact size, `.rb-icon-btn` icon-only square),
`.rb-card` (+ `--raised`), `.rb-link`, `.rb-nav-rail`, the form set, `.rb-badge`, `.rb-alert`,
`.rb-dialog`, `.rb-tabs`, `.rb-tabstrip`, `.rb-table` (+ `.rb-num`, `--interactive`),
`.rb-progress` / `.rb-spinner`, `.rb-stepper`, `.rb-eyebrow`, `.rb-muted`, `.rb-pre` (+ `.rb-log`). See
arcane-obsidian's `design.md` for the per-component notes — the behaviour is
the same, with one exception: `components/button.css`'s `--primary`
hover/focus-visible fill darkens toward `--rb-text` here
(`color-mix(in srgb, var(--rb-accent), var(--rb-text) 12%)`), rather than
lightening toward white as arcane-obsidian does — lightening on this light
ground would drop the label below AA (4.37:1; see the inline comment in that
file). Otherwise only the palette is light.

## Code syntax

Tokens `--rb-code-*` (a per-theme extra), light-tuned for AA on the parchment
ground: violet keywords, dark-green strings, dark-amber numbers, info-blue
functions, dark-violet types, rose variables, dimmed comments/meta.

## Dark counterpart

`arcane-obsidian` — the primary, dark look. This theme and it share the same
`--rb-*` baseline and `rb-*` classes, so switching `data-rb-style` between them
restyles a page without touching markup.

## Scoping

Every rule is guarded by `data-rb-style="arcane-parchment"` (self or ancestor),
wrapped in zero-specificity `:where()`. Set the attribute on `<html>` for a page
or on a container for an embedded island.
