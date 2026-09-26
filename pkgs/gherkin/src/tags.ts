/** Tag expressions (`@a and not @b`), the official grammar. */

import parseTagExpression from '@cucumber/tag-expressions';

export type TagFilter = (tags: readonly string[]) => boolean;

/** `undefined` / blank expression selects everything. */
export function tagFilter(expression: string | undefined): TagFilter {
  const text = expression?.trim() ?? '';
  if (text.length === 0) return () => true;
  const parsed = parseTagExpression(text);
  return (tags) => parsed.evaluate([...tags]);
}

export const DOMAIN_TAG = '@domain:';
export const GOAL_TAG = '@goal:';

export function domainOf(tags: readonly string[]): string | null {
  const tag = tags.find((t) => t.startsWith(DOMAIN_TAG));
  return tag === undefined ? null : tag.slice(DOMAIN_TAG.length);
}

export function goalsOf(tags: readonly string[]): readonly string[] {
  return tags
    .filter((t) => t.startsWith(GOAL_TAG))
    .map((t) => t.slice(GOAL_TAG.length));
}
