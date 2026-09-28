/**
 * The people a store knows of, and the small set algebra the projections
 * share. A person is anyone the store holds a live user or profile row for,
 * plus anyone a live row of the model names (a device keeps only its own
 * user row, but knows its friends and the hosts of spaces it sees by id).
 */

import type { Names } from '@libs/harness/alloy/snapshot-worlds';
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

export type Pair = readonly [string, string];

/** Live user and profile ids: tombstoned rows are not in the product world. */
export async function storedPeople(db: SqlTx): Promise<readonly string[]> {
  const rows = await db.query(sql<{ readonly id: string }>`
    SELECT id FROM auth_users WHERE deleted_at IS NULL
    UNION
    SELECT id FROM profile WHERE deleted_at IS NULL`);
  return rows.map((row) => row.id);
}

/** Distinct, sorted: a snapshot is a set, and reports read the same every run. */
export function sortedSet(values: Iterable<string>): string[] {
  return [...new Set(values)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function sortedPairs(pairs: Iterable<Pair>): Pair[] {
  const byKey = new Map<string, Pair>();
  for (const pair of pairs) byKey.set(JSON.stringify(pair), pair);
  return [...byKey.keys()].sort().map((key) => byKey.get(key) as Pair);
}

/** Both directions of each stored (unordered) pair. */
export function bothWays(pairs: readonly Pair[]): Pair[] {
  return pairs.flatMap(([a, b]) => [[a, b] as const, [b, a] as const]);
}

export function named(pairs: readonly Pair[], names: Names): Pair[] {
  return sortedPairs(pairs.map(([a, b]) => [names(a), names(b)] as const));
}
