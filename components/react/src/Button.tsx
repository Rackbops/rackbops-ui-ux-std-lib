import type { ButtonHTMLAttributes } from "react";
import { cx } from "./cx.js";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual emphasis. Maps to .rb-btn--{variant}. */
  variant?: "default" | "primary" | "accent" | "danger" | "ghost";
}

export function Button({ variant = "default", type = "button", className, ...rest }: ButtonProps) {
  // Default type="button" so a Button inside a <form> doesn't submit it on
  // click; pass type="submit" explicitly when that's what you want.
  return (
    <button
      type={type}
      className={cx("rb-btn", variant !== "default" && `rb-btn--${variant}`, className)}
      {...rest}
    />
  );
}
