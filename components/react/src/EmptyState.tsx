import { createElement, forwardRef, type ReactNode, type RefAttributes } from "react";
import { Card, type CardProps } from "./Card.js";

const VALID_LEVELS = [2, 3, 4] as const;

export interface EmptyStateProps extends Omit<CardProps, "title">, RefAttributes<HTMLDivElement> {
  /**
   * A heading naming what is missing ("No cards yet", "Select a panel"), replacing the native
   * HTML `title` tooltip attribute -- there's no way to set a real tooltip through this
   * component (same trade-off as `Alert`/`Dialog`'s `title`). Required and typed
   * `NonNullable<ReactNode>` (not plain `ReactNode`) so passing an optional value straight
   * through (`title={label}` where `label?: string`) is a compile error rather than a silently
   * empty, unlabelled heading inside the `role="status"` region -- the one thing this component
   * exists to avoid. An explicit `false` or `""` still compiles (same as anywhere else `ReactNode`
   * is accepted) and is the caller's responsibility, same as passing empty `children` anywhere
   * else in this library.
   */
  title: NonNullable<ReactNode>;
  /** Optional call to action -- a Button or a link -- rendered after the guidance. */
  action?: ReactNode;
  /** Heading level for `title`; default 3. Falls back to 3 for a value outside 2-4 reached
   * through an untyped caller or a cast, so a bad value degrades to a real heading instead of an
   * invalid tag name. */
  level?: 2 | 3 | 4;
}

/**
 * An empty-guidance surface: a Card with `role="status"` holding a heading, optional guidance
 * (`children`) and an optional action. It never renders a spinner or progress indicator -- an
 * empty state is a fact stated in words, so "still loading" and "genuinely empty" are never
 * shown the same way as a stalled spinner. Composes `Card` and adds no class of its own (the
 * LinksIndex precedent); first consumer Rackbops/artifact-console#45.
 *
 * `role="status"` is a live region: like any live region it does not announce on first paint
 * (a page that renders straight into several empty panels announces nothing), and it is meant
 * for a state that appears or changes after mount (content loading in, then coming back empty),
 * not for text that changes on every keystroke -- reusing one instance for a live search query
 * would re-announce the whole card, action button included, on every character.
 */
export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(function EmptyState(
  { title, action, level = 3, children, ...rest },
  ref,
) {
  const heading = `h${VALID_LEVELS.includes(level) ? level : 3}`;
  return (
    <Card ref={ref} role="status" {...rest}>
      {createElement(heading, null, title)}
      {children}
      {action}
    </Card>
  );
});
EmptyState.displayName = "EmptyState";
