import sql, { ident } from '@pkgs/sql-root-shared-ts/sql';

import type { MutationDb } from './mutations-types';

/** Live-row predicate for domain SELECTs (`deleted_at IS NULL`). */
export const LIVE_ROW_SQL = sql`deleted_at IS NULL`;

/**
 * Soft-tombstone one domain row by primary `id`.
 * Domain mutations must use this (or equivalent UPDATE) — never `DELETE FROM`.
 */
export async function softDeleteById(
  tx: MutationDb,
  table: string,
  id: string,
  now: string
): Promise<void> {
  await tx.run(sql`
    UPDATE ${ident(table)}
    SET deleted_at = ${now}
    WHERE id = ${id} AND deleted_at IS NULL
  `);
}
