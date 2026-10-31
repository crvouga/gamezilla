import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql, { bulk, join } from '@pkgs/sql-root-shared-ts/sql';
import type { DrainOutboxDeps } from './drain';

/** Events given a delivery per consumer in one pass. */
const DELIVERIES_PER_CONSUMER_PER_PASS = 200;

/** Select candidates together, then insert within the portable binding budget. */
export async function ensureDeliveries(
  tx: SqlTx,
  deps: DrainOutboxDeps
): Promise<void> {
  const consumers = deps.registry.all();
  if (consumers.length === 0) return;
  const nowIso = new Date(deps.clock.now()).toISOString();
  const subscriptions = join(
    consumers.map(
      (consumer) =>
        sql`SELECT ${consumer.on.type} AS type, ${consumer.id} AS consumer_id`
    ),
    ' UNION ALL '
  );
  const candidates = await tx.query(sql<{
    event_id: string;
    consumer_id: string;
    available_at: string;
  }>`
    SELECT e.id AS event_id, s.consumer_id,
           COALESCE(e.available_at, ${nowIso}) AS available_at
      FROM outbox_events e
      JOIN (${subscriptions}) s ON s.type = e.type
     WHERE e.deleted_at IS NULL
       ${deps.eventIds !== undefined && deps.eventIds.length > 0 ? sql`AND e.id IN (${join(deps.eventIds)})` : sql``}
       ${deps.causationIds === undefined ? sql`` : sql`AND e.causation_id IN (${join(deps.causationIds)})`}
       AND NOT EXISTS (
         SELECT 1
           FROM outbox_deliveries d
          WHERE d.event_id = e.id
            AND d.consumer_id = s.consumer_id
            AND d.deleted_at IS NULL
       )
     LIMIT ${DELIVERIES_PER_CONSUMER_PER_PASS * consumers.length}
  `);
  // Independent IDs prevent delimiter collisions and competing materializers
  // from conflicting on the primary key instead of the logical pair.
  // Ten bindings per row, within the lowest supported SQLite variable limit.
  for (let offset = 0; offset < candidates.length; offset += 99) {
    const values = candidates
      .slice(offset, offset + 99)
      .map((row) => [
        deps.createId(),
        row.event_id,
        row.consumer_id,
        0,
        row.available_at,
        null,
        null,
        nowIso,
        nowIso,
        null,
      ]);
    await tx.run(sql`
      INSERT INTO outbox_deliveries (
        id, event_id, consumer_id, attempts, available_at, processed_at,
        last_error, created_at, updated_at, deleted_at
      ) VALUES ${bulk(values)}
      ON CONFLICT (event_id, consumer_id) DO NOTHING
    `);
  }
}
