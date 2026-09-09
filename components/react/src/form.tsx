import {
  createElement,
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactNode,
  type RefAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cx } from "./cx.js";

/** A forwardRef DOM wrapper that only adds a base rb-* class -- Input, Textarea, Select, Label, Field. */
function styled<E extends HTMLElement, P extends { className?: string }>(tag: string, cls: string) {
  return forwardRef<E, P>(function Styled({ className, ...rest }, ref) {
    return createElement(tag, { ref, className: cx(cls, className), ...rest });
  });
}

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    RefAttributes<HTMLInputElement> {}
export const Input = styled<HTMLInputElement, InputProps>("input", "rb-input");
Input.displayName = "Input";

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    RefAttributes<HTMLTextAreaElement> {}
export const Textarea = styled<HTMLTextAreaElement, TextareaProps>("textarea", "rb-textarea");
Textarea.displayName = "Textarea";

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    RefAttributes<HTMLSelectElement> {}
export const Select = styled<HTMLSelectElement, SelectProps>("select", "rb-select");
Select.displayName = "Select";

export interface LabelProps
  extends LabelHTMLAttributes<HTMLLabelElement>,
    RefAttributes<HTMLLabelElement> {}
export const Label = styled<HTMLLabelElement, LabelProps>("label", "rb-label");
Label.displayName = "Label";

export interface FieldProps
  extends HTMLAttributes<HTMLDivElement>,
    RefAttributes<HTMLDivElement> {}
export const Field = styled<HTMLDivElement, FieldProps>("div", "rb-field");
Field.displayName = "Field";

export interface ChoiceProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type">,
    RefAttributes<HTMLInputElement> {
  /** Optional label text; when set the control is wrapped in a .rb-choice row. */
  label?: ReactNode;
  /** Styles the .rb-choice row itself (e.g. margins, flex alignment) -- `className` still styles the control. Only used when `label` is set. */
  wrapperClassName?: string;
  /** Styles the .rb-choice row itself; `style` still styles the control. Only used when `label` is set. */
  wrapperStyle?: CSSProperties;
}

/** A checkbox/radio/switch control, optionally wrapped with its label. */
function ChoiceControl({
  label,
  control,
  wrapperClassName,
  wrapperStyle,
}: {
  label?: ReactNode;
  control: ReactNode;
  wrapperClassName?: string;
  wrapperStyle?: CSSProperties;
}) {
  if (label === undefined) return <>{control}</>;
  return (
    <label className={cx("rb-choice", wrapperClassName)} style={wrapperStyle}>
      {control}
      {label}
    </label>
  );
}

/** A Checkbox/Radio/Switch factory: wraps an `<input>` carrying its fixed `type`/`role` in ChoiceControl. */
function choiceControl(
  displayName: string,
  cls: string,
  attrs: Pick<InputHTMLAttributes<HTMLInputElement>, "type" | "role">,
) {
  const Component = forwardRef<HTMLInputElement, ChoiceProps>(function Choice(
    { label, className, wrapperClassName, wrapperStyle, ...rest },
    ref,
  ) {
    return (
      <ChoiceControl
        label={label}
        wrapperClassName={wrapperClassName}
        wrapperStyle={wrapperStyle}
        control={<input ref={ref} {...attrs} className={cx(cls, className)} {...rest} />}
      />
    );
  });
  Component.displayName = displayName;
  return Component;
}

export const Checkbox = choiceControl("Checkbox", "rb-checkbox", { type: "checkbox" });
export const Radio = choiceControl("Radio", "rb-radio", { type: "radio" });
export const Switch = choiceControl("Switch", "rb-switch", { type: "checkbox", role: "switch" });
