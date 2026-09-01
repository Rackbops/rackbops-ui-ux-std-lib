import type { CSSProperties, HTMLAttributes } from "react";
import { Card } from "./Card.js";
import { Badge } from "./feedback.js";

export interface LinkUrl {
  label: string;
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
export interface LinksIndexProps extends HTMLAttributes<HTMLDivElement> {
  categories: LinkCategory[];
  links: LinkItem[];
}

// Structural inline layout only -- the card/badge surfaces + colour come from @rackbops/styles
// (rb-card/rb-badge + tokens), so this adds no @rackbops/styles classes and the theme contract is
// untouched. (Bare-tag heading typography still follows each theme's own base rules.)
const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(16rem, 1fr))",
  gap: "var(--rb-space-4)",
};
// Reset the url list structurally (no bullets/indent) so it renders the same under every theme --
// the themes don't all reset a bare `ul`.
const listStyle: CSSProperties = { listStyle: "none", margin: 0, padding: 0 };

// External = an http(s) or protocol-relative (`//host`) url -> opens in a new tab; anything else
// (relative, mailto:, tel:, ...) stays a plain in-page link.
const isExternal = (url: string): boolean => /^(https?:)?\/\//i.test(url);

function LinkCard({ link }: { link: LinkItem }) {
  return (
    <Card>
      <h3>
        {link.name}
        {link.monitored ? (
          <>
            {" "}
            <Badge variant="success">monitored</Badge>
          </>
        ) : null}
      </h3>
      {link.description ? <p>{link.description}</p> : null}
      <ul style={listStyle}>
        {link.urls.map((u) => (
          <li key={u.url}>
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

function Group({ label, items }: { label: string; items: LinkItem[] }) {
  return (
    <section>
      <h2>{label}</h2>
      <div style={gridStyle}>
        {items.map((link) => (
          <LinkCard key={link.name} link={link} />
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
export function LinksIndex({ categories, links, className, ...rest }: LinksIndexProps) {
  const known = new Set(categories.map((c) => c.id));
  const other = links.filter((l) => !known.has(l.category));

  return (
    <div className={className} {...rest}>
      {categories.map((cat) => {
        const items = links.filter((l) => l.category === cat.id);
        return items.length > 0 ? <Group key={cat.id} label={cat.label} items={items} /> : null;
      })}
      {other.length > 0 ? <Group label="Other" items={other} /> : null}
    </div>
  );
}
