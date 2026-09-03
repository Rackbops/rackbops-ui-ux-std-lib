import type { HTMLAttributes } from "react";
import { cx } from "./cx.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Raised elevation (.rb-card--raised). The three nazuraki ports
   * (luminous-precision, neon-butterfly, summer-cloud) don't define a second
   * elevation tier, matching upstream — raised falls back to the base card
   * there.
   */
  raised?: boolean;
}

export function Card({ raised, className, ...rest }: CardProps) {
  return <div className={cx("rb-card", raised && "rb-card--raised", className)} {...rest} />;
}
