import { useEffect, useId, useRef, type ReactNode } from "react";
import { cx } from "./cx.js";

export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}

/** A native <dialog> driven by the `open` prop (showModal/close). */
export function Dialog({ open, onClose, title, actions, children, className }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
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
}
