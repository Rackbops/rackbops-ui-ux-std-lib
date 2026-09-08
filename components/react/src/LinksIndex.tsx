import {
  forwardRef,
  type CSSProperties,
  type HTMLAttributes,
  type JSX,
  type RefAttributes,
} from "react";
import { Card } from "./Card.js";
import { Badge } from "./feedback.js";

export interface LinkUrl {
  label: string;
  /**
   * Rendered as-is in an <a href> -- consumer-authored/trusted data (the app/site URLs you
   * configure), not sanitized against `javascript:`-style schemes. Don't feed this untrusted
   * input without validating the scheme first.
   */
  url: string;
}
export interface LinkCategory {
  id: string;
  label: string;
}
export interface LinkItem {
  /** Also used as the React list key -- app/site names are unique. */
  name: string;
  urls: LinkUrl[];
  description?: string;
  /** Matches a LinkCategory.id; anything unlisted falls into an "Other" group. */
  category: string;
  host?: string;
  monitored?: boolean;
}
export interface LinksIndexProps
  extends HTMLAttributes<HTMLDivElement>,
    RefAttributes<HTMLDivElement> {
  categories: LinkCategory[];
  links: LinkItem[];
  /**
   * Heading level for each category label; each card's own heading renders one level deeper
   * (clamped to h6). Set this to match whatever heading LinksIndex is embedded under, so
   * heading order stays sequential instead of skipping or repeating a level. Defaults to 2.
   */
  level?: 2 | 3 | 4 | 5 | 6;
}

// Structural inline layout only -- the card/badge surfaces + colour come from @rackbops/styles
// (rb-card/rb-badge + tokens), so this adds no @rackbops/styles classes and the theme contract is
// untouched. (Bare-tag heading typography still follows each theme's own base rules.)
const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))",
  gap: "var(--rb-space-4)",
};
// Reset the url list structurally (no bullets/indent) -- this is a link-nav list, not prose, so it
// deliberately opts out of the themes' bare `ul` treatment (disc markers + indent) rather than
// working around an inconsistency between them.
const listStyle: CSSProperties = { listStyle: "none", margin: 0, padding: 0 };

// External = an http(s) or protocol-relative (`//host`) url -> opens in a new tab; anything else
// (relative, mailto:, tel:, ...) stays a plain in-page link.
const isExternal = (url: string): boolean => /^(https?:)?\/\//i.test(url);

function LinkCard({ link, level }: { link: LinkItem; level: 2 | 3 | 4 | 5 | 6 }) {
  const Heading = `h${level}` as keyof JSX.IntrinsicElements;
  return (
    <Card>
      <Heading>
        {link.name}
        {link.monitored ? (
          <>
            {" "}
            <Badge variant="success">monitored</Badge>
          </>
        ) : null}
      </Heading>
      {link.description ? <p>{link.description}</p> : null}
      <ul style={listStyle}>
        {link.urls.map((u) => (
          // Two urls on one link can share a `url` with different `label`s ("prod" /
          // "canonical") -- key on the pair, not the url alone, so they don't collide.
          <li key={`${u.label}::${u.url}`}>
            {isExternal(u.url) ? (
              <a href={u.url} target="_blank" rel="noreferrer noopener">
                {u.label}
              </a>
            ) : (
              <a href={u.url}>{u.label}</a>
            )}
          </li>
        ))}
      </ul>
      {link.host ? <p>{link.host}</p> : null}
    </Card>
  );
}

function Group({
  label,
  items,
  level,
}: {
  label: string;
  items: LinkItem[];
  level: 2 | 3 | 4 | 5 | 6;
}) {
  const Heading = `h${level}` as keyof JSX.IntrinsicElements;
  const cardLevel = (level < 6 ? level + 1 : 6) as 2 | 3 | 4 | 5 | 6;
  return (
    <section>
      <Heading>{label}</Heading>
      <div style={gridStyle}>
        {items.map((link) => (
          <LinkCard key={link.name} link={link} level={cardLevel} />
        ))}
      </div>
    </section>
  );
}

/**
 * A generic, data-driven grouped index of apps/sites. Iterates `categories` in order, each a group
 * of `rb-card`s; links whose `category` is not listed collect into a trailing "Other" group. No
 * router assumed -- external URLs open in a new tab. Themed by the consumer's `data-rb-style`.
 */
export const LinksIndex = forwardRef<HTMLDivElement, LinksIndexProps>(function LinksIndex(
  { categories, links, className, level = 2, ...rest },
  ref,
) {
  const known = new Set(categories.map((c) => c.id));
  const other = links.filter((l) => !known.has(l.category));

  return (
    <div ref={ref} className={className} {...rest}>
      {categories.map((cat) => {
        const items = links.filter((l) => l.category === cat.id);
        return items.length > 0 ? (
          <Group key={cat.id} label={cat.label} items={items} level={level} />
        ) : null;
      })}
      {other.length > 0 ? <Group label="Other" items={other} level={level} /> : null}
    </div>
  );
});
LinksIndex.displayName = "LinksIndex";
