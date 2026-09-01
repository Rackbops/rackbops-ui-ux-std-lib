# concrete-signal-light

The light, AA-tuned counterpart of **concrete-signal** — the same brutalist
industrial language (zero border-radius everywhere, thick hairline borders,
hard offset shadows instead of blur, the sole safety-orange accent used
functionally only, heavy-weight uppercase labels, tabular numerals, snappy
`0.1s` transitions with no easing softness) rendered on a poured-concrete
off-white ground instead of the dark slab. It ships the identical `rb-*`
component set as concrete-signal — the components are token-driven, so only
the palette differs — and swaps in with a single attribute flip.

## Color

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#eeece6` (poured concrete, off-white) | Page canvas |
| Surface | `#f7f6f2` | Cards, header, panels |
| Surface 2 | `#e4e2da` | Raised/hover surface, row hover |
| Surface sunken | `#dcdad2` | Inset fields, progress troughs |
| Text | `#141311` | Body text |
| Text soft | `#4a4844` | Secondary text |
| Text faint | `#5f5d58` | Labels, idle tabs, meta |
| Border | `#c9c6bc` | Resting hairline borders |
| Border strong | `#a8a59a` | Card/table/dialog structural rules |
| Accent | `#cc4611` (safety-orange, darkened for AA) | The sole brand voice: emphasis, active state, focus (4.72:1 as accent-fg text) |
| Accent fg | `#ffffff` | White on the solid orange fill |
| Accent wash | `rgba(204,70,17,.14)` | Default badge tint, active-link wash |
| Gradient | `linear-gradient(90deg,#cc4611,#b8281f)` | The one rationed gradient: active-tab underline only |
| Info | `#2f6fa8` | Informational chips (4.90:1 on surface) |
| Success | `#3d7a45` | Healthy/live status (4.77:1 on surface) |
| Warning | `#906721` | Caution status (darkened from `#b8842a`, 3.05:1, to 4.68:1 on surface) |
| Danger | `#b8281f` | Destructive actions, errors (5.78:1 on surface) |

**Rules.** Colour is functional. Resting UI is concrete grey and faint;
safety-orange appears only on interaction, focus, active state, and
emphasis — never as decoration. Colour beyond the accent is *earned*:
severity and status chips are the one place other hues appear. The accent
and the warning chip are both darkened from their naive values so every
text/border use of a semantic colour clears WCAG AA (4.5:1) against
`--rb-surface` — genuinely AA-tuned, not just labelled as such. The theme
never softens with glow, blur, or gradient — the one exception is the
2-stop hard gradient rationed to the active-tab underline.

## Typography

Identical to concrete-signal — see its `design.md` for per-component notes;
behaviour is the same, only the palette differs. `system-ui` throughout at
weight 800 for display/labels, uppercase and tracked; tabular numerals on
tables.

## Shape & effects

Identical to concrete-signal — see its `design.md` for per-component notes;
behaviour is the same, only the palette differs. Zero radius everywhere
(save the near-square `--rb-radius-pill` used by badges), hard offset
shadows instead of blur, a hard border-weight focus change, the theme's one
rationed gradient on the active-tab underline only, and `0.1s` snap
transitions.

## Components

Identical to concrete-signal — see its `design.md` for per-component notes;
behaviour is the same, only the palette differs. The full baseline twelve:
`.rb-btn` (+ `--primary/--accent/--danger/--ghost`, `--sm` compact size), `.rb-card` (+
`--raised`), `.rb-link`, the form set (`.rb-input`/`.rb-textarea`/
`.rb-select`/`.rb-label`/`.rb-field`/`.rb-choice`/`.rb-checkbox`/`.rb-radio`/
`.rb-switch`), `.rb-badge`, `.rb-alert`, `.rb-dialog`, `.rb-tabs`/`.rb-tab`/
`.rb-tabpanel`, `.rb-table` (+ `.rb-num`), `.rb-progress`/`.rb-spinner`,
`.rb-muted` (no italic — brutalism never softens with a slant), `.rb-pre`
(zero radius falls out of `--rb-radius` automatically).

## Dark counterpart

`concrete-signal` — the primary, dark look. This theme and it share the
same `--rb-*` baseline and `rb-*` classes, so switching `data-rb-style`
between them restyles a page without touching markup.

## Scoping

Every rule is guarded by `data-rb-style="concrete-signal-light"` (self or
ancestor), wrapped in zero-specificity `:where()`. Set the attribute on
`<html>` for a page or on a container for an embedded island.
