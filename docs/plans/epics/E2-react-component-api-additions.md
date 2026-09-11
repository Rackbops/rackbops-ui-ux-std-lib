# E2 -- React component API additions: implementation plan, PR 1 (#169 + #150)

Epic #178. This plan covers the first PR: #169 (controlled `Tabs`) and #150 (`DataTable` column widths), entered via `/work-on 169`, closing both. #173 (`EmptyState`) is PR 2 and gets its own plan after this lands. Written by the orchestrator on 2026-09-10 against `main` at `a9bb73e` (v0.2.28); line numbers are from that commit -- re-check with `grep -n` before editing. Committed on the branch as `docs/plans/epics/E2-react-component-api-additions.md` in the first commit.

## Locked decisions

1. **Additive only.** Two new optional props on `Tabs`, one new optional field on `DataTableColumn`. No breaking marker; `feat(react):` commits (patch bump).
2. **No new `rb-*` class**, so `contract-classes.test.tsx` emissions are unchanged and no theme CSS, `contract.json` class list, showcase tile or visual baseline moves. The `<colgroup>`/`<col>` elements carry no class.
3. **`Tabs` controlled mode mirrors `NavRail` (`activeId`) in name and `Tabstrip` (`selected`/`onSelect`) in mechanics.** Controlled when `activeId !== undefined`. `onChange(id)` fires on every user-initiated selection (click, ArrowLeft/Right/Up/Down, Home, End) in **both** modes; internal state updates only when uncontrolled. `defaultId` is ignored in controlled mode. The "exactly one tab selected" fallback (an id matching no item selects the first) applies in both modes. The `useState(defaultId ?? items[0]?.id)` initialiser is kept as-is -- #98's verification refuted its redundancy (it decides the selection after an items change in uncontrolled mode).
4. **`DataTable` sets `table-layout: fixed` inline when any column declares a `width`**, with a why-comment, under STANDARD.md 12's "structural layout a theme has no opinion on MAY be inline" rule (`:774`, the `LinksIndex` grid precedent). Verified: no theme's `components/*.css` sets `table-layout`, `colgroup` or `col`, so nothing a theme owns is overridden. A table with no widths renders exactly as today (no `<colgroup>`, no `style`).
5. **Drive-by fidelity fix in the same file you are editing:** `styles/contract.json:65`'s tabstrip note says "now a shared component in all twelve" -- there are fourteen themes (STANDARD.md `:408` already says fourteen). Fix the number; the SKILL.md table regenerates from it.

## Build order (one commit per step, Conventional Commits, scope `react` unless stated)

### 1. Plan file -- `docs(plans): E2 react component API additions, PR 1 plan`

This document, verbatim, at `docs/plans/epics/E2-react-component-api-additions.md`.

### 2. `components/react/src/Tabs.tsx` -- `feat(react): controlled activeId/onChange on Tabs (#169)`

Props (`:19-23`), replacing the block:

```tsx
export interface TabsProps extends HTMLAttributes<HTMLDivElement>, RefAttributes<HTMLDivElement> {
  items: TabItem[];
  /** Uncontrolled mode: the initially active tab id; defaults to the first item. Ignored when
   * `activeId` is set. */
  defaultId?: string;
  /** Controlled mode, mirroring NavRail's `activeId`: the active tab id, owned by the caller.
   * When set the component keeps no selection state of its own -- `onChange` reports what the
   * user picked and the parent re-renders with the new id (so it can live in a router or URL).
   * An id matching no item selects the first tab, so exactly one tab is always selected. */
  activeId?: string;
  /** Called with the id the user selected (click, arrow keys, Home/End) in both modes; in
   * uncontrolled mode the internal selection also updates. */
  onChange?: (id: string) => void;
}
```

Body: destructure `activeId: activeIdProp` and `onChange` from props (`:26`) so they do not land in `...rest`. Replace `:30-33` with:

```tsx
const [internal, setInternal] = useState<string | undefined>(defaultId ?? items[0]?.id);
const controlled = activeIdProp !== undefined;
const requested = controlled ? activeIdProp : internal;
// Fall back to the first tab if `requested` names no item, so exactly one tab is
// always selected (a defaultId or activeId that matches nothing still highlights a tab).
const activeId = items.some((t) => t.id === requested) ? requested : items[0]?.id;
const select = (id: string) => {
  if (!controlled) setInternal(id);
  onChange?.(id);
};
```

Then `:45` `setActive(items[next]?.id)` becomes `const id = items[next]?.id; if (id !== undefined) select(id);` (keep the focus move at `:47`), and `:73` `onClick={() => setActive(t.id)}` becomes `onClick={() => select(t.id)}`. Nothing else in the render changes; the class emissions are identical.

### 3. `components/react/src/Tabs.test.tsx` -- same commit as step 2

Keep the two static-markup tests. Below them, client-render tests in the shape `Tabstrip.test.tsx:99-150` already uses (`await import("./test-dom.js")`, `createRoot` + `flushSync`, `dispatchEvent` of `MouseEvent("click")` / `KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })`). `Tabs` attaches `onKeyDown` to each tab **button** (`:74`), not the tablist, so dispatch keydown on the selected button. Helpers: `mount(el)` returning `{ container, root, cleanup }` (keep `root` so a test can re-render with new props via `flushSync(() => root.render(...))`), `selectedTab(container)` returning the `[role="tab"][aria-selected="true"]` element's text.

Test names (exact):

- `controlled: aria-selected follows activeId across parent re-renders` -- mount `activeId="b"` -> selected is B; re-render `activeId="a"` -> selected is A.
- `controlled: ArrowRight calls onChange with the next id and leaves aria-selected unchanged until the parent re-renders` -- `activeId="a"`, `onChange` pushes to an array; keydown ArrowRight on tab A -> calls deep-equal `["b"]`, selected still A; re-render `activeId="b"` -> selected B. Also assert `document.activeElement` is tab B after the keydown (the roving focus moved even though selection waited).
- `controlled: a click calls onChange and does not change the selection by itself` -- click B -> calls `["b"]`, selected still A.
- `controlled: an activeId matching no item selects the first tab` -- `activeId="zzz"` -> selected A, and exactly one `aria-selected="true"`.
- `uncontrolled: onChange also fires and the selection updates internally` -- no `activeId`, click B -> calls `["b"]` and selected B.
- `uncontrolled: defaultId still picks the initial tab and is ignored once activeId is set` -- `defaultId="b"` alone -> B; `defaultId="b" activeId="a"` -> A.

### 4. `components/react/src/DataTable.tsx` -- `feat(react): per-column width on DataTable, rendered as a colgroup (#150)`

Add to `DataTableColumn<T>` (`:4-14`), after `numeric`:

```tsx
  /** CSS width for the column (`"20%"`, `"12rem"`), rendered as `<col style="width: ...">` in a
   * `<colgroup>` ahead of `<thead>`. Declaring a width on any column also puts the table in
   * `table-layout: fixed`, so the widths are honoured and stay identical across table instances
   * instead of each auto-sizing from its own content (kenzen#70). Columns without a width share
   * the remaining space. */
  width?: string;
```

In the render (`:134-135`): compute `const hasWidths = columns.some((c) => c.width !== undefined);` above `const table = (`; make the table tag `<table className="rb-table" style={hasWidths ? { tableLayout: "fixed" } : undefined}>` with the comment `// table-layout is structural (which sizing algorithm), not a theme's visual opinion -- no theme CSS sets it -- so it is inline here, like LinksIndex's grid (STANDARD.md 12).`; and immediately inside, before `<thead>`:

```tsx
      {hasWidths && (
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={column.width !== undefined ? { width: column.width } : undefined} />
          ))}
        </colgroup>
      )}
```

Nothing else changes. `GroupRows` is untouched.

### 5. `components/react/src/DataTable.test.tsx` -- same commit as step 4

Static-markup tests, next to the existing ones (`:31-119`):

- `columns with a width render a colgroup ahead of thead and switch the table to fixed layout` -- `COLUMNS` with `width: "20%"` on `name` only; `assert.match(html, /^<table class="rb-table" style="table-layout:fixed"><colgroup><col style="width:20%"\/><col\/><\/colgroup><thead>/)`.
- `no column declares a width: no colgroup and no inline style, exactly as before` -- `assert.match(html, /^<table class="rb-table"><thead>/)` and `!html.includes("<colgroup")`.
- The existing sticky test (`:111-119`, anchored on `<table class="rb-table"`) must pass unmodified -- it is the guard that width-less tables did not change.

### 6. Documentation surfaces -- `docs: document Tabs' controlled mode and DataTable column widths`

- `styles/contract.json:60` (tabs `notes`): append `; optional controlled activeId/onChange pair mirroring NavRail, uncontrolled via defaultId when activeId is omitted (#169)`. `:70` (data-table `notes`): append `; per-column width renders a <colgroup> and switches to table-layout: fixed (#150)`. `:65`: `all twelve` -> `all fourteen`. Surgical text edits, no JSON round-trip.
- `node scripts/generate-skill-table.mjs` (no flag) rewrites `skills/design-system/SKILL.md`'s table; then `node scripts/generate-skill-table.mjs --check` is clean. Do not hand-edit the table.
- `STANDARD.md:773`: replace the clause `` `Tabs` MAY keep its selection until a controlled API is in scope `` with `` `Tabs` takes an optional controlled `activeId`/`onChange` pair (`Tabs.tsx:<lines>`, #169) and stays uncontrolled when `activeId` is omitted ``. `:772`: re-derive the `Tabs.tsx:41-63` citation (the tablist render moved). `:973` (the status table row for this exact item, which says "never spun into its own issue"): status becomes `live (#169)`. Every other row in that table that cites `Tabs.tsx:<n>` is re-checked.
- README has no Tabs/DataTable example (verified: no matches), nothing to do there.

## Mutation guards (each must turn the suite red; paste one failing assertion per row)

| Change | Mutation | Failing test |
| --- | --- | --- |
| controlled derivation | `const requested = internal;` (ignore the prop) | `controlled: aria-selected follows activeId ...` |
| onChange on keyboard | drop `onChange?.(id)` from `select` | `controlled: ArrowRight calls onChange ...` and the uncontrolled onChange test |
| no self-selection when controlled | `if (!controlled)` -> unconditional `setInternal(id)` combined with `requested = internal` | the click test |
| first-tab fallback | `const activeId = requested;` | `controlled: an activeId matching no item ...` |
| defaultId precedence | `requested = controlled ? internal : activeIdProp` | `uncontrolled: defaultId still picks ...` |
| colgroup | delete the `{hasWidths && ...}` block | `columns with a width render a colgroup ...` |
| fixed layout | delete the `style` prop | same test (the `style=` part of the regex) |
| colgroup gating | `hasWidths = true` | `no column declares a width ...` and the sticky test |
| class emissions | (no mutation -- assert) | `contract-classes.test.tsx` passes with no edit to `contract.json`'s class lists |

## Acceptance to execute and paste

1. `pnpm --filter @rackbops/ui-react test` green (it runs `tsc --noEmit` first, then every `*.test.tsx`); paste the run with the eight new test names visible.
2. `pnpm build`, then `grep -n 'activeId\|onChange' components/react/dist/Tabs.d.ts` and `grep -n 'width' components/react/dist/DataTable.d.ts` -- the new API is in the published types.
3. `node scripts/generate-skill-table.mjs --check` clean; paste the regenerated Tabs and DataTable rows from SKILL.md.
4. `grep -n 'Tabs' STANDARD.md` showing rows 772/773/973 after the edit; paste them.
5. `pnpm test` (root) green -- includes `contract-classes.test.tsx` (emissions unchanged) and the skill-table check.
6. The mutation table above, one pasted failure per row.

## Exit demo (PR 1's share of the epic's exit criterion)

After merge, from a scratch consumer with the packed `@rackbops/ui-react` installed: `<Tabs items={items} activeId={id} onChange={setId} />` and `columns: [{ key: "name", header: "Name", render: r => r.name, width: "40%" }]` both type-check. kenzen can then delete `.kz-items-table th:nth-child(n)` (kenzen#70) -- that deletion is kenzen's follow-up, not this PR.

## Sub's operating rules

- Read #169, #150 and #178 in full, including comments, before touching anything.
- Own worktree from `origin/main`; never `git stash`; `git -C`, never `cd && git`; no force-push.
- Run the review gate yourself (two read-only adversarial agents, different lenses: correctness/failure modes -- especially the controlled/uncontrolled edge cases and the keyboard path -- vs. claims-vs-code walking the acceptance list above), up to four rounds, then report the round count and findings to the orchestrator rather than starting a fifth.
- Report deviations as they arise (a line that moved, a test that cannot be written as named, a static-markup shape that differs from the regex given here -- adjust the regex to what React actually emits and say so).
- Do not merge. Post the PR link, the pasted acceptance and mutation evidence, and the gate evidence to the orchestrator.

