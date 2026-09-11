import {
  forwardRef,
  useId,
  useRef,
  useState,
  type HTMLAttributes,
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

// `Omit<..., "onChange">`: HTMLAttributes already types a DOM `onChange` (a ChangeEventHandler,
// meaningless on a tablist div), and TS2430 refuses to narrow it to the id callback below.
export interface TabsProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
    RefAttributes<HTMLDivElement> {
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

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(function Tabs(
  { items, defaultId, activeId: activeIdProp, onChange, className, ...rest },
  ref,
) {
  const base = useId();
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
    const id = items[next]?.id;
    if (id !== undefined) select(id);
    // Move focus with the selection — the whole point of the roving tabindex.
    tabRefs.current[next]?.focus();
  };

  return (
    // The outer <div> is a plain structural wrapper -- an ARIA tablist should
    // contain only `tab` children, so the tabpanels below live as its
    // siblings instead. That's the element `ref` points to; className and
    // arbitrary props (aria-label, data-testid, id, ...) belong on the actual
    // role="tablist" element, which is what they're meant to reach.
    <div ref={ref}>
      <div className={cx("rb-tabs", className)} role="tablist" {...rest}>
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
              onClick={() => select(t.id)}
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
