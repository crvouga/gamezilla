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

/** The last action queued before the trouble began (`0`: none). */
export async function lastQueuedSeq(
  db: SqlClient,
  clientId: string
): Promise<number> {
  const rows = await db.query(sql<{ seq: number }>`
    SELECT COALESCE(MAX(seq), 0) AS seq FROM sync_engine_mutations
    WHERE client_id = ${clientId}
  `);
  return Number(rows[0]?.seq ?? 0);
}

/**
 * Refuse the queued online-only actions taken after `afterSeq` with
 * {@link OFFLINE_REFUSAL}.
 *
 * An online-only action taken during a hiccup is accepted, because a hiccup
 * is not being offline. When the hiccup turns out to be a lost connection,
 * that action was in fact tried offline: it gets the offline verdict now and
 * never goes out later on its own. One taken before the trouble began was
 * sent while the connection worked; it keeps waiting for the server's verdict.
 */
// regression: online-only-action-accepted-in-hiccup-never-settles
export async function refuseQueuedOnlineOnly(args: {
  readonly db: SqlClient;
  readonly bus: TableChangeBus;
  readonly registry: MutationRegistry;
  readonly clientId: string;
  readonly now: () => number;
  /** The last action queued before the trouble began; it and earlier ones keep waiting. */
  readonly afterSeq: number;
}): Promise<void> {
  const queued = await args.db.query(sql<{ id: string; name: string }>`
    SELECT id, name FROM sync_engine_mutations
    WHERE client_id = ${args.clientId}
      AND deleted_at IS NULL
      AND seq > ${args.afterSeq}
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

/**
 * Online-only actions across a lost connection: when the trouble begins it
 * records the last action already queued; when the connection proves lost the
 * ones taken after it (while a hiccup looked like one) get the offline
 * verdict instead of waiting for a server that cannot answer. Their local
 * effect is repaired by the next sweep that reaches the server, as for any
 * refused write.
 */
export function createOnlineOnlyRefusal(
  engine: {
    readonly db: SqlClient;
    readonly mutationRegistry: MutationRegistry;
    readonly getClientId: () => string;
    readonly now: () => number;
  },
  bus: TableChangeBus,
  onError: (error: unknown) => void
): { readonly troubleBegan: () => void; readonly lost: () => void } {
  let before: Promise<number> = Promise.resolve(0);
  return {
    troubleBegan: () => {
      // Unread, nothing counts as taken during the trouble: none is refused.
      before = lastQueuedSeq(engine.db, engine.getClientId()).catch(
        (error: unknown) => {
          onError(error);
          return Number.POSITIVE_INFINITY;
        }
      );
    },
    lost: () => {
      void before
        .then((afterSeq) =>
          refuseQueuedOnlineOnly({
            db: engine.db,
            bus,
            registry: engine.mutationRegistry,
            clientId: engine.getClientId(),
            now: engine.now,
            afterSeq,
          })
        )
        .catch(onError);
    },
  };
}
