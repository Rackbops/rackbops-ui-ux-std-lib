import { forwardRef, type HTMLAttributes, type RefAttributes } from "react";
import { cx } from "./cx.js";

export interface CardProps extends HTMLAttributes<HTMLDivElement>, RefAttributes<HTMLDivElement> {
  /**
   * Raised elevation, mapping to `.rb-card--raised`. Styled by every theme with
   * a second elevation tier; a sanctioned no-op in the three nazuraki ports --
   * luminous-precision and neon-butterfly have no second tier upstream, and
   * summer-cloud's is `--floating` (already carried over), so `--raised` would
   * only duplicate it. Documented in STANDARD.md 5.3 and contract.json's
   * allowlist, where it falls through to the base card.
   */
  raised?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { raised, className, ...rest },
  ref,
) {
  return (
    <div ref={ref} className={cx("rb-card", raised && "rb-card--raised", className)} {...rest} />
  );
});
Card.displayName = "Card";
