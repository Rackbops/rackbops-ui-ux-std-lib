# Rackbops UI/UX Standard

**Version 1 (draft, 2026-09-02).** The normative standard for everything in
this repository: the theme CSS under `styles/`, the React layer under
`components/react/`, the showcase under `site/`, and the agent skill under
`skills/`. It is what "matches the library" means. A theme, component, or doc
that follows it will not look out of place beside the twelve themes that
already ship; one that departs from it needs the reason written in the PR.

How it relates to the other governing files:

- `CLAUDE.md` says *how work ships* here -- the contract-test gate, the
  fidelity rule, the every-surface rule. This document says *what the
  contract is*.
- `skills/design-system/SKILL.md` is the consumer quick reference for apps
  that adopt a theme. It MUST agree with this document; where they differ,
  this document wins and SKILL.md gets fixed.
- `styles/test/*.test.mjs` and `components/react/src/*.test.tsx` are the
  mechanical enforcement. Where a rule here is tested, it says so.

**Key words.** MUST / MUST NOT is a hard requirement -- a change that violates
one is not done. SHOULD is the default; departing from it needs a stated
reason in the theme's `design.md`. MAY is optional.

**Enforcement tags.** `[tested]` -- a test fails when the rule is broken.
`[reviewed]` -- enforced only by the review gate in `CLAUDE.md`.
`[pending #N]` -- the rule is normative now; the mechanical check, or the fix
that brings every theme into line, lands with issue #N. Appendix B tabulates
current status so this document stays true of HEAD while describing the
target.

---

## 1. Principles

The concepts that keep twelve very different aesthetics reading as one
library. Every rule below descends from one of these.

1. **One contract, many voices.** Every theme declares the same `--rb-*`
   tokens and styles the same `rb-*` classes; a screen restyles by changing
   one attribute and no markup. A theme's identity lives in its *values*,
   never in its API.
2. **Inert until opted in.** Nothing applies unless an element or an ancestor
   carries `data-rb-style="<theme>"`. Several themes can load at once, and
   embedding inside a foreign page is safe.
3. **One accent voice; colour beyond it is earned.** A theme has exactly one
   accent and spends it on interaction, focus, active state, and emphasis.
   The only other hues are the four semantic ones, and they mean status,
   never decoration. (`styles/arcane-obsidian/design.md:39-44` states it;
   the studio, concrete, amber, mono-field, and ported themes restate it.)
4. **One depth mechanism, stated.** A theme picks how elevation reads --
   tonal luminance, a soft shadow ramp, hard offset shadows, glow, glass --
   and says so in one sentence of its `design.md`.
5. **One rationed gradient, or none.** `--rb-accent-grad` is spent in one or
   two named places and nowhere else. Primary buttons are always a solid
   fill.
6. **Three type roles, system stacks by default.** Display, body, mono. The
   app themes and the originals use system stacks (`system-ui`,
   `ui-monospace`, or a system serif) and load nothing; a ported theme that
   needs webfonts declares them in the manifest and still falls back to a
   system family.
7. **Quiet, optional motion.** One transition duration per theme, named
   properties only, and every animation or transition has a
   `prefers-reduced-motion` override.
8. **Documented with numbers.** A `design.md` states real values, real
   contrast ratios, and a real source. A claim untrue of the shipped CSS is a
   MAJOR defect (`CLAUDE.md`, "Fidelity is a hard rule").
9. **A semantic change reaches every surface.** Changing what a token or
   class *means* is not done until every theme, the React layer, every
   `design.md`, the showcase, README, SKILL.md, and this document agree
   (section 14.4).
10. **The contract is data; prose is derived from it.** Tokens, required
    classes, allowed omissions, and extras live in one machine-readable file
    that the tests read and the docs are generated from or checked against
    `[pending #47]`. A hand-maintained copy of the contract is a drift
    waiting to happen (#39, #40 were exactly that).

---

## 2. Anatomy of a theme

### 2.1 Files

A theme is a directory `styles/<theme-id>/` with exactly this layout:

| File | Contents | Rule |
| --- | --- | --- |
| `tokens.css` | One `:where([data-rb-style="<id>"]) { ... }` block: `color-scheme` plus every `--rb-*` token | MUST declare all 38 baseline tokens (section 4.1) and a `color-scheme` that matches the manifest `[tested]` |
| `base.css` | Canvas rule, box-sizing reset, page-only body rule, bare-element typography, links, focus, selection | MUST carry the bare-element property set (section 6) `[tested]` |
| `components/<name>.css` | One file per component: the shared set (section 5.1) plus any extras | MUST exist for every shared component `[pending #47]`; every selector guarded `[tested]` |
| `index.css` | `@import` of tokens, base, and every file in `components/` | MUST import every component file and contain no rules of its own `[tested]` |
| `design.md` | The written spec (section 11) | MUST follow the template; every claim verified against the CSS `[reviewed]` |
| `assets/` | Optional binaries (`rackbops-studio/assets/boppy.svg`, `neon-butterfly/assets/butterfly-circuit.png`) | MAY. Keep small: issue #42 measures the 1.3 MB PNG at 76% of the unpacked tarball |

### 2.2 File headers

Every CSS file opens with `/* <theme-id> -- <what this file is> */`. A
`tokens.css` header also carries the consumption snippet, the scoping note,
and the "(extra)" convention (`styles/rackbops-studio/tokens.css:1-15`). A
ported theme's `tokens.css` header and `design.md` both open with the
attribution block naming the upstream theme, its licence, and `NOTICE`
(`styles/luminous-precision/tokens.css:1-4`,
`styles/luminous-precision/design.md:3-8`).

### 2.3 Registration

A theme is not shipped until all of these agree `[tested]` (the "manifest,
package.json, and theme directories agree" and "all.css imports every theme
and nothing else" tests in `styles/test/contract.test.mjs`):

1. `styles/manifest.json` -- `"<id>": { "scheme": "dark"|"light", "fonts": [] }`;
   `fonts` holds https stylesheet URLs or is empty.
2. `styles/package.json` -- the directory in `files`, and four `exports`
   keys (`./<id>`, `./<id>/tokens`, `./<id>/base`, `./<id>/components/*`),
   each `{ "types": "./css-side-effect.d.ts", "default": "..." }`.
3. `styles/all.css` -- `@import "./<id>/index.css";`.
4. `README.md` -- a row in the themes table: scheme, source, one-line
   description.
5. `NOTICE` -- for a ported theme, the directory listed under its upstream's
   licence block.
6. `skills/design-system/SKILL.md` -- roster and extras updated
   `[pending #39]`; generated from the contract file once #47 lands.
7. `styles/contract.json` -- the theme's `extras` entry `[pending #47]`.

The showcase needs no change: it reads the manifest and injects any `fonts`
URLs on switch (`site/index.html:314-328`, `340-351`). The scaffold in #53
performs steps 1-7 mechanically `[pending #53]`.

### 2.4 Naming

- **Theme id:** lower-case kebab, `<family>-<look>` (`arcane-obsidian`,
  `amber-hearth`, `concrete-signal`).
- **Pairs** share the family word and differ in the look word
  (`arcane-obsidian` / `arcane-parchment`, `rackbops-studio` /
  `rackbops-noir`, `amber-hearth` / `amber-ember`), or suffix `-light` when
  the base name *is* the identity (`concrete-signal` /
  `concrete-signal-light`). The primary look is the one the source ships
  first; the counterpart's `design.md` opens by naming its sibling.
- **Keyframes:** `rb-<theme-short>-<motion>` (`rb-obsidian-spin`,
  `rb-studio-bop`, `rb-lp-pulse-glow`), unique across the whole library
  `[tested]`.
- Tokens and classes: sections 4.3 and 5.5.

### 2.5 Consumption units

The **package** is the install unit; the **theme** is the consumption unit.
`npm install @rackbops/styles` downloads all twelve themes (the tarball is
one package), but a consumer imports exactly one:

```css
@import "@rackbops/styles/arcane-obsidian";   /* this theme, nothing else */
@import "@rackbops/styles/all";               /* opt-in: every theme, for runtime switching */
```

Rules:

- A theme MUST be usable alone -- through its package export, and through
  its per-theme CDN URL
  (`https://cdn.jsdelivr.net/npm/@rackbops/styles/<id>/index.css`). Nothing
  from another theme is ever required.
- A shared file, when one exists (#52), is imported by the theme's own
  `index.css`, so a consumer never names it and the CDN URL still resolves
  it. The single-file artefact for vendoring and no-build use is the
  per-theme `bundle.css` `[pending #52]`; until it ships, a theme directory
  is copy-portable on its own.
- Because the whole package downloads regardless of which theme is used,
  assets are kept small (2.1) and the tarball ships only what themes need
  (#38 for `LICENSE`/`NOTICE`, #42 for the PNG).

---

## 3. Scoping and specificity

Every selector in every theme file contains its own guard
`[data-rb-style="<id>"]` `[tested]`. Four guard shapes are in use:

| Target | Selector shape | Specificity |
| --- | --- | --- |
| The canvas element (tokens, background, body font) | `:where([data-rb-style="x"])` | (0,0,0) |
| Page-only rules when the attribute is on `<html>` | `:where(html[data-rb-style="x"]) body` | (0,0,1) |
| Bare elements under the canvas | `:where([data-rb-style="x"], [data-rb-style="x"] *):where(h1, h2, ...)` | (0,0,0) |
| A component class | `:where([data-rb-style="x"], [data-rb-style="x"] *).rb-btn` | (0,1,0) |

Rules:

- Component rules are exactly one class deep, (0,1,0). A consumer overrides
  one with any later selector of equal or higher specificity. Do not call
  component rules "zero specificity" -- only the base layer is (issue #42
  flags README and SKILL.md for that over-claim).
- MUST NOT nest: element and modifier rules are `.rb-block__el` /
  `.rb-block--mod`, never `.rb-block .rb-block__el`.
- MUST NOT use `!important`.
- The attribute goes on `<html>` for a page the app owns, or on a mount
  container for an island; the canvas rule styles whichever element carries
  it (`styles/arcane-obsidian/base.css:5-16`).
- Several themes MAY load together (`@rackbops/styles/all`); switching is one
  attribute write. The showcase suppresses transitions during the flip
  (`site/index.html:36-39`); an app that switches at runtime SHOULD do the
  same.
- A shared structural file (#52) is guarded by the bare attribute
  `[data-rb-style]` -- any theme, still nothing outside one -- and is the
  only place that guard shape is allowed `[pending #52]`.

---

## 4. Token contract

### 4.1 The baseline (38 tokens)

Every theme MUST declare all of these on its canvas selector `[tested]`
(`styles/test/contract.test.mjs` `REQUIRED_TOKENS`; moves to
`styles/contract.json` with #47). Adding a name is a contract change:
bump the contract integer, add the token to all twelve themes, update
SKILL.md and this table.

**Canvas and surfaces**

| Token | Role | Rules of use |
| --- | --- | --- |
| `--rb-bg` | Page canvas | The attributed element's background |
| `--rb-surface` | Cards, panels, fields, dialog panes | The default raised surface |
| `--rb-surface-2` | Hover wash, secondary sections, raised-on-raised | One step above surface; the hover fill for rows and links |
| `--rb-surface-sunken` | Inset fields, log wells, progress troughs | The only "below the canvas" value |
| `--rb-text` | Body and headline ink | MUST clear 4.5:1 on `--rb-bg` and `--rb-surface` |
| `--rb-text-soft` | Secondary copy, table headers | SHOULD clear 4.5:1 |
| `--rb-text-faint` | Meta, footnotes, idle labels | MAY sit below AA; then MUST NOT carry essential text (see section 9) |
| `--rb-border` | Resting hairlines | Dividers, card edges |
| `--rb-border-strong` | Field borders, dialog edges, ghost outlines | The emphasised hairline |

**Accent**

| Token | Role | Rules of use |
| --- | --- | --- |
| `--rb-accent` | The single brand voice | Interaction, focus, active state, emphasis. Never decoration |
| `--rb-accent-fg` | Text on a solid accent fill | MUST clear 4.5:1 on `--rb-accent` -- this token exists so the primary button stays AA (`styles/arcane-obsidian/tokens.css` comment) |
| `--rb-accent-wash` | Tint behind accent text; focus ring halo | Low-alpha accent; the "active" background |
| `--rb-accent-grad` | The one rationed gradient | Spent in one or two named places (section 10); never on a primary button |

**Semantic**

| Token | Meaning |
| --- | --- |
| `--rb-info` | Informational |
| `--rb-success` | Healthy, live, done |
| `--rb-warning` | Caution |
| `--rb-danger` | Destructive action, error. MUST be distinguishable from `--rb-accent` (the studio pair keeps a rose danger against a vermillion accent) |

Semantic hues appear only on badges, alerts, danger buttons, and status
marks. They are never used as a second accent.

**Typography**

| Token | Role |
| --- | --- |
| `--rb-font-display` | Headings, wordmark, dialog titles. MAY be mono (arcane), sans (studio, concrete, mono-field), or serif (amber) |
| `--rb-font-body` | Body and UI chrome |
| `--rb-font-mono` | Code, eyebrows, meta, tabular data |
| `--rb-font-weight` | Body weight (400) |
| `--rb-font-weight-medium` | Labels, buttons, active states |
| `--rb-font-weight-bold` | Headlines; the studio's 800 is its signature |
| `--rb-heading-tracking` | Letter-spacing on display text |
| `--rb-label-tracking` | Letter-spacing on uppercase labels and eyebrows |
| `--rb-text-sm` | The control size: buttons, inputs, badges, table cells |

**Shape, effects, spacing**

| Token | Role |
| --- | --- |
| `--rb-radius` | Buttons, inputs, rows |
| `--rb-radius-lg` | Cards, dialogs |
| `--rb-radius-pill` | Chips, badges, progress troughs (concrete-signal sets `0.125rem`: near-square is a valid reading) |
| `--rb-shadow-sm` | Resting elevation |
| `--rb-shadow-lg` | Lifted: dialogs, raised cards, hover lift |
| `--rb-blur` | Backdrop blur for overlay surfaces (the dialog backdrop). MAY be `0px` -- the concrete pair never blurs |
| `--rb-transition` | The one duration; every transition uses it |
| `--rb-space-1` .. `--rb-space-5` | The five-step spacing ladder; values are the theme's own (arcane and mono-field run `0.25-1.5rem`, the studio `0.5-2.25rem`) |

**Pending additions -- contract 2** `[pending #54]`

| Token | Role |
| --- | --- |
| `--rb-focus-ring` | The `outline` value for `:focus-visible`; one place a theme says what focus looks like (today four base files and a handful of component files each hard-code their own, and eight base files have none -- #36) |
| `--rb-ease` | The `transition-timing-function`; `ease` by default, the ports' bounce where they want it (summer-cloud already carries `--rb-ease-bounce` as an extra) |

Deliberately not added: a type scale, z-index tokens, a density axis,
`--rb-radius-sm`. No shared component needs them, and every baseline token
is one more thing twelve themes must declare and document.

### 4.2 Rules of use

- **Tokens, not literals.** Component CSS MUST take every colour, font,
  radius, shadow, and spacing value from a token. Permitted literals: alpha
  overlays and scrims (`rgba(0,0,0,.3)` on a backdrop), `color-mix()`
  derivations of a token, and `#fff`/`#000` inside such a mix.
- `--rb-shadow-sm` is resting and `--rb-shadow-lg` is lifted. A theme MAY
  invert or flatten that (summer-cloud wears `lg` at rest by design,
  `styles/summer-cloud/design.md:33-37`) only if its `design.md` says so.
- A theme whose depth is not shadow (glow, hard offset, luminance) still
  declares both shadow tokens with values that read correctly, so a shared
  component that uses them is never broken.
- A token that exists for a purpose is used for it: the dialog backdrop
  blurs with `var(--rb-blur)`, not a literal (two ports hard-code
  `blur(4px)` today -- #42) `[pending #47]`.

### 4.3 Extras

A theme MAY declare tokens beyond the baseline. Rules:

- Namespaced `--rb-<name>`, marked `(extra)` in a `tokens.css` comment, and
  listed in `design.md` (the ported themes' "Token mapping" section is the
  model, `styles/summer-cloud/design.md:19-37`).
- Only that theme's own component CSS may rely on an extra. Shared React
  components MUST NOT reference one.
- Recognised extra families, so new themes reuse the names instead of
  inventing them:
  - `--rb-code-keyword|string|number|comment|function|variable|type|meta` --
    the eight code-syntax tokens (arcane pair, the three ports). Palette
    voices reused, never new hues.
  - `--rb-accent-2` (+ `-glow`) -- a second accent for a dual-accent port.
    The baseline stays single-accent; the second voice is an extra by
    definition.
  - `--rb-surface-glass`, `--rb-accent-glow`, `--rb-accent-border` -- glass
    and glow mechanics (the three ports); `--rb-bg-blend` (neon-butterfly,
    summer-cloud).

### 4.4 The contract file and versioning

`styles/contract.json` is the single source for the baseline token list, the
required class list (5.1), the documented-omission allowlist (5.3), and each
theme's extras (5.4) `[pending #47]`. The contract test reads it; SKILL.md's
inventory is generated from it; the tables in this document are checked
against it. `manifest.json`'s `contract` integer MUST equal the file's, and
it bumps when a baseline token is added (every theme must then declare it)
or when a token or class is removed, renamed, or changes meaning. Adding a
required class is additive and does not bump -- `rb-nav-rail`, `rb-log`,
`rb-icon-btn`, `rb-table--interactive`, and `rb-stepper` all landed at
contract 1. A consumer that reads the manifest can refuse a contract it
does not know. Until #47 lands, `REQUIRED_TOKENS` in `contract.test.mjs` is
the token list and this document is the class list.

---

## 5. Class contract

### 5.1 The shared component set

Every theme MUST ship these files and style every selector in the "Required
selectors" column `[tested today: .rb-btn--sm, .rb-icon-btn,
.rb-table--interactive; the full list pending #29 / #47]`. The React column
is the `@rackbops/ui-react` export that emits the class.

| File | Required selectors | React | Notes |
| --- | --- | --- | --- |
| `button.css` | `.rb-btn`, `--primary`, `--accent`, `--danger`, `--ghost`, `--sm`, `:disabled`; `.rb-icon-btn` | `Button` | `--ghost` unstyled in luminous-precision and neon-butterfly `[pending #29]`; disabled buttons still take `:hover` in all twelve `[pending #37]` |
| `card.css` | `.rb-card`, `--raised` | `Card` | `--raised` unstyled in five themes `[pending #29]` |
| `link.css` | `.rb-link`, `--active` | `NavLink` | `--active` unstyled in luminous-precision and neon-butterfly `[pending #29]`; SHOULD also match `[aria-current="page"]` (one theme does) `[pending #47]` |
| `nav-rail.css` | `.rb-nav-rail` | `NavRail` | Composes `.rb-link`; owns no active convention |
| `form.css` | `.rb-field`, `.rb-label`, `.rb-input`, `.rb-textarea`, `.rb-select`, `.rb-choice`, `.rb-checkbox`, `.rb-radio`, `.rb-switch` | `Field`, `Label`, `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch` | Choice controls SHOULD use `accent-color` (seven themes do; the concrete pair draws checked states as a flat accent fill by design, `styles/concrete-signal/design.md:104-106`; the ports hand-style them) |
| `badge.css` | `.rb-badge`, `--info`, `--success`, `--warning`, `--danger` | `Badge` | Status text is never colour-only: the label carries the meaning |
| `alert.css` | `.rb-alert`, `__title`, `--info`, `--success`, `--warning`, `--danger` | `Alert` | |
| `dialog.css` | `.rb-dialog`, `__title`, `__actions`; `__body` | `Dialog` | `__body` is a no-op in four themes that pad `.rb-dialog` instead -- sanctioned by #42's verdict, allowlisted once #47 lands (section 5.3) |
| `tabs.css` | `.rb-tabs`, `.rb-tab`, `.rb-tab--active`, `.rb-tabpanel` | `Tabs` | SHOULD pair `--active` with `[aria-selected="true"]` (six themes do) `[pending #47]` |
| `table.css` | `.rb-table`, `--interactive`, `.rb-num` | -- | `.rb-num` unstyled in luminous-precision and neon-butterfly `[pending #29]` |
| `progress.css` | `.rb-progress` on a native `<progress>` (`appearance: none`, `::-webkit-progress-bar`, `::-webkit-progress-value`, `::-moz-progress-bar`); `.rb-spinner` | `Progress`, `Spinner` | Six themes style a `div.rb-progress__bar` instead, which the React `Progress` can never render `[pending #28]` |
| `muted.css` | `.rb-muted` | -- | |
| `pre.css` | `.rb-pre` | -- | |
| `log.css` | `.rb-log` (pairs with `.rb-pre`) | -- | |
| `stepper.css` | `.rb-stepper`, `__step`, `__node`, `__label`, `--complete`, `--current` | `Stepper` | In all twelve since #55 (closes #18). `--upcoming` is emitted by `Stepper` as the resting state and no theme declares a rule for it -- allowlist as "default state" or add the rule `[pending #47]`; SHOULD match `[aria-current="step"]` (no theme does) `[pending #47]`; no parity test yet `[pending #29]` |

Do not state the *count* of shared files in prose anywhere -- `design.md`
files that said "the baseline ten" and "twelve" were both stale before #55
merged and are staler after it (issue #40). Link this table instead.

### 5.2 Parity

The contract test MUST hold a `REQUIRED_CLASSES` list parallel to
`REQUIRED_TOKENS`, read from `contract.json`, and check each theme's parsed
selectors against it `[pending #29 / #47]`. The list is derived from what
`@rackbops/ui-react` actually emits -- every export rendered with every
class-adding prop -- plus the CSS-only utilities `[pending #48]`, so the
class contract cannot drift from what consumers get. A class in the list is
either styled in every theme or entered in the allowlist below.

A light/dark pair MUST ship an identical component set: the two
`components/` directories are byte-identical after normalising the guard
string, or the differing file is named in both `design.md`s
`[pending #47]`. Every pair's `design.md` already makes this claim.

### 5.3 Documented omissions

A required class MAY be a deliberate no-op in one theme only when all three
hold: the theme's `design.md` says so and why; the allowlist entry in
`contract.json` names theme, class, and reason; and the React component's
JSDoc or SKILL.md carries the caveat. At HEAD no case meets all three:
`.rb-dialog__body` in luminous-precision, mono-field, neon-butterfly, and
summer-cloud (which pad `.rb-dialog`) is sanctioned only by #42's verdict;
its allowlist entry, `design.md` sentence, and JSDoc caveat land with #47
and #29.

### 5.4 Theme extras

A theme MAY ship classes beyond the shared set. Rules:

- Guarded like any rule, in their own `components/<name>.css` -- or, for an
  opt-in page background only, in `base.css` (the ports' `.rb-bg`,
  `styles/summer-cloud/base.css:39`) -- imported by `index.css` `[tested]`.
- Documented under `### Theme extras` in that theme's `design.md`, listed
  under the theme in `contract.json` `[pending #47]`, and in SKILL.md's
  extras list `[pending #39]`.
- Never emitted by a shared React component. `LinksIndex` is the model: it
  composes `Card` and `Badge` and adds no class of its own
  (`components/react/src/LinksIndex.tsx:28-30`).
- Shown in the showcase only in a section labelled as extras (section 13).

Extras shipping today: `.rb-wordmark` (+ `__spark`), `.rb-tabstrip` (+
`__tab`, `__tab--active`), `.rb-eyebrow` -- arcane pair, and `.rb-eyebrow`
also in the studio pair; `.rb-rack` (+ `__top`, `__live`, `__bars`,
`__foot`), `.rb-principles`, `.rb-principle` (+ `__n`, `__body`), `.rb-tags`,
`.rb-tag`, `.rb-card__tag`, `.rb-btn__arrow` -- studio pair;
`.rb-badge--primary`, `.rb-bg`, `.rb-progress__bar--accent` -- the three
ports; `.rb-chip` (+ `--selected`), `.rb-card--floating` -- summer-cloud.
(`.rb-progress__bar` itself in six themes is the #28 contract split, not an
extra.) `.rb-eyebrow` is in four themes, not the shared set, despite being
listed as shared in SKILL.md and rendered unlabelled in the showcase
(issue #39).

### 5.5 Naming

- Block `.rb-<block>`, element `.rb-<block>__<el>`, modifier
  `.rb-<block>--<mod>`. Lower-case kebab throughout. `.rb-icon-btn` predates
  this rule and is in a contract test; it stays, but new modifiers follow
  `--<mod>`.
- Semantic modifiers use exactly the four semantic names. Size modifiers use
  `--sm`. State modifiers are `--active`, `--interactive`, `--raised`,
  `--complete` / `--current` / `--upcoming`.
- Where an ARIA state expresses the same thing, the CSS SHOULD match both
  (`.rb-tab--active, .rb-tab[aria-selected="true"]`), so markup that is
  correct for assistive tech is also correctly styled.
- A utility that applies to any element is a bare block (`.rb-muted`,
  `.rb-num`, `.rb-pre`, `.rb-log`).

### 5.6 Markup

Native elements first, with the class on the element itself: `<button>`,
`<dialog>`, `<progress>`, `<input type="checkbox" role="switch">`,
`<table>`. A component MUST NOT require wrapper divs a theme could style
differently -- every theme must work against the same markup, which is what
the React layer and the showcase emit.

---

## 6. The base layer

`base.css` styles bare elements so that a markdown render, a docs page, or
an unclassed prototype is already on-theme. The property *set* is shared;
the values are the theme's own `[tested: styles/test/base-typography.test.mjs
checks the property names of the h1-h6, p, and ul/ol rules]`.

| Rule | Required declarations |
| --- | --- |
| Canvas `:where([data-rb-style="x"])` | `background-color`, `color`, `font-family`, `font-weight`; MAY add `font-variant-numeric: tabular-nums` (the arcane pair does) |
| Box-sizing reset on `*`, `::before`, `::after` | `box-sizing: border-box` |
| `:where(html[data-rb-style="x"]) body` | `margin: 0`, `min-height: 100vh`, plus the canvas set |
| `h1`-`h6` (all six listed explicitly) | `margin` (`0 0 var(--rb-space-3)`), `font-family` (display), `font-weight`, `letter-spacing`, `line-height` `[tested]`; `text-wrap: balance` (in all twelve, not tested) |
| `p` | `margin: 0 0 var(--rb-space-3)` `[tested]` |
| `ul`, `ol` | `margin`, `padding-inline-start: var(--rb-space-4)` `[tested: property names]`; real markers, not stripped |
| `a` | `color: var(--rb-accent)`. The studio pair uses `inherit` (`styles/rackbops-studio/base.css:49-50`) -- a documented departure it MUST state in `design.md` `[pending #36]` |
| `:focus-visible` | `outline: 2px solid var(--rb-accent)`, `outline-offset: 2px` (`var(--rb-focus-ring)` after #54) -- present in four of twelve today, the studio pair at 2.5 px / 3 px offset `[pending #36]` |
| `::selection` | `background: var(--rb-accent)`; `color` is the ink that reads on it (`--rb-accent-fg` in seven themes, `#fff` or `--rb-bg` in the other five) |

The box-sizing reset is identical in every theme modulo the guard;
`:focus-visible` (where present) and `::selection` differ only in values
that `--rb-focus-ring` (#54) and `--rb-accent-fg` absorb. All three move to
one shared structural file each `index.css` imports first `[pending #52]`,
leaving `base.css` with the values that are genuinely per theme.

A theme MAY add an opt-in page background class (`summer-cloud`'s `.rb-bg`
sky gradient) as an extra; the flat `--rb-bg` MUST remain correct without it.

---

## 7. Interaction states

Every interactive component in every theme MUST define these states. How
each looks is the theme's voice; that it exists is the contract.

| State | Rule |
| --- | --- |
| Rest | The token-driven default |
| Hover | A visible change (fill, border, or lift) that is never the only affordance -- the resting state must already read as interactive |
| `:focus-visible` | Visible, accent-based, on every focusable element. A component MAY replace the base outline (buttons swap it for an accent border, `styles/arcane-obsidian/components/button.css:39-43`) but MUST NOT remove it without a replacement |
| Active / selected | `--active` (links, tabs), `--current` (stepper); paired with the ARIA state where one exists |
| Disabled | `opacity` + `cursor: not-allowed`, and no hover response: hover rules are scoped `:not(:disabled)` `[pending #37]` |
| Press | MAY dip or scale (the studio's 1 px dip); MUST respect reduced motion |

Transitions and animations:

- `transition` lists named properties (`border-color`, `background`,
  `color`, `transform`, `box-shadow`) with `var(--rb-transition)` (and
  `var(--rb-ease)` after #54). MUST NOT use `transition: all` (zero
  occurrences today).
- Every `transition` and `animation` MUST be neutralised under
  `@media (prefers-reduced-motion: reduce)`. Transitions collapse through
  the token -- one block per theme in `tokens.css` sets `--rb-transition:
  0s` `[pending #51]`; today that is a per-file block, and nine port files
  that transition have none (listed in #51). Keyframe animations keep an
  explicit per-file override, set to `none` or a slow, non-essential
  fallback (the spinner slows to 2 s rather than stopping,
  `styles/arcane-obsidian/components/progress.css:36-40`).

---

## 8. Typography

- Three roles (section 4.1). Body is a system sans in the nine system-stack
  themes; the ports' body stacks fall back to a system family -- Inter to
  `ui-sans-serif` (summer-cloud), JetBrains Mono to `ui-monospace`
  (luminous-precision, neon-butterfly).
- **Display voice is the theme's biggest single choice** and MUST be named
  in the `design.md` identity paragraph: mono (arcane), heavy 800 sans
  (studio), heavy uppercase sans (concrete), serif (amber), quiet sans
  (mono-field), Sora / JetBrains Mono / Plus Jakarta Sans (the ports).
- **Label voice.** A theme states how each label surface reads -- eyebrow,
  badge, table header, form label -- and the CSS matches the statement.
  The dominant readings today: uppercase-tracked mono (arcane, studio, the
  ports), uppercase sans (the concrete pair -- mono is reserved for code
  there, `styles/concrete-signal/design.md:47-55`), normal case
  (mono-field, `styles/mono-field/design.md:7-9`; the amber pair). A
  departure within a theme is allowed only when stated: arcane's table
  header is body-sans normal case while its badge is mono uppercase
  (`styles/arcane-obsidian/components/table.css:9-15`, `badge.css:10-14`),
  but `styles/arcane-obsidian/design.md:52` claims mono uppercase for
  table headers -- a fidelity defect, noted on #40. The studio badge is
  mono but not uppercase (`rackbops-studio/components/badge.css:11`);
  summer-cloud's form label is body font, normal case (`form.css:13`).
- **Numerals.** Data that aligns in columns uses tabular numerals: `.rb-num`
  on cells, or `font-variant-numeric: tabular-nums` on the canvas for a
  data-dense theme.
- **Sizes.** `--rb-text-sm` is the control size. Body size is set in
  `base.css` per theme (the studio runs 17 px / 1.6).
- **Webfonts.** Only a ported theme lists `fonts` in the manifest; every
  stack still ends in a system family. A system-stack theme MUST NOT add
  webfonts (`CLAUDE.md`, Conventions). Consumers inject the manifest URLs;
  the showcase shows how.

---

## 9. Colour and accessibility

- `color-scheme` is declared in `tokens.css` and matches the manifest
  `[tested]`.
- **Targets.** Body text and control labels on their surfaces: 4.5:1. Large
  or bold text, non-text elements (borders, focus rings, semantic bars):
  3:1. `--rb-accent-fg` on `--rb-accent`: 4.5:1. These are computed from
  `tokens.css` by a test for the fixed token pairs `[pending #49]`; a
  failing pair is either fixed or allowlisted with the `design.md` line that
  documents it.
- **Deviations are documented, never discovered.** Every place a theme sits
  below those targets is listed in a `## Accessibility` section of its
  `design.md` with the ratio and the compensating rule
  (`styles/rackbops-studio/design.md:77-100` is the model: vermillion as
  text is ~3.6:1, so accent-coloured text is decorative only). Every theme
  MUST carry the section, even if it reads "the computed pairs pass; no
  deviations" `[reviewed; one theme has it today; #49 gives each section a
  test to cite]`.
- **Status is never colour-only.** Badges carry text, alerts carry a title
  or body, stepper nodes differ by icon and border (#18, shipped in #55).
- Dark resting palettes SHOULD avoid pure white and pure black
  (`styles/arcane-obsidian/design.md:42-43`); light themes MAY use `#ffffff`
  for raised surfaces.
- Semantic colours as small text on a light surface are often below AA
  (`styles/rackbops-studio/tokens.css:38-42`); a theme renders them as a
  tint fill with ink text, or as a bar or border, rather than as text.

---

## 10. Shape, depth, and motion

- **Radii.** Three tokens; each theme states its reading (the studio's
  roomy 11 / 15 px, arcane's 7 / 12 px, concrete-signal's zero).
- **Depth.** One primary mechanism, named in `design.md`:

  | Mechanism | Themes |
  | --- | --- |
  | Tonal luminance + restrained shadow ramp | arcane-obsidian |
  | Flat two-step shadow ramp | arcane-parchment |
  | Soft two-step shadow | studio pair, mono-field (barely perceptible) |
  | Hard offset shadow, no blur | concrete pair |
  | Warm diffused shadow | amber pair |
  | Glow and glass | luminous-precision, neon-butterfly, summer-cloud |

  `--rb-blur` is for overlay surfaces: ten themes blur the dialog backdrop,
  eight of them through the token (the concrete pair sets `0px` and never
  applies `backdrop-filter`, `styles/concrete-signal/design.md:67-69`; two
  ports hard-code `blur(4px)` where the token is the rule -- #42). Glass on
  resting surfaces is a theme choice, never a shared-component assumption.
- **Gradient ration.** `--rb-accent-grad` is used in component CSS in
  exactly eleven places across the library: the active-tab underline
  (arcane, amber, concrete pairs, mono-field), the wordmark (arcane pair),
  and the rack bars (studio pair). A new theme names its one or two places
  in `design.md` or declares the token and spends it nowhere. Never a
  primary button.
- **Motion.** `--rb-transition` runs 0.1 s (concrete) to 0.3 s (the ports);
  one value per theme, with `--rb-ease` as its timing function after #54.
  Decorative animation (the rack's bop and pulse) is an extra, never on a
  shared component.

---

## 11. The `design.md` template

Sections in this order. Required unless marked.

1. `# <theme-id>`
2. **Attribution block** (ported themes only): upstream repo and theme,
   licence, `NOTICE` link, "the aesthetic is theirs; only names changed".
3. **Identity paragraph.** One paragraph naming: the source (app, upstream,
   or "original"); primary scheme and the sibling if paired; three to five
   signature traits; the depth mechanism; the display voice; the label
   voice; the accent philosophy in a sentence. This paragraph is what the
   README row summarises.
4. `## Token mapping` (ported or dual-accent themes only): how upstream
   roles map to baseline tokens and which are extras.
5. `## Color` -- a `Role | Value | Usage` table covering every baseline
   colour token and every colour extra, followed by a **Rules** paragraph on
   how colour is spent.
6. `## Typography` -- display, body, mono, labels, numerals, and the
   bare-tag treatment.
7. `## Shape & effects` -- radii, depth, focus, the gradient's places,
   transition duration and easing, spacing.
8. `## Accessibility` -- every below-target ratio with its compensating
   rule, or "no deviations", citing the contrast test once it exists
   `[reviewed; pending adoption]`.
9. `## Components` -- one bullet per shared component in the order of the
   section 5.1 table, each naming its modifiers and how the theme reads
   them. No counts.
10. `### Theme extras` (if any).
11. `## Code syntax` (if the theme declares `--rb-code-*`).
12. `## Dark counterpart` / `## Light counterpart` (paired themes): a
    pointer to the shipped sibling directory. A full palette table belongs
    here only while the sibling is unshipped, and the "not shipped yet"
    sentence MUST come out the day it ships (issue #40 caught two that
    did not).
13. `## Deviations from the <source>` (ported themes, where any).
14. `## Scoping` -- the standard two-sentence boilerplate.

Every value in the document is copied from `tokens.css` or measured, never
recalled. `CLAUDE.md`'s fidelity rule applies: a wrong value or a stale
claim is MAJOR.

---

## 12. The React layer (`@rackbops/ui-react`)

Theme-agnostic by construction: a component renders the shared class, maps
props to modifiers, and never branches on the theme.

| Rule | Where it holds today |
| --- | --- |
| One export per shared component, from `src/index.ts`, with a named props type | `components/react/src/index.ts`; `Field` and `Spinner` take an inline `HTMLAttributes` today and SHOULD get named types |
| Each prop that adds a class says so in JSDoc: "Maps to `.rb-btn--{variant}`" | `Button.tsx:5-13` |
| The base class first, modifiers next, consumer `className` last, via `cx` | `Button.tsx:29-35`; tested in `Button.test.tsx:68-77` |
| `...rest` spreads onto the root element so `id`, `data-*`, `aria-*`, handlers all reach it | every wrapper except `Dialog` and `Tabs` `[pending #31]`; a labelled `Checkbox`/`Radio`/`Switch` puts it on the inner `<input>`, not the `.rb-choice` wrapper (`form.tsx:44-55`, #42 overflow) |
| `forwardRef`, with `RefAttributes<T>` on the props type | none today `[pending #30]` |
| Native semantics by default: `type="button"`, `aria-current="page"` on an active link, `role="alert"`, `role="status"` + `aria-label` on the spinner, native `<dialog>` with `aria-labelledby`, ARIA tablist with roving tabindex | `Button.tsx:20`, `NavLink.tsx:12`, `feedback.tsx:22,40-41`, `Dialog.tsx:26-31`, `Tabs.tsx:41-63` |
| Controlled by the caller, no hidden state: `NavRail activeId`, `Dialog open` | `NavRail.tsx:14-16`; `Dialog` reconciles `open` on every render `[pending #31]`; `Tabs` MAY keep its selection until a controlled API is in scope |
| No theme-specific class, no extra, no `style` that a theme would own. Structural layout a theme has no opinion on (a grid) MAY be inline, and says why in a comment | `LinksIndex.tsx:28-39` |
| A prop that is a no-op in some theme is a contract gap, not a JSDoc caveat | `Card.tsx:5` today; closes with #29 / #48 |
| Tests render to static markup and assert the class list per prop, composition, and passthrough; the same renders feed the derived class set | `Button.test.tsx`, `NavRail.test.tsx`, `LinksIndex.test.tsx`, `Stepper.test.tsx`; `node:test` + `tsx` + `react-dom/server`; `[pending #48]` for the derivation |

---

## 13. The showcase (`site/`)

The showcase is the library's visual acceptance test. It MUST:

- render every required selector in section 5.1 in every state the CSS
  defines (rest, hover-able, disabled, active, every semantic variant,
  `--sm`, icon-only, interactive rows, a streaming log). Today it renders
  no `.rb-alert--warning` (`site/index.html:232-234`) and no
  `[aria-selected="true"]` on the active tab `[pending #50]`;
- put theme extras only in sections labelled as extras
  (`site/index.html:288`), never in a generic section (the wordmark and
  eyebrow at lines 50-54 and the `rb-btn__arrow`, `rb-card__tag` in generic
  sections are out of contract -- issue #39);
- read the roster from the manifest and inject fonts on switch;
- style its own chrome (`.sc-*`) with tokens only, so it is on-theme under
  every theme (`site/index.html:9-40`);
- demonstrate a new component in every state in the same PR that adds it;
- be photographed: a separate `pnpm visual` job screenshots every section
  under every theme against committed baselines `[pending #50]`. A new
  theme's PR carries its baseline set -- that is the review artefact for
  "does it look out of place".

---

## 14. Processes

### 14.1 Adding a theme

1. Pick the provenance and say it in the identity paragraph: reverse-
   documented from a Rackbops app (verify every value against that app's
   CSS), ported from `nazuraki/ui-std-lib` (attribution block, `NOTICE`),
   or original (built to this contract, no source to verify against -- the
   fidelity rule then binds `design.md` to the CSS).
2. Decide the pair, by this policy:
   - A theme reverse-documented from a Rackbops app MUST ship both schemes,
     as two directories, so the app can offer a mode toggle (the arcane and
     rackbops pairs).
   - An original SHOULD ship both; a standalone original states why in its
     identity paragraph (mono-field does). A dark sibling for mono-field is
     the obvious gap.
   - A ported theme is exempt: it ships the schemes its upstream ships, for
     fidelity.
   - A pair is identical in everything but `tokens.css` and the values
     `design.md` tables (5.2) `[pending #47]`.
3. Scaffold with `pnpm new-theme <id> --scheme <s> --from <closest>`
   `[pending #53]`; until then copy the closest theme's layout, re-guard
   every selector, rename every keyframe, and fill all 38 tokens.
4. Restate in `design.md`: the depth mechanism, display voice, label voice,
   gradient places, transition duration, and the Accessibility section.
5. Style every required selector in section 5.1; add extras only with a
   `### Theme extras` entry.
6. Register per section 2.3.
7. `pnpm --filter @rackbops/styles test`, `pnpm --filter @rackbops/ui-react
   test`, `pnpm build`; then open the showcase and walk every section under
   the new theme (and commit its screenshot baselines once #50 exists).
8. Run the review gate (`CLAUDE.md`).

### 14.2 Adding or changing a shared component

Issue #18 (`rb-stepper`, shipped as #55) is the model intake. The issue
MUST carry:

- the class contract (block, elements, modifiers, ARIA state), and the
  markup the React component and showcase will emit;
- a cross-theme token-mapping table for every state, verified against each
  theme's own `tokens.css`, not copied from one theme;
- accessibility requirements (state not colour-only, the ARIA attribute);
- an acceptance checklist: implemented and guarded in every theme; the
  React export; all twelve `design.md` files; the showcase in every state;
  SKILL.md; the `contract.json` entry; both test suites green.

A change to an existing component's *meaning* (a modifier's semantics, a
default state) follows the same list and bumps the contract.

### 14.3 Changing a token's meaning

Bump the contract integer; update all twelve `tokens.css`, every
`design.md` Color table, SKILL.md, section 4.1 of this document, and any
React JSDoc that names it. Adding a baseline token is the same list plus
the `contract.json` (today `REQUIRED_TOKENS`) entry. #54 is the worked
example.

### 14.4 The every-surface list

A semantic change is complete only when all of these agree: the twelve
`tokens.css` / `base.css` / `components/*.css`; `components/react/src`;
the twelve `design.md`; `site/index.html`; `README.md` (themes table and
consuming section); `skills/design-system/SKILL.md`; `styles/contract.json`
(#47); `CLAUDE.md` where it names the rule; and this document.

### 14.5 Shipping

Docs-only changes that assert facts about the code (a `design.md`, this
document, SKILL.md) take the single claims-vs-code audit lane; changes with
a behaviour surface take the full review gate. Both are defined in the
personal `CLAUDE.md`; the repo `CLAUDE.md` names the tests that must be
green before staging.

---

## 15. Adoption in Rackbops apps

This is the org-wide decision the library exists for. An app that adopts a
theme:

- **Picks by kind, not by taste.** A console or internal tool defaults to
  `arcane-obsidian`, with `arcane-parchment` as its light mode. A
  public-facing or marketing surface defaults to `rackbops-studio`, with
  `rackbops-noir` as its dark mode. The other eight themes are opt-in for
  variety and experiments; an app that picks one says why in its own
  `README.md` or `CLAUDE.md`.
- **Offers a mode toggle only on a pair.** Toggling is one attribute write
  with both themes loaded; a standalone theme has no toggle.
- **Installs the package, consumes one theme** (section 2.5), sets the
  attribute on `<html>` or the mount container, injects the manifest `fonts`
  for a webfont theme, and validates configured theme names against the
  manifest rather than a hard-coded list.
- **Uses tokens, not literals; existing components first; gaps go
  upstream; reads the theme's `design.md` before designing screens** -- the
  four rules of `skills/design-system/SKILL.md`, which is the installable
  form of this section (copy or symlink it into the app's
  `.claude/skills/design-system/`).
- **Overrides by adding, not editing.** An app-local rule beats a component
  rule with any later single-class selector (section 3); an app never edits
  the package's CSS.

---

## Appendix A -- The roster

| Theme | Scheme | Provenance | Pair | Accent | Depth | Display voice | Fonts |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `arcane-obsidian` | dark | artifact-console | `arcane-parchment` | `#8b7cf6` arcane-violet | luminance + shadow ramp | mono | system |
| `arcane-parchment` | light | artifact-console | `arcane-obsidian` | `#6a4fe0` | flat shadow | mono | system |
| `rackbops-studio` | light | rackbops.com | `rackbops-noir` | `#ef4d28` vermillion | soft two-step shadow | 800 sans | system |
| `rackbops-noir` | dark | rackbops.com | `rackbops-studio` | `#ff5d3d` | soft two-step shadow | 800 sans | system |
| `luminous-precision` | dark | port: nazuraki | -- | `#c6a5ff` orchid (+ teal extra) | glow + glass | Sora | webfonts |
| `neon-butterfly` | dark | port: nazuraki | -- | `#d2bbff` lilac (+ lime extra) | glass over navy | JetBrains Mono, uppercase | webfonts |
| `summer-cloud` | light | port: nazuraki | -- | `#4500d9` violet (+ sky extra) | white glass on sky gradient | Plus Jakarta Sans | webfonts |
| `concrete-signal` | dark | original | `concrete-signal-light` | `#ff5e1a` safety-orange | hard offset, zero radius | heavy uppercase sans | system |
| `concrete-signal-light` | light | original | `concrete-signal` | `#cc4611` | hard offset, zero radius | heavy uppercase sans | system |
| `amber-hearth` | light | original | `amber-ember` | `#b5542c` clay | warm diffused shadow | system serif | system |
| `amber-ember` | dark | original | `amber-hearth` | `#e08a3f` amber | warm diffused shadow | system serif | system |
| `mono-field` | light | original | -- | `#1d2733` ink | near-flat hairlines | quiet sans, no uppercase | system |

Values from each theme's `tokens.css`; descriptions from its `design.md`
identity paragraph and the README table.

## Appendix B -- Enforcement status at HEAD

| Rule | Mechanism | Status |
| --- | --- | --- |
| Every selector guarded | `contract.test.mjs` | live |
| 38 baseline tokens + `color-scheme` per theme | `contract.test.mjs` | live |
| `color-scheme` matches manifest | `contract.test.mjs` | live |
| manifest / package.json / dirs / all.css agree | `contract.test.mjs` | live |
| `index.css` imports every component file, no rules | `contract.test.mjs` | live |
| Keyframes `rb-`-prefixed, unique | `contract.test.mjs` | live |
| `.rb-btn--sm`, `.rb-icon-btn`, `.rb-table--interactive` in every theme | `contract.test.mjs` | live |
| Bare h1-h6 / p / ul,ol property names | `base-typography.test.mjs` | live |
| Every export type-checks under `noUncheckedSideEffectImports` | `types.test.mjs` | live |
| React prop -> class mapping, composition, passthrough | `src/*.test.tsx` | live (Button, NavRail, LinksIndex, Stepper) |
| `transition: all` absent | review (Grep: 0) | live |
| Contract as data (`contract.json`), SKILL.md generated, pair parity | new test + generator | pending #47 |
| Full `REQUIRED_CLASSES` parity + allowlist | `contract.test.mjs` | pending #29 / #47 |
| Required class set derived from React emissions | new test | pending #48 |
| Every shared component file exists per theme | `contract.test.mjs` | pending #47 (only button/table opened by name today) |
| Contrast ratios for the fixed token pairs | new test | pending #49 |
| Showcase complete (warning alert, `aria-selected`) and photographed per theme | showcase + `pnpm visual` | pending #50 |
| Every transition reduced under `prefers-reduced-motion` | token block | pending #51 (64 of 73 files today; nine port files have none) |
| Shared structural base; per-theme `bundle.css` | CSS + build | pending #52 |
| `pnpm new-theme` scaffold | script | pending #53 |
| `--rb-focus-ring`, `--rb-ease` baseline; contract 2 | contract bump | pending #54 |
| Native `<progress>` contract in all twelve | CSS fix | pending #28 |
| `:focus-visible` base rule in all twelve; `a` colour divergence documented | CSS fix + test | pending #36 (4 of 12) |
| Disabled buttons take no hover | CSS fix | pending #37 |
| `rb-stepper` in every theme | #55 merged | live (no parity test; pending #29 / #47) |
| `.rb-stepper--upcoming` styled or allowlisted; `[aria-current="step"]` paired | `contract.test.mjs` | pending #47 (0 of 12 today) |
| `Dialog` / `Tabs` spread rest; `Dialog` reconciles `open` | React fix | pending #31 |
| `forwardRef` on every wrapper | React fix | pending #30 |
| SKILL.md matches the shipped contract | doc fix | pending #39 |
| `design.md` counterpart and count claims true | doc fix | pending #40 |
| `## Accessibility` section in every `design.md` | review | 1 of 12 (rackbops-studio) |
| `.rb-tab--active` paired with `[aria-selected="true"]` | `contract.test.mjs` | pending #47 (6 of 12) |
| `.rb-link--active` paired with `[aria-current="page"]` | `contract.test.mjs` | pending #47 (1 of 12, summer-cloud) |
| Choice controls use `accent-color` | review | 7 of 12 (concrete pair by design; ports hand-styled) |
| Dialog backdrop blurs via `var(--rb-blur)` | `contract.test.mjs` | pending #47 (8 of 12; concrete pair `0px` by design; two ports hard-code `blur(4px)`, #42) |
| `Field` / `Spinner` named props types | React fix | pending #30 |
| Existing docs conform to the section 11 template; SKILL.md carries section 15 | doc sweep | pending #56 |
| Extras only in labelled showcase sections | review | out of contract (issue #39) |
