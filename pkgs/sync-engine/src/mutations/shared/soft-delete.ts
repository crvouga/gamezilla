import { ident, sql } from '@pkgs/sql';

import type { MutationDb } from '../core/types';

/** Live-row predicate for domain SELECTs (`_deleted_at IS NULL`). */
export const LIVE_ROW_SQL = sql`_deleted_at IS NULL`;

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
    SET _deleted_at = ${now}
    WHERE id = ${id} AND _deleted_at IS NULL
  `);
}
