import type { AnchorHTMLAttributes } from "react";
import { cx } from "./cx.js";

export interface NavLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Marks the active route (.rb-link--active). */
  active?: boolean;
}

export function NavLink({ active, className, ...rest }: NavLinkProps) {
  return (
    <a
      aria-current={active ? "page" : undefined}
      className={cx("rb-link", active && "rb-link--active", className)}
      {...rest}
    />
  );
}
