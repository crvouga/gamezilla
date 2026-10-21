/**
 * Block versus inline boxes: a block's text is its own word run, so names and
 * visible labels put a space around it (AccName 1.2 § 4.3.2 step 2F).
 */

import { tagOf } from './roles';

const BLOCK_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'section',
  'table',
  'td',
  'th',
  'tr',
  'ul',
]);

/** Laid out as a block: its computed `display`, else its tag's default. */
export function isBlock(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  const display = view?.getComputedStyle(element).display ?? '';
  if (display.length > 0) {
    return !display.startsWith('inline') && display !== 'contents';
  }
  return BLOCK_TAGS.has(tagOf(element));
}
