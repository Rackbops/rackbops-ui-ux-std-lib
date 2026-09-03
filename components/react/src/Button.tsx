import { forwardRef, type ButtonHTMLAttributes, type RefAttributes } from "react";
import { cx } from "./cx.js";

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    RefAttributes<HTMLButtonElement> {
  /** Visual emphasis. Maps to .rb-btn--{variant}. */
  variant?: "default" | "primary" | "accent" | "danger" | "ghost";
  /** Size. "sm" maps to .rb-btn--sm for inline/table-row actions; "md" is the default. */
  size?: "sm" | "md";
  /**
   * Icon-only mode: square hit target, no text gap. Maps to .rb-icon-btn.
   * There's no visible label, so pass an accessible name via `aria-label`.
   */
  iconOnly?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "default", size = "md", iconOnly = false, type = "button", className, ...rest },
  ref,
) {
  // Default type="button" so a Button inside a <form> doesn't submit it on
  // click; pass type="submit" explicitly when that's what you want.
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "rb-btn",
        variant !== "default" && `rb-btn--${variant}`,
        size === "sm" && "rb-btn--sm",
        iconOnly && "rb-icon-btn",
        className,
      )}
      {...rest}
    />
  );
});
Button.displayName = "Button";
