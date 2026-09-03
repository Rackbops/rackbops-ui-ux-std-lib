import {
  forwardRef,
  type HTMLAttributes,
  type ProgressHTMLAttributes,
  type ReactNode,
  type RefAttributes,
} from "react";
import { cx } from "./cx.js";

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
  title?: ReactNode;
}
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

export interface ProgressProps
  extends ProgressHTMLAttributes<HTMLProgressElement>,
    RefAttributes<HTMLProgressElement> {}
export const Progress = forwardRef<HTMLProgressElement, ProgressProps>(function Progress(
  { className, ...rest },
  ref,
) {
  return <progress ref={ref} className={cx("rb-progress", className)} {...rest} />;
});
Progress.displayName = "Progress";

export interface SpinnerProps
  extends HTMLAttributes<HTMLSpanElement>,
    RefAttributes<HTMLSpanElement> {}
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(function Spinner(
  { className, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      role="status"
      aria-label="Loading"
      className={cx("rb-spinner", className)}
      {...rest}
    />
  );
});
Spinner.displayName = "Spinner";
