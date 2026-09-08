import type { KeyboardEvent, ReactNode } from "react";
import { cx } from "./cx.js";

export interface TabstripTab {
  /** Unique among this strip's tabs; what `onSelect` reports and `selected` matches. */
  id: string;
  label: ReactNode;
  /** Optional trailing count/badge, e.g. how many items the tab holds. */
  badge?: ReactNode;
}

export interface TabstripProps {
  tabs: TabstripTab[];
  selected: string;
  onSelect: (id: string) => void;
  /** Names the strip for assistive tech, e.g. "View". */
  label: string;
}

/**
 * A controlled tab strip on the `rb-tabstrip` contract -- the design system's existing
 * top-level-view-nav pattern (bordered pill buttons; the active tab gets accent text, a wash,
 * and an accent-tinted border), previously a two-theme "extra" (arcane-obsidian/arcane-parchment)
 * with no React wrapper. This component gives every theme the same pattern via shared tokens,
 * and adds `.rb-tabstrip__badge` to the contract for an optional trailing count.
 *
 * Controlled rather than self-stateful so the selected tab can be lifted -- a caller that wants
 * it in the URL, or restored across a data reload, cannot do that with internal state.
 *
 * Implements the ARIA tabs pattern: `role="tablist"` with roving `tabIndex`, so the strip is a
 * SINGLE tab stop and arrow keys move between tabs -- a plain row of buttons would instead make
 * a keyboard user tab through every one to reach the content. Left/Right wrap at both ends, and
 * Home/End jump to the first/last, which is what that pattern specifies. `aria-controls` is
 * deliberately not asserted, since this component cannot know the panel's id and claiming a
 * relationship that does not exist would mislead a screen-reader user.
 */
export function Tabstrip({ tabs, selected, onSelect, label }: TabstripProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = tabs.findIndex((t) => t.id === selected);
    if (index === -1) {
      return;
    }
    let next: number | null = null;
    switch (event.key) {
      case "ArrowRight":
        next = (index + 1) % tabs.length;
        break;
      case "ArrowLeft":
        next = (index - 1 + tabs.length) % tabs.length;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = tabs.length - 1;
        break;
      default:
        return;
    }
    const target = tabs[next];
    if (target) {
      event.preventDefault();
      onSelect(target.id);
    }
  }

  // When `selected` matches no tab (a caller mid-reload passing a stale id), every tab would
  // otherwise get tabIndex=-1 and the whole strip would drop out of the tab order entirely --
  // a keyboard trap strictly worse than the inert arrow keys above. Fall back to making the
  // first tab the strip's single tab stop, so it stays reachable.
  const hasSelected = tabs.some((t) => t.id === selected);

  return (
    <div role="tablist" aria-label={label} className="rb-tabstrip" onKeyDown={onKeyDown}>
      {tabs.map((tab, index) => {
        const isSelected = tab.id === selected;
        const isTabStop = hasSelected ? isSelected : index === 0;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isSelected}
            // Roving tabIndex: exactly one tab is reachable by Tab, so the whole strip is one
            // stop and the arrow keys above do the moving within it.
            tabIndex={isTabStop ? 0 : -1}
            className={cx("rb-tabstrip__tab", isSelected && "rb-tabstrip__tab--active")}
            onClick={() => onSelect(tab.id)}
          >
            {tab.label}
            {tab.badge !== undefined && <span className="rb-tabstrip__badge">{tab.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
