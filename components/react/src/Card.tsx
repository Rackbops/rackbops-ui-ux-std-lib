import type { HTMLAttributes } from "react";
import { cx } from "./cx.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Raised elevation (.rb-card--raised); themes that don't define it fall back. */
  raised?: boolean;
}

export function Card({ raised, className, ...rest }: CardProps) {
  return <div className={cx("rb-card", raised && "rb-card--raised", className)} {...rest} />;
}
