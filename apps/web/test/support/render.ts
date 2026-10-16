import type { ReactElement } from 'react';
import { renderToString } from 'react-dom/server';

/** renderToString without React's `<!-- -->` text separators, so assertions can read the visible text. */
export function render(element: ReactElement): string {
  return renderToString(element).replace(/<!-- -->/g, '');
}

/** The visible text of rendered markup (tags removed, whitespace collapsed). */
export function visibleText(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Anchor {
  href: string | undefined;
  text: string;
  attrs: string;
}

/** Every <a> of the markup, independent of the attribute order React happens to render. */
export function anchors(html: string): Anchor[] {
  return [...html.matchAll(/<a\b([^>]*)>(.*?)<\/a>/g)].map((match) => ({
    href: /\bhref="([^"]*)"/.exec(match[1] ?? '')?.[1],
    text: visibleText(match[2] ?? ''),
    attrs: match[1] ?? '',
  }));
}
