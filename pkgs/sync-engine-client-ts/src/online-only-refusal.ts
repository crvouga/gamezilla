import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { storeRejection } from './mutation-upload-queue';
import type { TableChangeBus } from './table-change-bus';

/** The verdict an online-only action gets without a connection. */
export const OFFLINE_REFUSAL = {
  code: 'OFFLINE',
  message: 'This action needs a connection.',
} as const;

/**
 * Refuse every queued online-only action with {@link OFFLINE_REFUSAL}.
 *
 * An online-only action taken during a hiccup is accepted, because a hiccup
 * is not being offline. When the hiccup turns out to be a lost connection,
 * that action was in fact tried offline: it gets the offline verdict now and
 * never goes out later on its own.
 */
// regression: online-only-action-accepted-in-hiccup-never-settles
export async function refuseQueuedOnlineOnly(args: {
  readonly db: SqlClient;
  readonly bus: TableChangeBus;
  readonly registry: MutationRegistry;
  readonly clientId: string;
  readonly now: () => number;
}): Promise<void> {
  const queued = await args.db.query(sql<{ id: string; name: string }>`
    SELECT id, name FROM sync_engine_mutations
    WHERE client_id = ${args.clientId}
      AND deleted_at IS NULL
  `);
  const refused = queued.filter(
    (row) => args.registry[row.name]?.requiresOnline === true
  );
  if (refused.length === 0) return;
  const nowIso = new Date(args.now()).toISOString();
  await args.db.transaction(async (tx) => {
    for (const row of refused) {
      await storeRejection(
        tx,
        args.clientId,
        { status: 'rejected', mutationId: row.id, ...OFFLINE_REFUSAL },
        nowIso
      );
      await tx.run(sql`
        UPDATE sync_engine_mutations
        SET deleted_at = ${nowIso}, updated_at = ${nowIso}
        WHERE id = ${row.id}
          AND deleted_at IS NULL
      `);
    }
  });
  args.bus.emit(['sync_engine_mutations', 'sync_engine_write_rejections']);
}
