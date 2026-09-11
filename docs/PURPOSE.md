# Purpose

## The problem being solved

UX/design-standards library for roshne's apps: CSS themes plus React components behind
one `--rb-*` token / `rb-*` class contract, so any app can adopt a theme and swap
between them with a single `data-rb-style` attribute flip. Two layers: `styles/`
(`@rackbops/styles`, framework-agnostic CSS) and `components/react/`
(`@rackbops/ui-react`, React components that render the style layer's classes). Modeled
on `nazuraki/ui-std-lib`, re-namespaced to the rackbops brand. The design contract
itself -- tokens, classes, theme anatomy, accessibility -- is written up in
[`STANDARD.md`](../STANDARD.md); read it before adding a theme or component.

## Non-goals

- **Not the `roshne/ui-std-lib` fork.** That fork tracks Nazu's shared system
  directly; this is roshne's own, separately-branded library. Some themes are ported
  and credited from `nazuraki/ui-std-lib` (see `NOTICE`); most are original or
  reverse-documented from roshne's own apps.
- **Not framework-agnostic beyond the CSS layer.** `styles/` works with any framework;
  `components/react/` is React-only -- there's no Svelte/Vue/etc. component layer.
  Non-React consumers use `styles/` classes directly.
- **Not a home for ad hoc styling.** Every theme must satisfy the shared contract
  (`styles/test/contract.test.mjs`) -- no one-off component or theme that skips it.

## Intended audience

roshne, for use across his own apps (research-triage, artifact-console, rackbops.com,
and others). Published publicly on npm as `@rackbops/*`, but not soliciting outside
contributions.
