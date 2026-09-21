import {
  forwardRef,
  useEffect,
  useState,
  type HTMLAttributes,
  type RefAttributes,
} from "react";
import { cx } from "./cx.js";
import type { SemanticVariant } from "./feedback.js";

// Role by urgency (#211): info/success are polite confirmations ("Saved"),
// warning/danger interrupt. A variantless toast defaults to the polite role.
const ASSERTIVE: ReadonlySet<SemanticVariant> = new Set(["warning", "danger"]);

export interface ToastProps
  extends HTMLAttributes<HTMLDivElement>,
    RefAttributes<HTMLDivElement> {
  /** Maps to `.rb-toast--{variant}` and picks the live-region role: `info`/`success`
   * announce politely (`role="status"`), `warning`/`danger` assertively
   * (`role="alert"`). Omitted, the toast is polite and carries no variant class. */
  variant?: SemanticVariant;
  /**
   * When provided, renders a keyboard-focusable dismiss button (`.rb-toast__close`)
   * that calls this. Omit for a toast the consumer removes on its own timer -- the
   * primitive owns no queue or timer (the consumer does, as artifact-console's
   * `useToasts` already did). A toast is never the only place an error is reported.
   */
  onDismiss?: () => void;
  /** `aria-label` for the dismiss button; default `"Dismiss"`. */
  dismissLabel?: string;
}

/**
 * A transient notice (`.rb-toast`), rendered inside a `ToastRegion` stack. Its
 * live-region role is chosen by `variant` (see above), so it announces once on
 * insertion; the region itself is not a live region (that would double-announce).
 *
 * Entrance is a CSS transition, not a keyframe: the toast mounts with a
 * `data-rb-enter` from-state that is cleared after the first paint so the
 * transition plays. Under `prefers-reduced-motion` the per-theme
 * `--rb-transition: 0s` token collapse makes it appear instantly -- it loses only
 * its transition, nothing else.
 */
export const Toast = forwardRef<HTMLDivElement, ToastProps>(function Toast(
  { variant, onDismiss, dismissLabel = "Dismiss", className, children, ...rest },
  ref,
) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    // A single frame after the first paint, drop the from-state so the CSS
    // transition runs. cancelAnimationFrame on unmount so a toast removed before
    // the frame fires never calls setState after unmount. Where there is no frame
    // scheduler (jsdom, SSR-hydration shims, non-visual runtimes -- none of which
    // paint anyway), show the toast immediately instead of throwing.
    if (typeof requestAnimationFrame !== "function") {
      setEntering(false);
      return;
    }
    const id = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(id);
  }, []);
  const role = variant && ASSERTIVE.has(variant) ? "alert" : "status";
  return (
    <div
      ref={ref}
      role={role}
      data-rb-enter={entering ? "" : undefined}
      className={cx("rb-toast", variant && `rb-toast--${variant}`, className)}
      {...rest}
    >
      {children}
      {onDismiss && (
        <button
          type="button"
          className="rb-toast__close"
          aria-label={dismissLabel}
          onClick={onDismiss}
        >
          {"×"}
        </button>
      )}
    </div>
  );
});
Toast.displayName = "Toast";

export interface ToastRegionProps
  extends HTMLAttributes<HTMLDivElement>,
    RefAttributes<HTMLDivElement> {}

/**
 * The fixed stacking region (`.rb-toast-region`) that holds Toasts. Deliberately
 * NOT a live region: each `Toast` announces itself (role by variant), and a polite
 * region wrapping assertive children double-announces on some screen readers
 * (the rule artifact-console's hand-rolled `ToastPortal` already documented).
 */
export const ToastRegion = forwardRef<HTMLDivElement, ToastRegionProps>(
  function ToastRegion({ className, ...rest }, ref) {
    return <div ref={ref} className={cx("rb-toast-region", className)} {...rest} />;
  },
);
ToastRegion.displayName = "ToastRegion";
