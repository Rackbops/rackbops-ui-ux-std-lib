import { forwardRef, type HTMLAttributes, type ReactNode, type RefAttributes } from "react";
import { cx } from "./cx.js";
import { NavLink } from "./NavLink.js";

export interface NavRailItem {
  /** Matched against `activeId`; also used as the React list key. */
  id: string;
  label: ReactNode;
  href?: string;
}

export interface NavRailProps extends HTMLAttributes<HTMLElement>, RefAttributes<HTMLElement> {
  items: NavRailItem[];
  /** Id of the currently active item (mirrors NavLink's own `active` contract --
   * no second active-state convention). No item is marked active if it matches none. */
  activeId?: string;
}

/**
 * A vertical nav container (.rb-nav-rail) rendering one NavLink per item.
 * Controlled by the caller via `activeId`, same as NavLink's own `active` prop --
 * this component owns no state of its own.
 */
export const NavRail = forwardRef<HTMLElement, NavRailProps>(function NavRail(
  { items, activeId, className, ...rest },
  ref,
) {
  return (
    <nav ref={ref} className={cx("rb-nav-rail", className)} {...rest}>
      {items.map((item) => (
        <NavLink key={item.id} href={item.href} active={item.id === activeId}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
});
NavRail.displayName = "NavRail";
