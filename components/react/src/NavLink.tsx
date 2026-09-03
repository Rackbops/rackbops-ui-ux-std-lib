import { forwardRef, type AnchorHTMLAttributes, type RefAttributes } from "react";
import { cx } from "./cx.js";

export interface NavLinkProps
  extends AnchorHTMLAttributes<HTMLAnchorElement>,
    RefAttributes<HTMLAnchorElement> {
  /** Marks the active route (.rb-link--active). */
  active?: boolean;
}

export const NavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(function NavLink(
  { active, className, ...rest },
  ref,
) {
  return (
    <a
      ref={ref}
      aria-current={active ? "page" : undefined}
      className={cx("rb-link", active && "rb-link--active", className)}
      {...rest}
    />
  );
});
NavLink.displayName = "NavLink";
