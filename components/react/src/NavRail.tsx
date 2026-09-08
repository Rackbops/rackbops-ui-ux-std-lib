import {
  forwardRef,
  type AnchorHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  type RefAttributes,
} from "react";
import { cx } from "./cx.js";
import { NavLink } from "./NavLink.js";

export interface NavRailItem extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "id" | "href"> {
  /** Matched against `activeId`; also used as the React list key. */
  id: string;
  label: ReactNode;
  href?: string;
  // AnchorHTMLAttributes has no index signature for data-* (TS only special-cases those on a
  // JSX tag's own attributes, not on a plain object type like this one), so it's declared here.
  [dataAttr: `data-${string}`]: unknown;
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
 * this component owns no state of its own. Any extra props on an item (onClick, target,
 * rel, aria-*, data-*, className, ...) forward onto that item's own NavLink/<a> -- e.g. to
 * intercept a click for a client router while still setting a real `href`.
 */
export const NavRail = forwardRef<HTMLElement, NavRailProps>(function NavRail(
  { items, activeId, className, ...rest },
  ref,
) {
  return (
    <nav ref={ref} className={cx("rb-nav-rail", className)} {...rest}>
      {items.map(({ id, label, href, ...itemRest }) => (
        <NavLink key={id} href={href} active={id === activeId} {...itemRest}>
          {label}
        </NavLink>
      ))}
    </nav>
  );
});
NavRail.displayName = "NavRail";
