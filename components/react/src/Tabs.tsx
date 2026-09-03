import {
  forwardRef,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type RefAttributes,
} from "react";
import { cx } from "./cx.js";

export interface TabItem {
  id: string;
  label: ReactNode;
  content: ReactNode;
}

export interface TabsProps extends RefAttributes<HTMLDivElement> {
  items: TabItem[];
  /** Initially active tab id; defaults to the first item. */
  defaultId?: string;
  className?: string;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { items, defaultId, className },
  ref,
) {
  const base = useId();
  const [active, setActive] = useState<string | undefined>(defaultId ?? items[0]?.id);
  // Fall back to the first tab if `active` names no item, so exactly one tab is
  // always selected (a defaultId that matches nothing still highlights a tab).
  const activeId = items.some((t) => t.id === active) ? active : items[0]?.id;
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const i = items.findIndex((t) => t.id === activeId);
    let next = i;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % items.length;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    else return;
    e.preventDefault();
    setActive(items[next]?.id);
    // Move focus with the selection — the whole point of the roving tabindex.
    tabRefs.current[next]?.focus();
  };

  return (
    <div ref={ref} className={className}>
      <div className="rb-tabs" role="tablist">
        {items.map((t, idx) => {
          const selected = t.id === activeId;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`${base}-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className={cx("rb-tab", selected && "rb-tab--active")}
              onClick={() => setActive(t.id)}
              onKeyDown={onKeyDown}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {/* Render every panel (hiding inactive) so each tab's aria-controls points
          at a real element and content is preserved across tab switches. */}
      {items.map((t) => {
        const selected = t.id === activeId;
        return (
          <div
            key={t.id}
            className="rb-tabpanel"
            role="tabpanel"
            id={`${base}-panel-${t.id}`}
            aria-labelledby={`${base}-tab-${t.id}`}
            hidden={!selected}
            tabIndex={0}
          >
            {t.content}
          </div>
        );
      })}
    </div>
  );
});
Tabs.displayName = "Tabs";
