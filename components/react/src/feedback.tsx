import type { HTMLAttributes, ProgressHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx.js";

export type SemanticVariant = "info" | "success" | "warning" | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: SemanticVariant;
}
export function Badge({ variant, className, ...rest }: BadgeProps) {
  return (
    <span className={cx("rb-badge", variant && `rb-badge--${variant}`, className)} {...rest} />
  );
}

export interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: SemanticVariant;
  title?: ReactNode;
}
export function Alert({ variant, title, className, children, ...rest }: AlertProps) {
  return (
    <div
      role="alert"
      className={cx("rb-alert", variant && `rb-alert--${variant}`, className)}
      {...rest}
    >
      {title !== undefined && <div className="rb-alert__title">{title}</div>}
      {children}
    </div>
  );
}

export type ProgressProps = ProgressHTMLAttributes<HTMLProgressElement>;
export function Progress({ className, ...rest }: ProgressProps) {
  return <progress className={cx("rb-progress", className)} {...rest} />;
}

export function Spinner({ className, ...rest }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx("rb-spinner", className)}
      {...rest}
    />
  );
}
