# rackbops-ui-ux-std-lib -- Claude instructions

UX/design-standards library for roshne's apps -- CSS themes + React
components, one `--rb-*` token / `rb-*` class contract with swappable themes.
Modeled on `nazuraki/ui-std-lib`, re-namespaced to the rackbops brand. This is
**not** the `roshne/ui-std-lib` fork (that tracks Nazu's shared system); it is
roshne's own, separately-branded library.

My personal `~/.claude/CLAUDE.md` governs *how I work* (review gate, escalation,
git & shipping, tool routing, shell choice). It is not restated here.

## The contract is the definition of done

Each theme is a self-contained design language -- most reverse-documented from
one of roshne's apps, some ported (and credited) from `nazuraki/ui-std-lib`
(MIT; see `NOTICE`). Every theme must satisfy `styles/test/contract.test.mjs`:

- every selector guarded by `:where([data-rb-style="<theme>"], … *)` (zero
  specificity, embed-safe),
- the full baseline `--rb-*` token set declared in `tokens.css`, plus a
  `color-scheme` that matches the manifest,
- `@keyframes` names `rb-`-prefixed and unique across all themes,
- `manifest.json`, `styles/package.json` (`files` + `exports`), and the theme
  directories all in agreement.

Run it before staging:

```bash
pnpm --filter @rackbops/styles test    # contract + release-bump tests
pnpm --filter @rackbops/ui-react test  # React component render tests
pnpm build                           # tsc the React package
```

Themes are drop-in swappable: all declare the same baseline tokens and `rb-*`
classes, so a screen restyles by flipping `data-rb-style` alone. A **semantic**
change (a token's meaning, a component's contract) must reach every surface --
every theme's CSS, the React components, each `design.md`, the showcase, the
README themes table, and this file.

## Fidelity is a hard rule

Each `design.md` and each `tokens.css` **asserts facts about its source** -- a
real app's UI (artifact-console / rackbops.com) for the reverse-documented
themes, or nazuraki's upstream theme for the ported ones. A palette value or a
stated rule that is untrue of that source is a MAJOR defect, not doc polish --
verify colour values and aesthetic claims against the source (the app's own CSS,
or nazuraki's upstream CSS) before writing them.

## Conventions

- **Namespace:** `--rb-*` tokens, `.rb-*` classes, `data-rb-style="<theme>"`.
  Package scope is `@rackbops` (its own public npm scope); the *design* namespace
  is `rb`. Don't conflate them.
- **Fonts: system stacks by default.** Themes reverse-documented from roshne's
  apps use `system-ui` + `ui-monospace` stacks and carry an empty `manifest.json`
  fonts array. A ported theme that needs webfonts (e.g. `luminous-precision`:
  Sora + JetBrains Mono) declares its stylesheet URL(s) in that theme's manifest
  `fonts` array (the contract test requires https URLs there), and consumers
  inject those `<link>`s -- the `site/` showcase does this on theme switch. Don't
  add webfonts to a system-stack theme.
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
