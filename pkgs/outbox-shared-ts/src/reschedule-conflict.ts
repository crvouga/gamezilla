import { retryConflictingTransaction } from '@pkgs/sql-client-root-shared-ts/conflict-retry';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { resolveRetryPolicy } from './define-consumer';
import type { ClaimRow } from './delivery-claim';
import type { DrainOutboxDeps } from './drain';

/** The failed delivery has rolled back; only its retry record runs again here. */
export async function rescheduleConflict(
  deps: DrainOutboxDeps,
  claim: ClaimRow,
  error: unknown
): Promise<void> {
  const consumer = deps.registry.get(claim.consumer_id);
  if (consumer === undefined) throw error;
  const policy = resolveRetryPolicy(consumer);
  const delay =
    policy.backoffMs[
      Math.max(0, Math.min(claim.attempts - 1, policy.backoffMs.length - 1))
    ] ?? 60_000;
  const message = error instanceof Error ? error.message : String(error);
  await retryConflictingTransaction(deps.db, (tx) => {
    const now = deps.clock.now();
    return tx.run(sql`
        UPDATE outbox_deliveries
           SET available_at = ${new Date(now + delay).toISOString()},
               last_error = ${message}
         WHERE event_id = ${claim.event_id} AND consumer_id = ${claim.consumer_id}
           AND attempts = ${claim.attempts} AND processed_at IS NULL
           AND deleted_at IS NULL
           AND available_at <= ${new Date(now).toISOString()}
      `);
  });
}
