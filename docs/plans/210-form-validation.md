# Plan — #210 Form help, validation, and required-state contract

Give-back child of `Rackbops/rackbops-discord-bot#236` (this repo's #210; siblings #209 shipped in
v0.2.41, #211 in v0.2.40). Copy of the approved issue comment,
https://github.com/Rackbops/rackbops-ui-ux-std-lib/issues/210#issuecomment-5770315894 ("Implementation
plan — written by the orchestrating session, to be executed as written"), confirmed as the one to
execute over an earlier, superseded 00:38Z draft comment by
https://github.com/Rackbops/rackbops-ui-ux-std-lib/issues/210#issuecomment-5770334041, with a
"Deviations from the plan" section appended at the end.

## Implementation plan — written by the orchestrating session, to be executed as written

Give-back child of Rackbops/rackbops-discord-bot#236 (this repo's #210; siblings #209 shipped in
v0.2.41, #211 in v0.2.40). Written 2026-09-22 against `origin/main` @ `be387fd` (v0.2.41); every cite
read from source that day. Standalone, no prerequisite. The intake bar is `STANDARD.md` §14.2 and the
every-surface list §14.4; this plan is the issue's intake document. The repo's own `CLAUDE.md` rules
stand (fidelity: a wrong value is MAJOR; `pnpm build` and `pnpm test` before staging; never `git
stash`; a worktree of your own; SKILL.md's table is GENERATED from `contract.json` by
`scripts/generate-skill-table.mjs`, never hand-edited).

**Files:** the fourteen `styles/<theme>/components/form.css`, the fourteen `styles/<theme>/design.md`
(the form bullet under `## Components`; `## Accessibility` only where a ratio needs a line),
`styles/contract.json` (`components.form.classes` and `.react`, and one `ariaPairs` entry),
`skills/design-system/SKILL.md` (regenerated), `components/react/src/form.tsx` + its tests
(`form.test.tsx`, `contract-classes.test.tsx`, `refs.test.tsx`), `components/react/src/index.ts`,
`site/index.html` (the form section), `site/__screenshots__/` (the Forms baselines, via the
update-visual-baselines workflow as #209 did), a new `styles/test/form-validation.test.mjs`,
`STANDARD.md` §5.1's `form.css` row, `docs/plans/210-form-validation.md` (this plan, in the shape of
`docs/plans/209-switch.md`). **Contract integer unchanged**: adding required classes is additive and
does not bump (§4.4, verbatim: "Adding a required class is additive and does not bump").

### What the fourteen themes do today (verified)

`[aria-invalid="true"]` on `.rb-input` / `.rb-textarea` is styled in **six** themes (the concrete
pair, mono-field, luminous-precision, neon-butterfly, summer-cloud — summer-cloud also styles its
`:focus`), in none on `.rb-select`, and in none of the other eight (the arcane, amber, kenzen and
rackbops pairs). No theme has a help-text class, an error-text class or a required marker. `Field`
and `Label` (`components/react/src/form.tsx:40-50`) are bare styled wrappers with no validation
props. The showcase (`site/index.html:194-208`) shows three plain fields.

### Decided — not open for re-planning

1. **Names follow §5.5, which supersedes the issue's proposed `.rb-help`:** help text and error text
   are elements of the field block — `.rb-field__help`, `.rb-field__error` — and the required marker
   is an element of the label — `.rb-label__required`. A bare `.rb-help` would be a utility "that
   applies to any element", which this is not: it sits under a control inside `.rb-field`. Record the
   rename in the plan file's deviations against the issue text.
2. **The invalid state is driven by `[aria-invalid="true"]` on `.rb-input`, `.rb-select`,
   `.rb-textarea`, in every theme** — the ARIA attribute is the state, never a class (§5.5: CSS
   matches the ARIA state so correct markup is correctly styled). Each theme draws it in its own
   field idiom: border `--rb-danger` (the concrete pair's "hard border" reading is `2px`; the
   wash-ring themes may add a `--rb-danger`-tinted ring the way they ring focus); the six themes that
   already have a rule keep their drawing and gain `.rb-select`. An `ariaPairs` entry in
   `contract.json` for `form` pins that all fourteen select on the attribute for all three controls
   (mirror the `tabs` entry's shape; read `contract.test.mjs`'s `ariaPairs` check to see what it can
   express, and extend it minimally if it only handles class-plus-attribute pairs — say which).
3. **Error text is ink with a danger bar, never coloured small text:** `.rb-field__error { color:
   var(--rb-text); font-size: var(--rb-text-sm); padding-left: var(--rb-space-2); border-left: 3px
   solid var(--rb-danger); margin-top: var(--rb-space-1); }`. The text carries the meaning (§9:
   status is never colour-only; the acceptance's "identifiable without colour: icon or text" is the
   text itself, plus the border change on the control); the bar reinforces. Ink on
   `--rb-surface`/`--rb-bg` is a 4.5:1 contract pair in all fourteen, so the acceptance's 4.5:1 holds
   by construction with no allowlist — this is the bot admin panel's own rule (`field-hint--danger`:
   "a severity bar, never coloured small text") given back. `--rb-danger` as text would pass the
   `danger/surface` pair today but is the §9 anti-pattern for small semantic text; not used.
4. **Help text is `--rb-text-soft` at `--rb-text-sm`** (`.rb-field__help { color:
   var(--rb-text-soft); font-size: var(--rb-text-sm); margin-top: var(--rb-space-1); }`) —
   `text-soft/surface` and `text-soft/bg` are 4.5:1 contract pairs in all fourteen.
5. **The required marker is text, not colour:** `<span class="rb-label__required" aria-hidden="true">*</span>`
   inside the label, styled `color: var(--rb-danger); margin-left: var(--rb-space-1)` — the glyph is
   the non-colour signal, `aria-hidden` because the control's own `required`/`aria-required`
   attribute carries it for assistive tech (the React `Label` sets the span; the consumer sets
   `required` on the control, as today). No `::after` content: pseudo-content is read inconsistently
   by screen readers.
6. **Wiring is the consumer's, with the React layer making it one prop each:** `FieldHelp` and
   `FieldError` are new styled `<p>` wrappers (`rb-field__help`, `rb-field__error`) that take an `id`
   like any element; `FieldError` sets `role="alert"`? **No** — it is static text that renders with
   the field; a live region there would announce on every keystroke re-render. It stays a plain
   `<p>`; the consumer wires `aria-describedby` and `aria-invalid` on the control (documented in the
   JSDoc and the showcase markup). `Label` gains `required?: boolean` rendering the
   `.rb-label__required` span after its children. `Field`, `Input`, `Select`, `Textarea` are
   unchanged. This keeps the layer presentational (the repo's rule, `docs/plans/211-toast.md` §2:
   zero hooks, caller-controlled).
7. **The showcase** (`site/index.html:194-208`) gains, in its existing form section: a field with
   help text; a field with an error (`aria-invalid="true"`, `aria-describedby` pointing at the error,
   the error text under it); a required label. That changes the Forms section's fourteen baselines:
   regenerate through the update-visual-baselines workflow as #209 did (run id in the PR body), then
   `pnpm visual` passes clean in CI.
8. **`STANDARD.md` §5.1's `form.css` row** gains the three classes in "Required selectors",
   `FieldHelp`/`FieldError` in "React", and a Notes clause: the invalid state is the `aria-invalid`
   attribute on all three controls in every theme, error text is ink with a `--rb-danger` bar (never
   coloured small text, §9), the required marker is an `aria-hidden` glyph with the control's own
   `required` attribute carrying the semantics. The old "Choice controls SHOULD use
   `accent-color`…" clause stays as #209 left it.

### Cross-theme token mapping (the same names in all fourteen; only values differ, which is what the contrast rows check)

| Part / state | Property | Token |
|---|---|---|
| `.rb-field__help` | color / font-size / margin-top | `--rb-text-soft` / `--rb-text-sm` / `--rb-space-1` |
| `.rb-field__error` | color / font-size / border-left / padding-left / margin-top | `--rb-text` / `--rb-text-sm` / `3px solid var(--rb-danger)` / `--rb-space-2` / `--rb-space-1` |
| `.rb-label__required` | color / margin-left | `--rb-danger` / `--rb-space-1` |
| `[aria-invalid="true"]` on input/select/textarea | border-color (and the theme's ring idiom) | `--rb-danger` (ring: the theme's own wash construction with `--rb-danger` in place of `--rb-accent`, only where the theme rings focus) |
| `[aria-invalid="true"]:focus` | the theme's focus treatment, unchanged | `--rb-focus-ring` via base, or the theme's existing field-focus rule |

### Steps

1. `contract.json`: `components.form.classes` gains `rb-field__help`, `rb-field__error`,
   `rb-label__required` (surgical edit, key order preserved); `components.form.react` gains
   `FieldHelp`, `FieldError`; `notes` gains one clause; the `ariaPairs` entry per decision 2.
   Regenerate SKILL.md (`node scripts/generate-skill-table.mjs`, or whatever the test expects — read
   `generate-skill-table.test.mjs`).
2. Fourteen `form.css`: the three element rules (decisions 3–5) and the `[aria-invalid="true"]` rules
   for all three controls (decision 2), each in the theme's `:where(...)` guard and comment style;
   pairs stay byte-identical modulo guard (`pair-parity.test.mjs`).
3. React: `FieldHelp`, `FieldError` (styled `<p>`), `Label` `required` prop; exports in `index.ts`;
   JSDoc naming the consumer's wiring (`aria-describedby`, `aria-invalid`, `required`).
4. Tests (below). 5. Showcase + baselines (decision 7). 6. Docs: fourteen `design.md` form bullets
   (one sentence each, values copied from that theme's CSS), `STANDARD.md` §5.1 (decision 8),
   `docs/plans/210-form-validation.md` with a "Deviations from the plan" section.

### Tests

`styles/test/form-validation.test.mjs` (for every theme in `manifest.json`, reading
`components/form.css`): (i) `.rb-field__help`, `.rb-field__error`, `.rb-label__required` rules exist;
(ii) `.rb-field__error` declares `color: var(--rb-text)` and a `border-left` naming
`var(--rb-danger)` — never `color: var(--rb-danger)`; (iii) `[aria-invalid="true"]` is selected for
`.rb-input`, `.rb-select` AND `.rb-textarea`; (iv) every colour in the new rules is a `var(--rb-…)`
token. `contract.test.mjs`'s closed-world class check passes with the three new classes (it fails
until `contract.json` lists them — that is the pin). `contrast.test.mjs`: no new pair is needed
(decisions 3–4 use existing pairs); say so in the plan file. React (`form.test.tsx`): `FieldHelp` and
`FieldError` render their class and pass `id` through; `Label required` renders exactly one
`.rb-label__required` span with `aria-hidden="true"` and the `*` glyph, and none without the prop;
`contract-classes.test.tsx` gains both renders; `refs.test.tsx` gains both forwardRefs.

### Coverage table

| Acceptance (the issue's three bullets, made executable) | Steps | Test | Mutation that must fail it |
|---|---|---|---|
| the intake bar across all fourteen themes | 1–6 | `contract.test.mjs` closed-world + `form-validation` (i), (iii); SKILL.md generated test; `pair-parity` | drop `rb-field__error` from one theme; drop `.rb-select` from one theme's invalid rule; hand-edit SKILL.md |
| an invalid field is identifiable without colour, and the error text clears 4.5:1 in every theme | 2, 3 | `form-validation` (ii); the existing `text/surface` contrast pair | `color: var(--rb-danger)` on the error text in one theme (kills (ii)) |
| the required marker is not colour-only | 3 | `Label required renders an aria-hidden * span` | drop the span and style `::after` instead |
| React API is one prop / one element each, presentational | 3 | the React renders + refs tests | give `FieldError` `role="alert"` (a test asserts it has no role) |
| the showcase shows the three states, baselines current | 5 | `pnpm visual` clean (CI) | — |
| the bot admin panel replaces its local rules once shipped | — | not this PR: the orchestrator's follow-up after the release (as for #209) | — |

### Acceptance — execute these, paste the real output

```
pnpm build
pnpm test
pnpm visual:reduced
```
plus the update-visual-baselines workflow run for the Forms section and CI's green `visual` job (run
ids in the PR body), and one screenshot per family of the three new states (an `accent-color` theme,
the concrete pair, summer-cloud).

### PR

Branch `claude/210-form-validation` from `origin/main` in
`R:/repos/Scratch/worktrees/stdlib-210-forms` (`git -C R:/repos/rackbops-ui-ux-std-lib worktree add …
origin/main -b claude/210-form-validation`; `pnpm install --frozen-lockfile`). Title `feat(styles):
help text, error text, an invalid state and a required marker in every theme (#210)`; body with `Part
of #210` (not `Closes`: the issue closes when the bot panel adopts the classes after the release, the
orchestrator's step), the plan-file path, the deviations (the `.rb-help` → `.rb-field__help` rename
among them), the acceptance output, the mutation table, the round list with dispositions. Behaviour
change (a rendering every consumer sees, three new contract classes): the full gate — two adversarial
read-only reviewers with different lenses (A: the rendering and states across the fourteen themes in
a real browser, both colour schemes for pairs, screen-reader semantics of the marker and the error
text; B: claims-vs-code and test quality — every coverage-row mutant, every `design.md` sentence
against its CSS, SKILL.md regenerated not edited). Mutation-test every changed rule in a detached
scratch worktree, one mutant at a time. At most four rounds, then stop and tell the orchestrator.
**Never merge, never tag, never publish.**

## Deviations from the plan

- **Naming, against the issue's own text (not just the superseded draft comment):** the issue's
  `## Scope` proposes `.rb-help` for the hint under a field (it already names `.rb-field__error` for
  the message, so the issue text is itself inconsistent). Decision 1 supersedes `.rb-help` with
  `.rb-field__help` for §5.5 consistency — both new text elements are elements of `.rb-field`, not
  bare utilities. `.rb-field__error` needed no rename.
- **`ariaPairs` could not express a class-less attribute state, so a new `ariaStates` mechanism was
  added rather than forcing decision 2 into it.** Reading `contract.test.mjs`'s `evalAriaPairing` and
  `contract.json`'s `ariaPairs` (the `tabs` entry decision 2 points at) confirmed the existing
  mechanism requires a modifier **class** that co-occurs with the attribute (e.g. `--active` +
  `[aria-current="page"]`); `[aria-invalid="true"]` on `.rb-input`/`.rb-select`/`.rb-textarea` has no
  companion class — the attribute alone, on the base class, is the whole state. Per decision 2's own
  instruction to extend the mechanism minimally and say which, `contract.json` gained a new
  `ariaStates` array (one entry, `component: "form"`, `baseSelectors: ["rb-input", "rb-select",
  "rb-textarea"]`, `attribute: "[aria-invalid=\"true\"]"`) and `contract.test.mjs` gained a parallel
  `evalAriaState` function plus its own test loop and staleness guard, kept separate from
  `evalAriaPairing`/`ariaPairs` rather than overloading that function's contract.
- **The concrete pair (`concrete-signal`, `concrete-signal-light`) keeps its existing minimal invalid
  rule (`border-color: var(--rb-danger)` only, still 1px) rather than adopting decision 2's "hard
  border" reading for a theme with no prior rule.** Both themes already drew `[aria-invalid="true"]`
  on input/textarea before this issue; decision 2 says themes with an existing rule "keep their
  drawing and gain `.rb-select`" — so only `.rb-select` was added to the existing chain, and the
  brutalist "2px hard border" treatment (which the plan describes for themes drawing the rule fresh)
  was not retrofitted onto an already-correct, deliberately restrained drawing. Recorded in
  `concrete-signal/design.md`'s Form bullet.
- **Two pre-existing `contract.json` danger-token allowlist reasons (`summer-cloud`,
  `kenzen-midnight`) went factually stale once `.rb-label__required` shipped everywhere, and were
  fixed as part of this PR even though the plan didn't name them** — per this repo's and the personal
  `CLAUDE.md`'s "a false factual claim is MAJOR" rule, not a scope expansion. `summer-cloud`'s danger
  allowlist reason said "no component renders it as a label"; `kenzen-midnight`'s said the
  danger/on-danger pairing was "exactly what `.rb-btn--danger` uses it for" (an exclusivity claim).
  `.rb-label__required` now also renders `--rb-danger` as a (supplementary, `aria-hidden`) label
  glyph in every theme, including both of these, which directly contradicted both sentences. Both
  `design.md`'s Accessibility sections were rewritten to name the new exception and explain why it's
  still safe to allowlist (the glyph's *presence*, not its colour, carries the signal; the control's
  own `required` attribute carries the programmatic state) — the allowlist entries themselves and
  their measured ratios are unchanged, only the prose justifying them.
- **Illustrative screenshots for the PR body came from computed-style inspection, not the Browser
  pane's screenshot capture**, which returned a blank image (`tabs_context` confirmed the pane starts
  hidden in this environment) — the same known limitation #209 hit. Verified instead via
  `getComputedStyle` on the real rendered elements for one theme per family (`arcane-obsidian`,
  `concrete-signal`, `summer-cloud`) against the local dev server (`site/serve.mjs`), fronting the
  tab first. One real timing wrinkle surfaced and was resolved during this: reading
  `getComputedStyle` immediately (or after a short `setTimeout`) right after a programmatic
  `data-rb-style` switch returned the *previous* theme's border-color for the invalid input one step
  stale, while the `--rb-danger` custom property and every other element's colour updated
  immediately — a background/backgrounded-tab paint/transition-settling artifact of this automated
  environment, not a real bug (confirmed by re-reading after fronting the tab and issuing the
  measurement as its own, later tool call, at which point border-color, the `--rb-danger` variable,
  and every other value agreed exactly for all three themes). Final, settled numbers: `arcane-obsidian`
  border/`--rb-danger` `#f0616d`, error ink `#eceff4` on a matching bar, help `#a6b0c0`; `concrete-signal`
  `#ea463c` (border-width confirmed **1px**, the kept existing rule, not a fresh 2px hard border — see
  the deviation above), error ink `#f2f2f0`, help `#b8b8b4`; `summer-cloud` `#ff4d4d`, error ink
  `#171c1f`, help `#2f2b3a` — all three read `aria-invalid="true"` correctly and render exactly one
  `aria-hidden="true"` `*` in the theme's own danger colour.
- **Mutation testing** ran in a detached scratch worktree (`R:/repos/Scratch/mutation-210`, at the
  branch head `286105f`), one mutant at a time, reverted with `git checkout --` between each — never
  in a tree anything else could observe mid-mutation. All six confirmed failing as predicted:
  dropping `.rb-field__error` from one theme's `form.css` fails `styles` package tests (669→668);
  recolouring `.rb-field__error` to `var(--rb-danger)` fails `form-validation.test.mjs`'s ink-not-danger
  assertion; dropping the required-marker `<span>` from React's `Label` fails
  `form.test.tsx`'s exact-one-marker assertion; giving `FieldError` `role="alert"` fails its
  no-ARIA-role assertion; dropping `.rb-select` from one theme's `[aria-invalid="true"]` chain fails
  the new `contract.test.mjs` `ariaStates` check (the mechanism this PR adds, exercised on its own
  guard); and a hand-edit to `SKILL.md`'s generated table text fails
  `generate-skill-table.test.mjs`'s drift check. The worktree was removed afterward with no changes
  left behind (`git status` clean before removal).
- **A second, unrelated local worktree for a branch named `codex/210-form-validation`** was found
  checked out at `C:/Users/roshn/.codex/worktrees/form-validation-210/rackbops-ui-ux-std-lib`
  (detached at `771fa8a`, pre-dating this PR's own base commit) while setting up the mutation
  worktree — apparently a separate, local-only Codex CLI session also pointed at this same issue. No
  matching remote branch or PR exists (`git ls-remote`/`gh pr list` both empty for that name), so
  there is no conflict yet, but it means a second independent implementation of #210 may be in
  flight; flagged to the orchestrator so the duplicate work isn't both merged.
