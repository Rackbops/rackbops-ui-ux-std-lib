# Plan — #209 Switch: a real track-and-thumb look for `.rb-switch`

Give-back child of `Rackbops/rackbops-discord-bot#236` (this repo's #209; siblings #210, #211).
Written 2026-09-21 against `origin/main` @ `771fa8a` (v0.2.40); every cite read from source that
day. Standalone: no epic checklist here, no prerequisite. The intake bar is `STANDARD.md` §14.2 and
the every-surface list §14.4; this plan is the issue's intake document, and the acceptance below is
that bar made executable. Copy of the approved issue comment,
https://github.com/Rackbops/rackbops-ui-ux-std-lib/issues/209#issuecomment-5769457830, with a
"Deviations from the plan" section appended at the end.

## §1 — Inventory (Step 1, executed)

Three families, confirmed by reading every theme's `components/form.css` directly (grep for
`.rb-switch {` and `accent-color`), not assumed from the plan's prediction. **The family list
matches the plan's prediction exactly — no deviation.**

**(a) Native `accent-color`, 9 themes** — a checkbox widened to `2rem`/`2.2rem` via a shared
`.rb-checkbox, .rb-radio, .rb-switch { accent-color: var(--rb-accent); width; height; cursor }`
block, then a `.rb-switch { width: <2x> }` override:

| Theme | Lines |
|---|---|
| `arcane-obsidian` | `components/form.css:52-62` |
| `arcane-parchment` | `components/form.css:52-62` |
| `rackbops-studio` | `components/form.css:52-62` (1.1rem base / 2.2rem switch, not 1rem/2rem) |
| `rackbops-noir` | `components/form.css:52-62` (1.1rem base / 2.2rem switch) |
| `amber-hearth` | `components/form.css:53-63` |
| `amber-ember` | `components/form.css:53-63` |
| `kenzen-midnight` | `components/form.css:51-62` |
| `kenzen-cyberhealth` | `components/form.css:51-62` |
| `mono-field` | `components/form.css:66-77`, plus a redundant `.rb-switch:focus-visible` chained into `:80` (see deviations) |

**(b) The concrete pair, 2 themes** — already hand-drawn, square, flat accent fill, byte-identical
between the two (pair-parity holds):

| Theme | Lines |
|---|---|
| `concrete-signal` | `components/form.css:89-119` (rule), `:121-130` (focus comment, no rule) |
| `concrete-signal-light` | `components/form.css:89-119`, `:121-130` |

Confirmed: no `:disabled` rule exists anywhere in either file (for any control) — a genuine gap,
not an oversight in reading. `:checked::after` declares `transform: translateX(1.1rem)`.

**(c) The three ports, 3 themes** — each already hand-drawn from its own upstream, confirmed (none
uses `accent-color`):

| Theme | Lines | Track fill (checked) | Extra tokens used |
|---|---|---|---|
| `summer-cloud` | `components/form.css:109-140` | `--rb-success` (its own upstream reading, kept) | `--rb-ease-bounce` (thumb transform only) |
| `luminous-precision` | `components/form.css:95-126` | `--rb-accent-2` (border only; background never changes) | `--rb-accent-2`, `--rb-accent-2-glow` |
| `neon-butterfly` | `components/form.css:93-124` | `--rb-accent-2` (border only) | `--rb-accent-2`, `--rb-accent-2-glow` |

All three already declare `transform: translateX(` on `:checked::after` and use
`var(--rb-transition)`/`var(--rb-ease)` throughout. None has a `:disabled` rule.

**9 + 2 + 3 = 14.** Confirmed complete against `manifest.json`'s theme list.

## Decided — not open for re-planning

1. Family (a) gets the shared track-and-thumb; (b) and (c) keep their own drawing. Every theme,
   all fourteen, satisfies the same contract of states.
2. The shape, for family (a) — one rule set per theme, tokens only:

```css
.rb-switch {
  appearance: none; position: relative; margin: 0; vertical-align: text-bottom; cursor: pointer;
  width: 2.25rem; height: 1.25rem;
  background: var(--rb-surface-sunken); border: 1px solid var(--rb-border-strong); border-radius: var(--rb-radius-pill);
  transition: background var(--rb-transition) var(--rb-ease), border-color var(--rb-transition) var(--rb-ease);
}
.rb-switch::after {
  content: ""; position: absolute; top: 2px; left: 2px; width: calc(1.25rem - 6px); height: calc(1.25rem - 6px);
  border-radius: 50%; background: var(--rb-text-soft);
  transition: transform var(--rb-transition) var(--rb-ease), background var(--rb-transition) var(--rb-ease);
}
.rb-switch:checked { background: var(--rb-accent); border-color: var(--rb-accent); }
.rb-switch:checked::after { transform: translateX(1rem); background: var(--rb-accent-fg); }
.rb-switch:disabled { cursor: not-allowed; opacity: .5; }
```

   The `2rem`/`2.2rem` width rule and the switch's share of the `accent-color` rule are removed
   (checkbox and radio keep `accent-color`). Focus is the base rule; no per-element focus rule on
   the switch. Motion is the two `transition` declarations, both on `--rb-transition`/`--rb-ease`.
3. The contract of states, every theme: off = track token/theme's own drawing, thumb left; on =
   thumb right, track fill differs from off; `:disabled` = reduced opacity + not-allowed;
   `:focus-visible` = the theme's ring; checked distinguishable without colour, by thumb position.
4. Contrast, measured, per theme: thumb against track in both states, and the on-track against
   `--rb-surface`, each ≥ 3:1. Measured from `tokens.css`, never recalled, extending
   `contrast.test.mjs`. A failing pair picks a different baseline token and records the choice; an
   allowlisted exception needs the orchestrator's OK first.
5. The showcase shows three switches: on, off, disabled-on. Regenerate the 14 form-section
   baselines; `pnpm visual` passes clean; `pnpm visual:reduced` keeps passing.
6. No `contract.json` bump, no token change. §5.1's `form.css` row note is rewritten: checkbox and
   radio SHOULD use `accent-color`; the switch is drawn as a track and thumb in every theme.
7. The downstream half (the bot panel deleting its override) is not this PR — it follows the next
   published release; #209 stays open until that lands.

## Steps

1. Inventory — done above.
2. `form.css` × family (a): replace the switch rules per decision 2.
3. `form.css` × families (b)/(c): add only what's missing — a `:disabled` rule in all five.
4. Tests: a new `styles/test/switch.test.mjs`; contrast rows in `contrast.test.mjs`/`contract.json`.
5. Docs: 14 `design.md` form bullets, Accessibility rows where decision 4 required a choice,
   `STANDARD.md` §5.1, this plan file's deviations.
6. Showcase + baselines; `styles/package.json` version per `release-bump.test.mjs`.

## Coverage table

| Acceptance | Steps | Test | Mutation that must fail it |
|---|---|---|---|
| track-and-thumb in every theme, markup/React unchanged | 2, 3 | switch test (i)-(iii); `form.test.tsx` unedited | restore `accent-color`+`width:2rem` in one theme; drop `:disabled`; change `Switch`'s class |
| checked distinguishable without colour | 2, 3 | switch test (ii) | drop `translateX` from one theme's `:checked::after` |
| both states clear 3:1 non-text contrast | 4 | the contrast rows | swap a theme's thumb token for one that fails |
| focus is the theme's ring, thumb doesn't move | 2 | switch test (vi) | add `border-width: 2px` on `:focus-visible` in one theme |
| reduced motion via `--rb-transition` | 2 | switch test (v) + `pnpm visual:reduced` (CI) | a literal `200ms` in one transition |
| showcase shows the states, baselines current | 6 | `pnpm visual` clean (CI + local trigger) | a baseline mismatch fails the job |
| the intake bar (§14.2/§14.4) | 1-6 | a single read of the every-surface list against the diff | — |

## Deviations from the plan

- **Contrast pairs: two new, not three, plus a per-theme override the plan didn't anticipate.**
  Decision 4's "three pairs" (thumb/track off, thumb/track on, on-track/surface) map to: off =
  `text-soft`/`surface-sunken` (new), on = `accent-fg`/`accent` (already existed at a stricter
  4.5:1 — no new entry needed), on-track/surface = `accent`/`surface` (new). Adding the two new
  pairs surfaced a real failure: `kenzen-cyberhealth`'s exact brand teal is 2.04:1 as the checked
  switch's border against `--rb-surface`, below the 3:1 floor — the same weakness its `--rb-accent`
  already has elsewhere (2.21:1 on `--rb-bg`, already allowlisted, #171). Per decision 4's own
  first recourse ("a theme whose baseline tokens fail a pair picks a different baseline token for
  that part") and the orchestrator's ruling (not the allowlist), `kenzen-cyberhealth`'s
  `components/form.css` adds one theme-specific rule after the shared shape,
  `.rb-switch:checked { border-color: var(--rb-text); }` (`--rb-text`/`--rb-surface` = 15.18:1) —
  the same fix the `--rb-focus-ring` exemption already uses (#171), not a new exception class. The
  fill and thumb are untouched (still `--rb-accent`/`--rb-accent-fg`, the existing 4.5:1 pair).
  Because the check is now genuinely per-theme (13 themes measure `accent`/`surface`, one measures
  `text`/`surface`), `contract.json`'s `accent`/`surface` pair gained an `overrides` field (theme →
  substitute fg/reason) and `contrast.test.mjs` gained the logic to read it, with its own staleness
  guard (if the brand teal is ever retuned above 3:1, the unoverridden pair would start failing
  loudly, not stay silently unused) — a small, general mechanism, not a one-off hack, in case a
  future theme needs the same shape. Recorded in `kenzen-cyberhealth/design.md`'s Accessibility
  section with both measured ratios.
- **`styles/package.json`'s version is not touched in this PR.** The plan's Step 6 said to set it
  "as `release-bump.test.mjs` requires (read it; do not guess)" — having read it, the version bump
  is computed entirely by `.github/scripts/next-version.sh` during the automated `release` workflow
  triggered by merging to `main` (README's "Publishing" section), from the merged commits'
  Conventional Commit types. `bump.test.mjs` tests that script's pure logic, not a value a
  contributor sets by hand. No file needs editing for this.
- **Illustrative screenshots for the PR body came from computed-style inspection, not the Browser
  pane's screenshot capture**, which returned a blank image every time (`tabs_context` confirmed
  the pane is hidden in this environment, a known limitation of screenshotting a backgrounded pane).
  Verified instead via `getComputedStyle` on the real rendered `.rb-switch`/`::after` elements for
  one theme per family (`arcane-obsidian`, `concrete-signal`, `summer-cloud`) against the local dev
  server (`site/serve.mjs`) — track/thumb colours, `:checked` position (`translateX`), and the
  disabled state's opacity/cursor all matched the CSS exactly. The real, pixel-exact screenshots for
  the PR come from the `update-visual-baselines` CI workflow (the repo's own documented mechanism
  for this — baselines must be rendered in the Playwright container, never on a local machine, or
  they fail CI on antialiasing alone, per README's "Developing" section) once the branch is pushed.
