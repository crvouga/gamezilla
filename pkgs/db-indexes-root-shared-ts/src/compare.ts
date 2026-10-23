import { assert } from '@pkgs/assert-root-shared-ts/singleton';

/**
 * Locale-stable ASCII/byte-wise name compare for deterministic plans.
 * Never use bare localeCompare() — env locale can reorder non-ASCII.
 */
export function compareNames(a: string, b: string): number {
  assert.ok(typeof a === 'string', 'compareNames: a must be string');
  assert.ok(typeof b === 'string', 'compareNames: b must be string');
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function sortByName<T extends { readonly name: string }>(
  items: readonly T[]
): T[] {
  assert.ok(Array.isArray(items), 'sortByName: items array');
  return [...items].sort((x, y) => compareNames(x.name, y.name));
}

export function compareSkipped(
  a: {
    readonly reason: string;
    readonly candidateName?: string;
    readonly queryName?: string;
  },
  b: {
    readonly reason: string;
    readonly candidateName?: string;
    readonly queryName?: string;
  }
): number {
  const r = compareNames(a.reason, b.reason);
  if (r !== 0) return r;
  const ca = a.candidateName ?? '';
  const cb = b.candidateName ?? '';
  const c = compareNames(ca, cb);
  if (c !== 0) return c;
  return compareNames(a.queryName ?? '', b.queryName ?? '');
}
