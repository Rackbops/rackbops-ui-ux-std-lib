import {
  createElement,
  forwardRef,
  type HTMLAttributes,
  type ProgressHTMLAttributes,
  type ReactNode,
  type RefAttributes,
} from "react";
import { cx } from "./cx.js";

/** A forwardRef DOM wrapper that adds a base rb-* class and any fixed static attributes. */
function styled<E extends HTMLElement, P extends { className?: string }>(
  tag: string,
  cls: string,
  attrs: Record<string, unknown> = {},
) {
  return forwardRef<E, P>(function Styled({ className, ...rest }, ref) {
    return createElement(tag, { ref, ...attrs, className: cx(cls, className), ...rest });
  });
}

export type SemanticVariant = "info" | "success" | "warning" | "danger";

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    RefAttributes<HTMLSpanElement> {
  variant?: SemanticVariant;
}
export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant, className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cx("rb-badge", variant && `rb-badge--${variant}`, className)}
      {...rest}
    />
  );
});
Badge.displayName = "Badge";

export interface AlertProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title">,
    RefAttributes<HTMLDivElement> {
  variant?: SemanticVariant;
  /**
   * Renders as a heading in `.rb-alert__title`, replacing the native HTML `title` tooltip
   * attribute -- there's no way to set a real tooltip through this component.
   */
  title?: ReactNode;
}
/** A status banner (.rb-alert); `role="alert"` announces it to screen readers on mount/update. */
export const Alert = forwardRef<HTMLDivElement, AlertProps>(function Alert(
  { variant, title, className, children, ...rest },
  ref,
) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cx("rb-alert", variant && `rb-alert--${variant}`, className)}
      {...rest}
    >
      {title !== undefined && <div className="rb-alert__title">{title}</div>}
      {children}
    </div>
  );
});
Alert.displayName = "Alert";

/** Omit `value` for the animated `:indeterminate` state every theme styles (#86). */
export interface ProgressProps
  extends ProgressHTMLAttributes<HTMLProgressElement>,
    RefAttributes<HTMLProgressElement> {}
export const Progress = styled<HTMLProgressElement, ProgressProps>("progress", "rb-progress");
Progress.displayName = "Progress";

export interface SpinnerProps
  extends HTMLAttributes<HTMLSpanElement>,
    RefAttributes<HTMLSpanElement> {}
export const Spinner = styled<HTMLSpanElement, SpinnerProps>("span", "rb-spinner", {
  role: "status",
  "aria-label": "Loading",
});
Spinner.displayName = "Spinner";
