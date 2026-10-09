import sql, { join } from '@pkgs/sql-root-shared/sql';
import type {
  MutationFeedback,
  MutationFeedbackScope,
} from './mutation-status';
import type { SyncEngine, WatchSubscription } from './sync-engine-port';

/** The queue retains completed choices, so feedback survives route and app reopening. */
export function watchMutationFeedback(
  watch: SyncEngine['watch'],
  clientId: string,
  mutationName: string,
  scope: MutationFeedbackScope = {}
): WatchSubscription<readonly MutationFeedback[]> {
  const fields = Object.entries(scope).map(([key, value]) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key))
      throw new Error('Mutation feedback scope must name an argument field');
    return sql`json_extract(args, ${`$.${key}`}) = ${value}`;
  });
  const matches = fields.length === 0 ? sql`1 = 1` : join(fields, ' AND ');
  return watch(sql<MutationFeedback>`
    SELECT m.id AS "mutationId",
      CASE WHEN m.deleted_at IS NULL THEN 'pending'
        WHEN r.id IS NOT NULL THEN 'rejected' ELSE 'confirmed' END AS status,
      r.id AS "rejectionId", r.code, r.message
    FROM (
      SELECT id, client_id, deleted_at
      FROM sync_engine_mutations
      WHERE client_id = ${clientId} AND name = ${mutationName}
        AND ${matches}
      ORDER BY seq DESC
      LIMIT 1
    ) AS m
    LEFT JOIN sync_engine_write_rejections AS r
      ON r.mutation_id = m.id AND r.client_id = m.client_id
      AND r.deleted_at IS NULL
    WHERE r.id IS NULL OR r.acknowledged = ${0}
  `);
}
