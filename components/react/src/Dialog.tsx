import {
  forwardRef,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  type DialogHTMLAttributes,
  type ReactNode,
  type RefAttributes,
} from "react";
import { cx } from "./cx.js";

export interface DialogProps
  extends Omit<DialogHTMLAttributes<HTMLDialogElement>, "open" | "title" | "onClose">,
    RefAttributes<HTMLDialogElement> {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  actions?: ReactNode;
}

/** A native <dialog> driven by the `open` prop (showModal/close). */
export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(function Dialog(
  { open, onClose, title, actions, children, className, ...rest },
  forwardedRef,
) {
  const internalRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Expose the same <dialog> node this component drives to a forwarded ref,
  // instead of a fresh callback-ref identity per render. A per-render merge
  // callback re-attaches every render and never runs a React 19 cleanup-style
  // consumer ref's cleanup; `useImperativeHandle` with [] deps attaches once
  // and detaches (running that cleanup) on unmount (issue #83).
  useImperativeHandle(forwardedRef, () => internalRef.current!, []);

  // `onClose` is required, so the parent is always told when the platform
  // closes the dialog (Escape, a method="dialog" form) and keeps `open` in
  // sync -- `open` is the single source of truth. That makes `[open]` the
  // correct, complete dependency: reconcile only when the desired state
  // changes, which reopens on a real false->true transition without the
  // spontaneous reopens a dependency-less effect caused on unrelated renders
  // (issue #83, completing #31).
  useEffect(() => {
    const el = internalRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={internalRef}
      className={cx("rb-dialog", className)}
      onClose={onClose}
      aria-labelledby={title !== undefined ? titleId : undefined}
      {...rest}
    >
      <div className="rb-dialog__body">
        {title !== undefined && (
          <h2 id={titleId} className="rb-dialog__title">
            {title}
          </h2>
        )}
        {children}
      </div>
      {actions !== undefined && <div className="rb-dialog__actions">{actions}</div>}
    </dialog>
  );
});
Dialog.displayName = "Dialog";
