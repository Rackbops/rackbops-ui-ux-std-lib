import { createElement, forwardRef, type HTMLAttributes, type ReactNode, type RefAttributes } from "react";
import { Card } from "./Card.js";

export interface EmptyStateProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title">,
    RefAttributes<HTMLDivElement> {
  /** A heading naming what is missing ("No cards yet", "Select a panel"). */
  title: ReactNode;
  /** Optional call to action -- a Button or a link -- rendered after the guidance. */
  action?: ReactNode;
  /** Heading level for `title`; default 3. Match wherever the component is embedded, as
   * LinksIndex's `level` does. */
  level?: 2 | 3 | 4;
}

/**
 * An empty-guidance surface: a Card with `role="status"` holding a heading, optional guidance
 * (`children`) and an optional action. It never renders a spinner or progress indicator -- an
 * empty state is a fact stated in words, so "still loading" and "genuinely empty" are never
 * shown the same way as a stalled spinner. Composes `Card` and adds no class of its own (the
 * LinksIndex precedent); first consumer Rackbops/artifact-console#45.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { title, action, level = 3, children, ...rest },
  ref,
) {
  return (
    <Card ref={ref} role="status" {...rest}>
      {createElement(`h${level}`, null, title)}
      {children}
      {action}
    </Card>
  );
});
EmptyState.displayName = "EmptyState";
