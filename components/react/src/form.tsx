import type {
  HTMLAttributes,
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx.js";

export type InputProps = InputHTMLAttributes<HTMLInputElement>;
export function Input({ className, ...rest }: InputProps) {
  return <input className={cx("rb-input", className)} {...rest} />;
}

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;
export function Textarea({ className, ...rest }: TextareaProps) {
  return <textarea className={cx("rb-textarea", className)} {...rest} />;
}

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;
export function Select({ className, ...rest }: SelectProps) {
  return <select className={cx("rb-select", className)} {...rest} />;
}

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;
export function Label({ className, ...rest }: LabelProps) {
  return <label className={cx("rb-label", className)} {...rest} />;
}

export function Field({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rb-field", className)} {...rest} />;
}

export interface ChoiceProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
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

export function Checkbox({ label, className, ...rest }: ChoiceProps) {
  return (
    <ChoiceControl
      label={label}
      control={<input type="checkbox" className={cx("rb-checkbox", className)} {...rest} />}
    />
  );
}

export function Radio({ label, className, ...rest }: ChoiceProps) {
  return (
    <ChoiceControl
      label={label}
      control={<input type="radio" className={cx("rb-radio", className)} {...rest} />}
    />
  );
}

export function Switch({ label, className, ...rest }: ChoiceProps) {
  return (
    <ChoiceControl
      label={label}
      control={
        <input type="checkbox" role="switch" className={cx("rb-switch", className)} {...rest} />
      }
    />
  );
}
