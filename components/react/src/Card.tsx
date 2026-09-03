import type { HTMLAttributes } from "react";
import { cx } from "./cx.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * Raised elevation (.rb-card--raised). Falls back to the base card in the
   * three nazuraki ports: luminous-precision and neon-butterfly have no
   * second elevation tier upstream at all; summer-cloud's upstream second
   * tier is `--floating`, already carried over, so it doesn't also add a
   * near-duplicate `--raised`.
   */
  raised?: boolean;
}

export function Card({ raised, className, ...rest }: CardProps) {
  return <div className={cx("rb-card", raised && "rb-card--raised", className)} {...rest} />;
}
