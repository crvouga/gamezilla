import sql, { join } from '@pkgs/sql-root-shared-ts/sql';
import type { DrainOutboxDeps } from './drain';

/**
 * Does this drain's scope contain work due at this read's clock cutoff?
 * Include both existing deliveries and events not yet materialized. A later
 * concurrent write or availability time belongs to a subsequent observation,
 * just as it does after an empty drain pass.
 */
export async function hasDueOutboxWork(
  args: Pick<
    DrainOutboxDeps,
    'db' | 'clock' | 'registry' | 'eventIds' | 'causationIds'
  >
): Promise<boolean> {
  const consumers = args.registry.all();
  if (
    consumers.length === 0 ||
    args.eventIds?.length === 0 ||
    args.causationIds?.length === 0
  )
    return false;
  const nowIso = new Date(args.clock.now()).toISOString();
  const subscriptions = join(
    consumers.map(
      (consumer) =>
        sql`SELECT ${consumer.on.type} AS type, ${consumer.id} AS consumer_id`
    ),
    ' UNION ALL '
  );
  // Existing deliveries use their retry time and consumer id, even if the
  // event disappeared or that consumer now subscribes to another event type.
  const rows = await args.db.query(sql<{ due_work: number }>`
    SELECT 1 AS due_work FROM outbox_deliveries d
    WHERE d.processed_at IS NULL AND d.deleted_at IS NULL
      AND d.available_at <= ${nowIso}
      AND d.consumer_id IN (${join(consumers.map((consumer) => consumer.id))})
      ${args.eventIds === undefined ? sql`` : sql`AND d.event_id IN (${join(args.eventIds)})`}
      ${args.causationIds === undefined ? sql`` : sql`AND d.event_id IN (SELECT id FROM outbox_events WHERE causation_id IN (${join(args.causationIds)}))`}
    UNION ALL
    SELECT 1 AS due_work FROM outbox_events e
    JOIN (${subscriptions}) s ON s.type = e.type
    WHERE e.deleted_at IS NULL
      AND (e.available_at IS NULL OR e.available_at <= ${nowIso})
      ${args.eventIds === undefined ? sql`` : sql`AND e.id IN (${join(args.eventIds)})`}
      ${args.causationIds === undefined ? sql`` : sql`AND e.causation_id IN (${join(args.causationIds)})`}
      AND NOT EXISTS (
        SELECT 1 FROM outbox_deliveries d
        WHERE d.event_id = e.id AND d.consumer_id = s.consumer_id
          AND d.deleted_at IS NULL
      )
    LIMIT 1
  `);
  return rows.length > 0;
}
