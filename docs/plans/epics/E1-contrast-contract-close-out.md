# E1 -- Contrast contract close-out: implementation plan

Epic #177. Children #120, #163, #64, closed by **one PR** from `/work-on 120`. Written by the orchestrator on 2026-09-10 against `main` at `a9bb73e` (v0.2.28); every line number below is from that commit and must be re-checked once the branch exists (`grep -n` is the tool, not memory). This file is committed on the branch as `docs/plans/epics/E1-contrast-contract-close-out.md` in the first commit.

## Locked decisions (roshne, 2026-09-10 -- see the comments on #163 and #173)

1. **Two `danger` pairs at 4.5:1** (`bg` and `surface`) and **one `text-faint` pair at 3.0:1** (`surface-2`, `warnBelow: 4.5`) are added to `styles/contract.json` `contrast.pairs`. **No `success`/`warning` text pairs** -- they are designed as fills (kenzen-cyberhealth success is 1.37:1 on white), and STANDARD.md 9 already routes semantic colours as small text through tint + ink.
2. **The split.** Allowlist rackbops-studio, kenzen-midnight and summer-cloud (brand or upstream fidelity, or a pairing never rendered). Raise the token on arcane-parchment, concrete-signal and amber-ember.
3. **Token fix, never component-CSS fix**, for the three raised themes: `pair-parity.test.mjs` requires each light/dark pair's `components/` directories to be byte-identical after guard normalisation, so a `button.css` edit in arcane-parchment would have to land in arcane-obsidian too. Tokens are per-theme; parity is untouched.
4. **No contract-integer bump.** `contract.json`'s `"contract": 2` bumps for a token name or meaning (STANDARD.md 4.1 `:247-248`, 14.3 `:865-870`). A contrast pair is neither. `manifest.json` stays in step (the `contract.test.mjs:217` parity test keeps passing).
5. **arcane-parchment nuance, flagged to roshne in the hand-off.** Its `design.md:17` says "Palette values match artifact-console's light scheme", so it is reverse-documented, not original. artifact-console now consumes this library (zero occurrences of `#d64550` or `rb-danger` in `R:\repos\artifact-console`), and the theme's stated identity (`design.md:3`) is "the light, AA-tuned counterpart". The fix stands; step 4 amends the provenance sentence so it stays true. If roshne reverses this, arcane-parchment moves to the allowlist list in step 3 and its token/Color-row/provenance edits are dropped -- nothing else in the plan changes.

## The numbers (WCAG 2.x, computed from each `tokens.css`; the suite recomputes them)

Danger as text (bg / surface): kenzen-midnight 3.08 / 2.72, summer-cloud 3.12 / 3.27, rackbops-studio 3.73 / 4.35, arcane-parchment 4.06 / 4.35, concrete-signal 4.42 / 4.11, amber-ember 4.81 / 4.49. The other eight clear both.

Text-faint on surface-2: rackbops-studio 2.98 (below the 3.0 floor -> allowlist); rackbops-noir 3.57 (warning only); the kenzen pair use `rgba()` faint tokens, which only the suite's compositing can score -- see the stop condition in step 2. Every other theme is >= 4.61.

Replacement `--rb-danger` values, same hue and saturation as today, lightness stepped by the smallest amount that clears 4.5:1 on **both** surfaces:

| Theme | Today | New | on bg | on surface |
| --- | --- | --- | --- | --- |
| arcane-parchment | `#d64550` | `#d23440` | 4.55 | 4.88 |
| concrete-signal | `#e8342a` | `#ea463c` | 4.85 | 4.51 |
| amber-ember | `#d1614a` | `#d2634c` | 4.90 | 4.58 |

## Build order (commit after each numbered step; Conventional Commits, scope `styles` unless stated)

### 1. Guards first: `styles/test/accessibility-docs.test.mjs` (new) -- `test(styles): guard the design.md Accessibility sections and the contrast allowlist`

Import `{ ROOT, themeDirs }` from `./css.mjs`; read `contract.json` as `contrast.test.mjs` does (`:22`). Three `test()` blocks:

- **`every theme's design.md carries an ## Accessibility section that cites the contrast test`** -- for each of `themeDirs`: `styles/<theme>/design.md` exists; contains a line exactly `## Accessibility`; the text from that heading to the next `\n## ` heading contains the literal `styles/test/contrast.test.mjs`. This makes STANDARD.md's `[tested: all fourteen carry the section ...]` markers (`:670-671`, `:740`) true -- at HEAD **no test asserts this** (grep `Accessibility` across `styles/test/*.mjs`: only comments), so the markers are currently a false factual claim.
- **`every contrast allowlist entry names a live pair and a real theme`** -- for each `contract.contrast.allowlist` entry: `themeDirs.includes(entry.theme)`, and some `contract.contrast.pairs` entry has the same `fg`/`bg`. This is the guard that makes "delete a pair" a red mutation whenever an allowlist entry depends on it (today `contrast.test.mjs:130-132` silently ignores an orphaned entry).
- **`every contrast allowlist doc citation points inside that theme's Accessibility section`** -- `entry.doc` matches `^([\w-]+)/design\.md:(\d+)-(\d+)$`, the theme segment equals `entry.theme`, `a <= b`, `b <=` the file's line count, and both `a` and `b` fall within the `## Accessibility` section's line span (heading line inclusive, up to the line before the next `## `). This is what forces step 5's `doc` ranges to be re-derived rather than guessed.

Run `pnpm --filter @rackbops/styles test` -- all three must be **green at HEAD** before any other change (the existing three entries already satisfy them; if one does not, stop and report -- that is a finding, not something to paper over).

### 2. The contract: `styles/contract.json` -- `feat(styles): hold text-faint on surface-2 and the danger label to their contrast targets`

Surgical text edits only -- never a JSON round-trip (the file is hand-formatted; a `JSON.stringify` explodes it into a 400-line diff). After `:184` (`{ "fg": "text-faint", "bg": "bg", ... }`, which gains a trailing comma), insert in this order:

```
      { "fg": "text-faint", "bg": "surface-2", "min": 3.0, "warnBelow": 4.5 },
      { "fg": "danger", "bg": "bg", "min": 4.5 },
      { "fg": "danger", "bg": "surface", "min": 4.5 }
```

Run the styles suite and **paste the failing assertions**. Expected exactly: rackbops-studio `text-faint on surface-2 = 2.98`; danger on bg **and** surface for kenzen-midnight, summer-cloud, rackbops-studio, arcane-parchment, concrete-signal; danger on surface for amber-ember. **Stop conditions:** a kenzen theme failing `text-faint/surface-2` (an `rgba()` token composited by the suite -- a design call, report it, do not allowlist); any theme outside the six above failing a `danger` pair. Also paste the diagnostics line for rackbops-noir `text-faint on surface-2 = 3.57` (warning, not failure).

Allowlist entries are added in step 5, after the `design.md` lines they cite exist. The suite is red between steps 2 and 5 -- that is expected; commit step 2 together with step 5, or leave the pairs uncommitted until then. (Recommended: one commit for 2 + 5.)

### 3. The three token fixes -- `fix(styles): raise --rb-danger on arcane-parchment, concrete-signal and amber-ember to clear 4.5:1 as the danger label`

In each theme's `tokens.css`, the single `--rb-danger:` declaration (arcane-parchment `:40`; find the other two with `grep -n`): set the New value from the table above. Nothing else in `tokens.css` changes. `bundle.css` is generated at `prepack` and git-ignored (`.gitignore:22`) -- nothing to regenerate.

Then the **Color table row** in each `design.md` (the fidelity rule: a palette value untrue of `tokens.css` is MAJOR): arcane-parchment `:41`, concrete-signal `:35`, amber-ember `:33` -- replace the old hex with the new one, keep the row's Usage text. Re-run the suite: the three themes' `danger` failures are gone; the remaining failures are exactly the allowlist set.

### 4. Provenance sentence, arcane-parchment only -- part of the step 3 commit

`styles/arcane-parchment/design.md:17` currently: `Palette values match artifact-console's light scheme.` Make it: `Palette values match artifact-console's light scheme, except `--rb-danger`, raised from the console's `#d64550` to `#d23440` so the ghost danger button's label clears 4.5:1 on both `--rb-bg` and `--rb-surface` (#163).` (Backticks as in the surrounding prose.)

### 5. Allowlist entries + the design.md sentences they cite -- `docs(styles): document the allowlisted danger and faint pairs` (or fold into the step 2 commit)

Write the `design.md` text **first**, then derive each `doc` range with `grep -n` on the final file, then add the `contract.json` entries. The step 1 test rejects a range outside the section.

**rackbops-studio/design.md** (Accessibility section `:80-118`):
- Extend the faint bullet (`:95-103`): after "~2.8:1 on `--rb-bg`" add "and ~3.0:1 (2.98) on `--rb-surface-2`, both below the 3:1 non-text floor" and make the "must never be the only signal" rule cover `--rb-surface-2` as well as bare `--rb-bg` (today the sentence recommends keeping `.rb-muted` *inside* a `--rb-surface-2` context -- that recommendation is now wrong for surface-2 and must go; `--rb-surface` remains the safe context at ~3.2:1).
- New bullet after the accent-fg bullet (`:104-106`): "**Rose `--rb-danger` as the ghost danger button's label is ~3.7:1 on `--rb-bg` and ~4.35:1 on `--rb-surface`** -- below the 4.5:1 control-label bar. Kept for rackbops.com fidelity (the rose is the site's error colour); allowlisted for both `danger` pairs. The button always carries a text label and a danger-tinted border, so colour is never its only signal; for a destructive action's confirm step prefer the default primary (ink fill, ~15:1)."
- Rewrite the summary paragraph (`:114-118`) to list what is now allowlisted (`accent-fg`/`accent`, `text-faint`/`bg`, `text-faint`/`surface-2`, `danger`/`bg`, `danger`/`surface`) and what warns (`text-faint`/`surface` ~3.2:1).
- Three new allowlist entries (`theme: "rackbops-studio"`): `text-faint`/`surface-2`, `danger`/`bg`, `danger`/`surface`, each with a one-sentence `reason` in the style of the existing two and a `doc` range covering the bullet. **Re-derive the two existing studio `doc` ranges** (`:95-103`, `:104-106`) -- the edits above move them.

**kenzen-midnight/design.md** (section `:98-137`; `## Components` is at `:138`): the danger bullet (`:111-126`) already states 3.08:1 on `--rb-bg` and says "filed as #163 ... out of this PR's scope". Rewrite its tail: add "and 2.72:1 on `--rb-surface`", replace the "filed as / out of scope" sentences with "Allowlisted in `contract.json`'s `contrast` block for both `danger` pairs (#163): the crimson is the brand's exact hex (kenzen#88, #172); the ghost button's text label and danger-tinted border carry the meaning." Two allowlist entries (`danger`/`bg`, `danger`/`surface`), `doc` = the bullet's final range.

**summer-cloud/design.md** (section `:119-121`, one paragraph): add a bullet: "**`--rb-danger` (`#ff4d4d`) as text is 3.12:1 on `--rb-bg` and 3.27:1 on `--rb-surface`**, below the 4.5:1 control-label bar -- but no component renders it as a label: `.rb-btn--danger` is a solid `--rb-danger-deep` (`#cc1f1f`) fill with white `--rb-accent-fg` text, 5.55:1, and the badge puts dark text on the red (see Deviations). Allowlisted for both `danger` pairs so the fixed-pair test does not flag a pairing nothing uses." Two allowlist entries, reason "never rendered as a label -- solid --rb-danger-deep fill with --rb-accent-fg text (5.55:1)". (5.55 verified by the orchestrator: `#cc1f1f` on `#ffffff`.)

**rackbops-noir/design.md** (`:70-75`): add a third bullet in the shape of the existing two: "**`--rb-text-faint` on `--rb-surface-2` is ~3.6:1** (3.57) -- below AA, above the 3:1 floor; same rule." No allowlist entry (it passes the floor; the suite emits a warning).

### 6. Every other Accessibility section: stop enumerating the pair list -- `docs(styles): cite the contrast test's pair list instead of restating it` (#64)

Ten files carry this exact sentence (amber-ember `:60`, amber-hearth `:83`, arcane-obsidian `:87`, arcane-parchment `:76`, concrete-signal `:94`, concrete-signal-light `:64`, luminous-precision `:93`, mono-field `:90`, neon-butterfly `:82`, summer-cloud `:121`):

> The token pairs `styles/test/contrast.test.mjs` computes -- `--rb-text` / `--rb-text-soft` on their surfaces, `--rb-accent-fg` on `--rb-accent`, `--rb-accent` as non-text on `--rb-bg`, and `--rb-text-faint` on `--rb-surface` -- all clear their WCAG targets (4.5:1 text, 3:1 non-text; faint clears AA here too).

That enumeration was already stale before this PR (the suite has checked `text`/`surface-2` and `text-faint`/`bg` since #49 and #120's first half) and goes staler with three more pairs. Replace the enumeration in all ten with:

> Every fixed token pair `styles/test/contrast.test.mjs` computes (the list is `styles/contract.json`'s `contrast.pairs`, not restated here so it cannot go stale) clears its WCAG target on this theme (4.5:1 text, 3:1 non-text; faint clears AA here too).

Keep each file's tail unchanged (`No deviations.` in eight; `One note beyond the tested pairs:` in amber-hearth and concrete-signal-light; summer-cloud's tail becomes the bullet from step 5). "faint clears AA here too" stays true in all ten: the lowest `text-faint`/`surface-2` among them is luminous-precision at 4.61. The two kenzen files enumerate in their own words (`kenzen-midnight:100-104`, `kenzen-cyberhealth:106-110`); apply the same replacement to their first sentence and keep their tails. rackbops-studio and rackbops-noir do not enumerate.

For the three raised themes, add one bullet under the sentence (arcane-parchment, concrete-signal, amber-ember): "**`--rb-danger` as the ghost danger button's label clears 4.5:1 on `--rb-bg` and `--rb-surface`** (`<new hex>`: x.xx / x.xx)." with the ratios from the table.

### 7. STANDARD.md -- `docs: record the raise-or-document rule and fix the stale section-9 citations` (#64)

- New bullet after "Deviations are documented, never discovered" (`:664-671`): "**Raise or document, by provenance (#64, #163).** A theme reverse-documented from a live app or ported from an upstream keeps its source palette and documents every below-target pair (a `contract.json` allowlist entry citing the `design.md` line). An original theme has no source to be faithful to: it raises the token until the pair clears. A documented divergence from the source (arcane-parchment's `--rb-danger`) is stated in that theme's `design.md` where it states its provenance."
- `:667` cites `styles/rackbops-studio/design.md:77-100` as the model section -- stale (the section is `:80-118` at HEAD and moves again in step 5). Re-derive and fix.
- `:670-671` and `:740` `[tested: ...]` markers: name the new test file (`styles/test/accessibility-docs.test.mjs`) so the marker is true.
- `:678` cites `styles/rackbops-studio/tokens.css:38-42` -- verified accurate at HEAD; re-check only if `tokens.css` was touched (it was not).

### 8. Visual baselines -- `chore(visual): update showcase baselines` (bot commit)

The three token changes alter rendered colour in the buttons, badges and alerts tiles (and any tile whose CSS spends `--rb-danger`: concrete-signal `form.css` uses it once). `pnpm visual` in CI compares against `site/__screenshots__/<theme>/*.png`, so the baselines must be regenerated **on the branch** by the same container: `gh workflow run update-visual-baselines.yml --ref <branch>` (the workflow is on `main`, so dispatch works), wait for the bot commit, `git pull`, then paste `git show --stat HEAD -- site/__screenshots__`. **Expected: only arcane-parchment, concrete-signal and amber-ember tiles change, and only tiles that render `--rb-danger`.** Anything else is a finding. The orchestrator reviews the image diff (attach or link the changed PNGs in the PR).

### 9. Plan file -- first commit on the branch, `docs(plans): E1 contrast contract close-out implementation plan`

This document, verbatim, at `docs/plans/epics/E1-contrast-contract-close-out.md`.

## Mutation guards (each must turn the suite red; paste one failing assertion per row in the PR)

| Change | Mutation | Failing test |
| --- | --- | --- |
| `text-faint`/`surface-2` pair | delete the pair line | `accessibility-docs`: studio's allowlist entry names a pair that no longer exists |
| `danger`/`bg` pair | set arcane-parchment `--rb-danger` back to `#d64550` | `contrast`: `arcane-parchment: danger on bg = 4.06 is below the 4.5:1 target` |
| `danger`/`surface` pair | set amber-ember `--rb-danger` back to `#d1614a` | `contrast`: `amber-ember: danger on surface = 4.49 ...` |
| each allowlist entry | delete one entry | `contrast`: that theme's pair is below target |
| each allowlist entry | raise its theme's token until the pair passes | `contrast`: stale-entry guard (`now clears ... remove the stale contrast allowlist entry`) |
| Accessibility section | delete the `## Accessibility` line in one `design.md` | `accessibility-docs`: first test |
| `doc` ranges | change one entry's range to point at the `## Components` section | `accessibility-docs`: third test |

A green suite with any row above still green is an unguarded change and blocks.

## Acceptance to execute and paste (the three issues' bullets, consolidated)

1. `pnpm --filter @rackbops/styles test` green; paste the diagnostics lines for every allowlisted pair (the suite prints `... (allowlisted below N:1, <doc>)`) and the two warnings (noir `text-faint`/`surface` and `/surface-2`, studio `text-faint`/`surface`).
2. The `contrast.pairs` block and the `contrast.allowlist` block, pasted.
3. The fourteen-row tables for `danger`/`bg`, `danger`/`surface` and `text-faint`/`surface-2` -- from the suite's own numbers (add a temporary `t.diagnostic` per pair, or run the orchestrator's probe: `node <scratchpad>/danger-probe.mjs`; the kenzen faint rows must come from the suite because of `rgba()`).
4. `grep -c '^## Accessibility' styles/*/design.md` -> 14 lines of `1`.
5. Every allowlist `doc` range's text, pasted (`sed -n 'a,bp'` on each), showing the sentence that documents it.
6. `grep -rn 'and \`--rb-text-faint\` on \`--rb-surface\` -- all clear' styles/*/design.md` -> no matches.
7. The new STANDARD.md section-9 sentence, quoted; `grep -n 'rackbops-studio/design.md:' STANDARD.md` showing the corrected range.
8. `git show --stat HEAD -- site/__screenshots__` for the baseline commit, showing only the expected tiles.
9. `pnpm test` (root) green; `pnpm build` green.

## Exit demo

On `main` after merge: `pnpm --filter @rackbops/styles test` green with the three new pairs live and ten allowlist entries (three existing + seven new: studio 3, kenzen-midnight 2, summer-cloud 2) each citing a range the new test has verified sits inside an Accessibility section; STANDARD.md 9 states the raise-or-document rule; the release workflow cuts v0.2.29 (a `fix:` commit bumps the patch).

## Sub's operating rules

- Read #120, #163, #64 and #177 in full, including comments, before touching anything. The #163 comment carries the decision table.
- Branch from `origin/main` in your own worktree; never `git stash`; `git -C`, never `cd && git`.
- Run the review gate yourself (two adversarial agents, different lenses: correctness/failure modes vs. claims-vs-code walking the acceptance bullets above), up to four rounds, then report the round count and findings to the orchestrator rather than starting a fifth.
- Report deviations from this plan as they arise (a stop condition, a line that moved, a ratio that differs from the table), not at the end.
- Do not merge. Post the PR link, the pasted acceptance output and the gate evidence back to the orchestrator; the orchestrator verifies and merges via `/pr` semantics (squash).
