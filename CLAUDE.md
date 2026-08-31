# rackbops-ui-ux-std-lib -- Claude instructions

Private UX/design-standards library for roshne's apps -- CSS themes + React
components, one `--rb-*` token / `rb-*` class contract with swappable themes.
Modeled on `nazuraki/ui-std-lib`, re-namespaced to the rackbops brand. This is
**not** the `roshne/ui-std-lib` fork (that tracks Nazu's shared system); it is
roshne's own, separately-branded library.

My personal `~/.claude/CLAUDE.md` governs *how I work* (review gate, escalation,
git & shipping, tool routing, shell choice). It is not restated here.

## The contract is the definition of done

Each theme is a self-contained design language reverse-documented from one of
roshne's apps. Every theme must satisfy `styles/test/contract.test.mjs`:

- every selector guarded by `:where([data-rb-style="<theme>"], … *)` (zero
  specificity, embed-safe),
- the full baseline `--rb-*` token set declared in `tokens.css`, plus a
  `color-scheme` that matches the manifest,
- `@keyframes` names `rb-`-prefixed and unique across all themes,
- `manifest.json`, `styles/package.json` (`files` + `exports`), and the theme
  directories all in agreement.

Run it before staging:

```bash
pnpm --filter @roshne/styles test   # contract + release-bump tests
pnpm build                          # tsc the React package
```

Themes are drop-in swappable: both declare the same baseline tokens and `rb-*`
classes, so a screen restyles by flipping `data-rb-style` alone. A **semantic**
change (a token's meaning, a component's contract) must reach every surface --
both themes' CSS, the React components, each `design.md`, the showcase, and the
README themes table.

## Fidelity is a hard rule

Each `design.md` and each `tokens.css` **asserts facts about a real app's UI**
(artifact-console / rackbops.com). A palette value or a stated rule that is
untrue of the source app is a MAJOR defect, not doc polish -- verify colour
values and aesthetic claims against the app's own CSS before writing them.

## Conventions

- **Namespace:** `--rb-*` tokens, `.rb-*` classes, `data-rb-style="<theme>"`.
  Package scope is `@roshne` (GitHub Packages ties the npm scope to the account);
  the *design* namespace is `rb`. Don't conflate them.
- **System fonts only.** Both themes use `system-ui` + `ui-monospace` stacks --
  no webfonts, so `manifest.json` fonts arrays are empty. This is deliberate (the
  contract test allows it); don't "fix" it by adding Google Fonts.
- **Theme extras** (beyond the shared component set) are allowed but must be
  guarded and imported by that theme's `index.css` like any component.
- **Commit convention:** Conventional Commits `type(scope): subject`. A `type!:`
  subject or `BREAKING CHANGE:` footer drives the minor bump (major is 0).
- **ASCII console output**, LF line endings (`.gitattributes`) -- per personal's
  baseline.

## Adding a theme

Copy `styles/arcane-obsidian/`, re-namespace the guard, fill the baseline tokens,
write `design.md`, then register in `manifest.json`, `styles/package.json`, and
the README table. The contract test is the gate.
