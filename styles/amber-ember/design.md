# amber-ember

The dark, espresso-ground counterpart of **amber-hearth**. Same warm,
hand-crafted editorial design language — clay/amber accent, the library's only
serif display voice (system serif for headings and titles over a humanist
system-ui body), the most generously rounded shape language in the library, and
warm-toned diffused shadows — rendered on a deep espresso ground instead of
warm cream. It ships the identical `rb-*` component set as amber-hearth — the
components are token-driven, so only the palette differs — and swaps in with a
single attribute flip.

## Color

| Role | Value | Usage |
| --- | --- | --- |
| Background | `#1c130c` (espresso) | Page canvas |
| Surface | `#26190f` | Cards, dialogs, panels |
| Surface 2 | `#331f13` | Raised/hover surface, active-tab wash base |
| Surface sunken | `#150e08` | Inset fields, progress troughs |
| Text | `#f5e9da` | Body text |
| Text soft | `#c9b39a` | Secondary text |
| Text faint | `#a68a6c` | Labels, table headers, meta |
| Border | `#40291a` | Resting hairline borders |
| Border strong | `#5a3a24` | Dialog edges, header rules |
| Accent | `#e08a3f` (warm amber) | The sole brand voice: emphasis, active state, focus |
| Accent fg | `#1c130c` | Dark espresso ink on the solid amber fill |
| Accent wash | `rgba(224,138,63,.18)` | Active/hover tint behind accent text |
| Info | `#5a9fc4` | Informational chips |
| Success | `#6ba26e` | Healthy/live status |
| Warning | `#dba748` | Caution status |
| Danger | `#d1614a` | Destructive actions, errors |

**Rules.** Colour is functional. Resting UI is espresso, near-black wells, and
warm neutral ink; amber appears only on interaction, focus, active state, and
emphasis. Colour beyond the accent is *earned* — severity and status badges are
the one place other hues appear. The one gradient (`--rb-accent-grad`, amber ->
clay -> gold) is rationed to exactly one place across the whole theme — the
active-tab underline — never spent twice.

## Typography

Identical to amber-hearth: a system serif stack (`"Iowan Old Style", "Palatino
Linotype", Palatino, Georgia, serif`) for headings, card titles, and dialog
titles at weight 700 with tight tracking (`-0.01em`) — the library's only serif
voice — over a `system-ui` body at weight 400. Labels stay normal-case, weight
600, tracked `0.04em`.

## Shape & effects

Identical to amber-hearth — see its `design.md` for the full detail. Radius
`0.875rem` (14px) for buttons/inputs/rows, `1.25rem` (20px) for cards/dialogs,
true pills for badges/progress; warm-toned diffused shadows (deepened to
near-black for the dark ground); transitions `0.18s`; 4px spacing rhythm; the
one gradient rationed to the active-tab underline only.

## Components

Class prefix `rb-`; the full amber-hearth inventory, styled identically from
tokens: `.rb-btn` (+ `--primary/--accent/--danger/--ghost`, `--sm` compact size, `.rb-icon-btn` icon-only square), `.rb-card` (+
`--raised`), `.rb-link` (+ `--active`), `.rb-nav-rail`, the form set (`.rb-input` /
`.rb-textarea` / `.rb-select` / `.rb-label` / `.rb-field` / `.rb-choice` /
`.rb-checkbox` / `.rb-radio` / `.rb-switch`), `.rb-badge`, `.rb-alert`,
`.rb-dialog`, `.rb-tabs` / `.rb-tab` / `.rb-tabpanel`, `.rb-table` (+
`.rb-num`, `--interactive`), `.rb-progress` / `.rb-spinner` (keyframe `rb-ember-spin`),
`.rb-muted`, `.rb-pre` (+ `.rb-log`). See amber-hearth's `design.md` for the per-component
notes — the behaviour is the same; only the palette is dark.

## Light counterpart

`amber-hearth` — the primary, light look. This theme and it share the same
`--rb-*` baseline and `rb-*` classes, so switching `data-rb-style` between them
restyles a page without touching markup.

## Scoping

Every rule is guarded by `data-rb-style="amber-ember"` (self or ancestor),
wrapped in zero-specificity `:where()`. Set the attribute on `<html>` for a page
or on a container for an embedded island.
