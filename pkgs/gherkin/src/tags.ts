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

/**
 * A standing promise that is safe to run against a deployed environment.
 * The tag is the whole selector: it names no environment, schedule or host.
 */
export const SYNTHETIC_TAG = '@synthetic';

export function domainOf(tags: readonly string[]): string | null {
  const tag = tags.find((t) => t.startsWith(DOMAIN_TAG));
  return tag === undefined ? null : tag.slice(DOMAIN_TAG.length);
}

/** True when the feature line (before `Feature:`) carries `@synthetic`. */
export function isSyntheticFeatureSource(text: string): boolean {
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('Feature:') || line.startsWith('Feature :')) {
      return false;
    }
    if (!line.startsWith('@')) continue;
    if (line.split(/\s+/).includes(SYNTHETIC_TAG)) return true;
  }
  return false;
}
