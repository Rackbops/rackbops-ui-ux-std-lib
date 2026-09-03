import { forwardRef, type OlHTMLAttributes, type ReactNode, type RefAttributes } from "react";
import { cx } from "./cx.js";

export interface StepperStep {
  /** Also used as the React list key. */
  id: string;
  label: ReactNode;
  /** Shown for the current/upcoming states; a complete step always shows the
   * built-in checkmark instead, regardless of this. */
  icon?: ReactNode;
}

export interface StepperProps
  extends OlHTMLAttributes<HTMLOListElement>,
    RefAttributes<HTMLOListElement> {
  steps: StepperStep[];
  /** 0-based index of the current step; steps before it read complete, after
   * it read upcoming. Drives each step's state -- and, through it, the
   * connector segment leading into that step -- there is no separate
   * progress-percentage prop to keep in sync with `current`. */
  current: number;
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12.5 9.5 18 20 6"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A delivery/milestone stepper (.rb-stepper): renders one <li> per step, each
 * classed .rb-stepper--complete/--current/--upcoming derived from `current` --
 * callers never compute step state themselves. Each step's own class also
 * drives the connector segment leading into it (CSS: `.rb-stepper__step:not(
 * :first-child).rb-stepper--complete/--current::before`), so the rail fill
 * and the step states can never drift out of sync with each other.
 */
export const Stepper = forwardRef<HTMLOListElement, StepperProps>(function Stepper(
  { steps, current, className, ...rest },
  ref,
) {
  return (
    <ol ref={ref} className={cx("rb-stepper", className)} {...rest}>
      {steps.map((step, i) => {
        const state = i < current ? "complete" : i === current ? "current" : "upcoming";
        return (
          <li
            key={step.id}
            className={cx("rb-stepper__step", `rb-stepper--${state}`)}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="rb-stepper__node">
              {state === "complete" ? <CheckIcon /> : (step.icon ?? i + 1)}
            </span>
            <span className="rb-stepper__label">{step.label}</span>
          </li>
        );
      })}
    </ol>
  );
});
Stepper.displayName = "Stepper";
