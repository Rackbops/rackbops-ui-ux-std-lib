# Plan — #211 Toast: a transient notice, shared by the consoles that each built their own

Standalone give-back component (not part of an active epic's checklist). Prose
dependency: it unblocks **Rackbops/rackbops-discord-bot#236** (admin-panel epic;
#211 is listed there alongside #209/#210) and lets **artifact-console** delete
its hand-rolled toast surface.

Closest analog in the library: **`Alert`** (`feedback.tsx`, `alert.css`). A Toast
is, in effect, a *floating* Alert with a live-region role chosen by urgency, a
stacking region, and a dismiss affordance.

## 1. Provenance and the two consumers

This is a give-back, so the consumers' existing shapes are the API brief.

- **artifact-console** — `packages/ui-shell/src/shell/ToastPortal.tsx`:
  a consumer-owned `useToasts` hook owns the **queue + 4s auto-dismiss timers**
  and renders std-lib `Alert`s inside a bespoke fixed stack `.ac-toasts`
  (`shell.css:253`, `position: fixed; top/right: --rb-space-4; gap: --rb-space-2;
  z-index: 1000`). Its own comment flags the a11y bug this give-back fixes:
  *"each `Alert` is `role="alert"` (assertive)… nesting a polite region around
  assertive ones double-announces"* — i.e. `Alert` is **always assertive**, so a
  routine "Saved" is announced as urgently as "Couldn't save".
- **rackbops-discord-bot admin panel** — greenfield (being built in #236); it
  adopts the shared Toast natively as it is built. Nothing to migrate there.

**What the give-back changes for a consumer:** it replaces the bespoke
`.ac-toasts` CSS with the themed shared region, and replaces the semantically-wrong
`Alert` (always assertive) with `Toast` (polite for info/success, assertive for
warning/danger). The consumer keeps its own queue/timer hook.

## 2. Scope and non-goals

**In scope (this repo, this PR):** the `rb-toast` CSS across all 14 themes + a
stacking region, the `Toast` + `ToastRegion` React wrappers, live-region role by
semantic, a keyboard dismiss affordance, and every doc/test/showcase surface a
shared component must reach (§14.2 / §14.4).

**Non-goals (deliberate, with rationale):**

- **No queue/timer/provider hook (`useToasts`).** The library ships *zero* hooks
  today; every component is presentational and controlled by the caller (Dialog's
  `open`, NavRail's `activeId`). Transience (auto-remove) and stacking order stay
  the consumer's concern, exactly as artifact-console already owns them. Shipping a
  stateful hook is a new category and is out of this issue's stated scope
  ("`.rb-toast` + modifiers + a stacking region, with the React wrapper;
  dismissible"). If a second consumer later wants the timer logic shared, that is
  its own issue.
- **No `@starting-style` entrance.** `@starting-style` (Chrome 117 / FF 129 /
  Safari 17.5) is **above** the §2.6 support floor (Chrome 111 / FF 121 /
  Safari 16.2), so it cannot be relied on. See D3.

**Downstream (separate PRs, not this one):** artifact-console swapping
`ToastPortal` to `Toast`/`ToastRegion` (the real-world API check), and the bot
panel consuming it. These need a **published `@rackbops/*` release first**, so they
follow the release, not precede it. See §7. *(Scope boundary to confirm — see the
note at the end.)*

## 3. Design decisions

**D1 — Live-region role chosen by semantic.** `info`, `success` → `role="status"`
(polite `aria-live`); `warning`, `danger` → `role="alert"` (assertive). This is
the standard urgency split and is exactly the refinement the issue and the
ToastPortal comment call for. The role is the a11y signal; colour is
reinforcement, and the message text carries the meaning ("never the only place an
error is reported").

**D2 — The region is NOT itself a live region.** `ToastRegion` sets no
`role`/`aria-live`; each `Toast` is its own live region (per D1). This is the
ToastPortal comment's rule: a polite region wrapping assertive children
double-announces. This is what makes A2's "announced **once**" true.

**D3 — Transition-based entrance via a mount flag, no keyframes.** `.rb-toast`
carries `transition: opacity/transform var(--rb-transition) var(--rb-ease)`. The
`Toast` component renders with a `data-rb-enter` attribute (from-state:
`opacity:0; transform: translateY(calc(-1 * var(--rb-space-2)))`) and clears it
after first paint (a layout effect + `requestAnimationFrame`), so the transition
plays on appear. Under `prefers-reduced-motion`, the per-theme
`--rb-transition: 0s` token collapse (already enforced by
`contract.test.mjs`) makes it appear instantly — *"unaffected beyond losing its
transition"*, matching A2's wording literally.
  - Why not a keyframe `animation`? It would need 14 uniquely-named keyframes
    **and** a `@media (prefers-reduced-motion)` override in each of the 14
    `toast.css` (the contract enforces "every applied keyframe has a reduced-motion
    override in the same file"). The transition path needs neither and passes the
    reduced-motion checks for free. It also matches the acceptance's word
    ("transition", not "animation").
  - The small mount effect is consistent with Dialog's internal effects (Dialog is
    "controlled" yet runs `useEffect`/`useImperativeHandle`); `Toast` stays
    presentational (no queue, no visibility state the caller can't see).
  - *Alternative if a component-internal effect is unwanted:* ship no entrance
    transition (the only transition is the close-button hover); "loses its
    transition" then refers to that. Simpler, but abrupt. **Recommended: the
    mount-flag entrance.**

**D4 — Each theme's Toast echoes its own Alert treatment; token-only.** The Toast
card is a surface card with the semantic hue as an accent border — the
`rackbops-noir` Alert idiom (`background: var(--rb-surface); border: 1px
var(--rb-border); border-left: 4px var(--rb-{semantic})`), floated with
`--rb-shadow-lg`. Text sits on `--rb-surface` (already AA in every theme), so **no
per-theme hex ink** is needed and `contract.json.permittedLiterals` is untouched.
Each theme's `toast.css` mirrors *that theme's* `alert.css` character (border idiom,
radius, shadow); the **region** and **close button** rules are token-driven and
identical across themes. Because a pair's `alert.css` files are byte-identical
(modulo guard), the `toast.css` files will be too → `pair-parity.test.mjs` passes.

**D5 — Dismiss is an optional real button.** `Toast` renders a
`.rb-toast__close` `<button type="button" aria-label="Dismiss">` only when an
`onDismiss` handler is passed; it is inherently keyboard-operable (A2's "dismissible
by keyboard"). It is not in the contract's button-backed set
(`rb-btn|icon-btn|tab|tabstrip__tab|chip`), so it needs no `:not(:disabled)` hover
scoping or disabled dim — a plain close button.

## 4. The class contract (§14.2)

| Part | Class | Element / role | Notes |
| --- | --- | --- | --- |
| Region | `.rb-toast-region` | `<div>` from `ToastRegion`; **no** role/aria-live | `position: fixed`, top/right `--rb-space-4`, column, gap `--rb-space-2`, `width: fit-content`, `max-width: min(28rem, calc(100vw - 2*var(--rb-space-4)))`, high `z-index` |
| Block | `.rb-toast` | `<div>` from `Toast`; `role="status"`\|`"alert"` by D1 | surface card, semantic accent border (D4), flex row, `transition` (D3) |
| Modifiers | `.rb-toast--info` `--success` `--warning` `--danger` | on `.rb-toast` | sets the accent border-colour to `var(--rb-{semantic})` |
| Element | `.rb-toast__close` | `<button type=button aria-label="Dismiss">` | only when `onDismiss` given; `margin-inline-start:auto`; hover `--rb-text-soft`→`--rb-text` via `var(--rb-transition) var(--rb-ease)`; focus `var(--rb-focus-ring)` |

Markup the React + showcase emit:

```html
<div class="rb-toast-region">
  <div class="rb-toast rb-toast--success" role="status">
    Saved
    <button type="button" class="rb-toast__close" aria-label="Dismiss">×</button>
  </div>
  <div class="rb-toast rb-toast--danger" role="alert">
    Couldn't save
    <button type="button" class="rb-toast__close" aria-label="Dismiss">×</button>
  </div>
</div>
```

No `ariaPairs` entry: the semantic modifier is not paired with an ARIA *attribute*
in CSS (the live-region *role* is set in React and the CSS never selects on it).

### Cross-theme token mapping (verified for all 14 by construction)

Every theme declares the full `--rb-*` baseline (enforced by
`contract.test.mjs`), so a token-*name* mapping holds for all 14; only the values
in each `tokens.css` differ. Toast introduces **no new token**.

| State | Property | Token |
| --- | --- | --- |
| Card | background / text / border / radius / shadow | `--rb-surface` / `--rb-text` / `--rb-border` / `--rb-radius` / `--rb-shadow-lg` |
| Card padding / row gap | padding / gap | `--rb-space-3 --rb-space-4` / `--rb-space-2` |
| Variant accent | `border-left-color` | `--rb-info` \| `--rb-success` \| `--rb-warning` \| `--rb-danger` |
| Close (rest→hover) | color | `--rb-text-soft` → `--rb-text` |
| Close focus | outline | `--rb-focus-ring` |
| Motion | transition / easing | `var(--rb-transition)` / `var(--rb-ease)` |
| Region offset / gap | top,right / gap | `--rb-space-4` / `--rb-space-2` |

## 5. File-by-file steps

**A. `styles/contract.json`** *(surgical edit — do not JSON.stringify round-trip; memory `json_surgical_edit_hand_formatted_files`)*
- Insert a `"toast"` key in `components` **immediately after `"alert"`** (this key
  order is the canonical index.css import order):
  `{"react":["Toast","ToastRegion"],"classes":["rb-toast","rb-toast--info","rb-toast--success","rb-toast--warning","rb-toast--danger","rb-toast__close","rb-toast-region"],"notes":"floating transient notice; role by semantic (info/success = status/polite, warning/danger = alert/assertive); ToastRegion is the fixed stack and is not itself a live region; optional __close dismiss button (onDismiss)"}`.
- No `permittedLiterals`/`allowlist`/`ariaPairs` change (D4, §4).

**B. CSS — all 14 themes** (`amber-ember, amber-hearth, arcane-obsidian, arcane-parchment, concrete-signal, concrete-signal-light, kenzen-cyberhealth, kenzen-midnight, luminous-precision, mono-field, neon-butterfly, rackbops-noir, rackbops-studio, summer-cloud`)
- New `styles/<theme>/components/toast.css` — every selector guarded with the exact
  `:where([data-rb-style="<theme>"], … *)` descendant form; card treatment echoes
  that theme's `alert.css` (D4); region + close rules token-driven per §4.
- `styles/<theme>/index.css` — add `@import "./components/toast.css";`
  **immediately after the `alert.css` import** (contract-order test).
- Pairs must stay byte-identical modulo guard (D4) → `pair-parity.test.mjs`.

**C. React** (`components/react/`)
- New `src/Toast.tsx`: `Toast` (forwardRef `<div>`, role by D1, `data-rb-enter`
  mount flag D3, optional `.rb-toast__close` D5) + `ToastRegion` (forwardRef
  `<div class="rb-toast-region">`, no role). JSDoc per §12 (each class-adding prop
  documented; role table; the D2 "region is not a live region" caveat).
- `src/index.ts`: export `Toast`, `ToastRegion`, `ToastProps`, `ToastRegionProps`
  (reuse the shared `SemanticVariant`).
- `src/contract-classes.test.tsx`: add `Toast` (base + each `SEMANTIC` variant +
  one with `onDismiss` to emit `__close`) and `ToastRegion` renders to `RENDERS`;
  add `"rb-toast--": "variant"` to `DYNAMIC_TEMPLATES`.
- `src/refs.test.tsx`: add `Toast`/`ToastRegion` forwardRef tests + imports.
- New `src/Toast.test.tsx`: the behaviour guards (§6).

**D. Docs — all 14 `design.md`** add `.rb-toast` (+ `--{semantic}`, `__close`,
`.rb-toast-region`) to each theme's `## Components` inventory sentence, as a
std-lib shared component (a floating notice) — **not** claimed as reverse-documented
from a source app (fidelity: no app has a themed `.rb-toast` today; it is a shared
addition, like the semantic hues "the marketing site lacks").

**E. `STANDARD.md`**
- §5.1 table (the acceptance's "intake bar"): a `toast.css` row —
  `.rb-toast`, `--info/--success/--warning/--danger`, `__close`,
  `.rb-toast-region` | `Toast`, `ToastRegion` | the D1/D2 a11y note.
- §12 React layer: note the role-by-semantic + region-not-a-live-region rule where
  it lists `role="alert"`/`role="status"` precedents.
- §13 showcase bullet: an analogous "the Toasts section renders all four variants"
  note.
- Appendix A roster + Appendix B enforcement status: add Toast.

**F. `skills/design-system/SKILL.md`** — the component table is **generated** from
contract.json; run `node scripts/generate-skill-table.mjs` after the contract.json
edit (drift-guarded by `generate-skill-table.test.mjs`). No hand-edit of the table.

**G. Showcase** (`site/index.html`) — a "Toasts" section rendering all four
variants + a dismissible one, inside a **static demo wrapper** (a `.sc-*` container
overriding `position: static`/`relative` so the fixed region flows into the tile
for the per-section screenshot). Then generate the 14 `site/__screenshots__/<theme>/toast.png`
baselines via the **`update-visual-baselines` workflow** (never commit
locally-shot baselines — §14.1.7).

**H. `AGENTS.md`** (roshne's explicit request) — stage the currently-untracked
`AGENTS.md` in this PR. Verify first that it is a faithful Codex mirror of this
repo's `CLAUDE.md` (title/header/`AGENTS.md`↔`CLAUDE.md` naming aside) before
staging; it asserts facts about the code, so it rides the same review.

**Not required:** `README.md` (its import example is illustrative, not an
inventory; the inventory is SKILL.md, regenerated). `scripts/new-theme.mjs`
(reads components from contract.json and copies the `--from` dir verbatim, so a new
theme picks up `toast.css` automatically — **verify** `new-theme.test.mjs` stays
green rather than editing it). No new token → `contrast.test.mjs` /
`accessibility-docs.test.mjs` unaffected. `bundle.css`/`all.bundle.css` are
generated at pack time from `index.css` (gitignored) — no manual edit.

## 6. Coverage table (acceptance → step → test → mutation)

| Acceptance | Plan step | Test (suite) | Mutation that fails it |
| --- | --- | --- | --- |
| A1 intake bar, all 14 themes | B, A | `contract.test.mjs`: "every theme ships every required component file" + "every theme's toast.css declares a guarded `.rb-toast`" | delete a theme's `toast.css`, or remove `toast` from contract.json |
| A1 index.css import order | B | `contract.test.mjs`: "index.css imports shared components in contract.json key order" | move the `toast.css` import off its post-`alert` slot |
| A1 React ↔ contract parity | C | `contract-classes.test.tsx` (both directions) | emit `rb-toast` without a contract entry, or list a class no render emits |
| A1 STANDARD §5.1 row / roster | E | *(manual — claims-vs-code audit)* | — |
| A2 announced **once** (region not a live region) | C, D2 | `Toast.test.tsx`: "ToastRegion sets no role/aria-live" | add `aria-live`/`role` to `ToastRegion` |
| A2 role chosen by semantic | C, D1 | `Toast.test.tsx`: "info/success→status, warning/danger→alert" | flip the variant→role map |
| A2 dismissible by keyboard | C, D5 | `Toast.test.tsx`: "`__close` is a real `<button>` and fires `onDismiss`; absent without it" | render a `<div>`, or drop the `onClick` |
| A2 reduced-motion loses only its transition | B, D3 | `contract.test.mjs`: "transitions read `var(--rb-transition)`" + "no unguarded keyframe" | hardcode a duration, or add a keyframe with no reduced-motion override |
| A2 no colour-only signal | C, D1/D4 | *(manual — message text + role carry meaning; showcase review)* | — |
| A3 consumers switch | §7 | *(downstream PRs; manual)* | artifact-console `ToastPortal` still imports `Alert`/`.ac-toasts` |

Every behaviour-changing step above appears in a row; setup (A contract wiring),
docs (D/E/F), and showcase (G) carry no behaviour of their own beyond what the
generated-table / visual jobs already guard.

## 7. Verification (executed, not read) & sequencing

1. `pnpm build && pnpm test` green — the whole suite listed in §CONTEXT, incl.
   `contract.test.mjs`, `pair-parity.test.mjs`, `contract-classes.test.tsx`,
   `refs.test.tsx`, `Toast.test.tsx`, `generate-skill-table.test.mjs`,
   `new-theme.test.mjs`. Paste real output.
2. **Manual a11y (no substitute — personal CLAUDE.md):** open the showcase, and
   with a screen reader confirm a pushed `success` toast is announced **once**
   politely and a `danger` toast assertively; Tab to the `×` and dismiss by
   keyboard; toggle `prefers-reduced-motion` and confirm the toast appears with no
   transition (and nothing else changes). Record what was checked.
3. `pnpm visual` after generating baselines via the workflow; review the 14
   `toast.png` diffs in the PR (the "does it look native per theme" artefact).
4. **Ship** the std-lib PR (commit type `feat` → automated minor bump from
   v0.2.38; release publishes `@rackbops/styles` + `@rackbops/ui-react`).
5. **Then** the downstream adoptions (separate PRs, after the release):
   artifact-console swaps `ToastPortal` `Alert`→`Toast` and `.ac-toasts`→
   `ToastRegion` (keeping `useToasts`) — the real-world proof the API is right; the
   bot panel (#236) consumes it natively.

Review gate (two adversarial lenses + this session) runs on the merged-state
branch before `/pr`, per personal CLAUDE.md — this is a behaviour change.

---

### One scope boundary to confirm

The plan treats **#211 as the std-lib component + release**, with the two
"consumers switch to it" acceptance bullets satisfied by **follow-up PRs in
artifact-console and the bot repo** (they need a published release first, and can't
live inside a std-lib PR). Recommended. The alternative is to also drive the
artifact-console migration as part of this effort (a second PR in that repo, right
after the release). Say which if the default isn't what you want.
