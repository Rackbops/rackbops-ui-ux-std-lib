import {
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type RefAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx.js";

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    RefAttributes<HTMLInputElement> {}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cx("rb-input", className)} {...rest} />;
});
Input.displayName = "Input";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    RefAttributes<HTMLTextAreaElement> {}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, ...rest },
  ref,
) {
  return <textarea ref={ref} className={cx("rb-textarea", className)} {...rest} />;
});
Textarea.displayName = "Textarea";

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    RefAttributes<HTMLSelectElement> {}
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, ...rest },
  ref,
) {
  return <select ref={ref} className={cx("rb-select", className)} {...rest} />;
});
Select.displayName = "Select";

export interface LabelProps
  extends LabelHTMLAttributes<HTMLLabelElement>,
    RefAttributes<HTMLLabelElement> {}
export const Label = forwardRef<HTMLLabelElement, LabelProps>(function Label(
  { className, ...rest },
  ref,
) {
  return <label ref={ref} className={cx("rb-label", className)} {...rest} />;
});
Label.displayName = "Label";

export interface FieldProps
  extends HTMLAttributes<HTMLDivElement>,
    RefAttributes<HTMLDivElement> {}
export const Field = forwardRef<HTMLDivElement, FieldProps>(function Field(
  { className, ...rest },
  ref,
) {
  return <div ref={ref} className={cx("rb-field", className)} {...rest} />;
});
Field.displayName = "Field";

export interface ChoiceProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type">,
    RefAttributes<HTMLInputElement> {
  /** Optional label text; when set the control is wrapped in a .rb-choice row. */
  label?: ReactNode;
}

/** A checkbox/radio/switch control, optionally wrapped with its label. */
function ChoiceControl({ label, control }: { label?: ReactNode; control: ReactNode }) {
  if (label === undefined) return <>{control}</>;
  return (
    <label className="rb-choice">
      {control}
      {label}
    </label>
  );
}

export const Checkbox = forwardRef<HTMLInputElement, ChoiceProps>(function Checkbox(
  { label, className, ...rest },
  ref,
) {
  return (
    <ChoiceControl
      label={label}
      control={
        <input ref={ref} type="checkbox" className={cx("rb-checkbox", className)} {...rest} />
      }
    />
  );
});
Checkbox.displayName = "Checkbox";

export const Radio = forwardRef<HTMLInputElement, ChoiceProps>(function Radio(
  { label, className, ...rest },
  ref,
) {
  return (
    <ChoiceControl
      label={label}
      control={<input ref={ref} type="radio" className={cx("rb-radio", className)} {...rest} />}
    />
  );
});
Radio.displayName = "Radio";

export const Switch = forwardRef<HTMLInputElement, ChoiceProps>(function Switch(
  { label, className, ...rest },
  ref,
) {
  return (
    <ChoiceControl
      label={label}
      control={
        <input
          ref={ref}
          type="checkbox"
          role="switch"
          className={cx("rb-switch", className)}
          {...rest}
        />
      }
    />
  );
});
Switch.displayName = "Switch";
