import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type Ref,
  type RefAttributes,
} from "react";
import { cx } from "./cx.js";

export interface DialogProps extends RefAttributes<HTMLDialogElement> {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** Combines an internal ref this component needs with a consumer-supplied one,
 * so both end up pointing at the same DOM node. */
function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T | null) => {
    for (const ref of refs) {
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: T | null }).current = node;
    }
  };
}

/** A native <dialog> driven by the `open` prop (showModal/close). */
export const Dialog = forwardRef<HTMLDialogElement, DialogProps>(function Dialog(
  { open, onClose, title, actions, children, className },
  forwardedRef,
) {
  const internalRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = internalRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={mergeRefs(internalRef, forwardedRef)}
      className={cx("rb-dialog", className)}
      onClose={onClose}
      aria-labelledby={title !== undefined ? titleId : undefined}
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
