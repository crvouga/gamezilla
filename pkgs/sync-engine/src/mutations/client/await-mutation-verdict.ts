import { sql } from '@pkgs/sql';

import type { SyncEngine } from '../../client/sync-engine-port';
import { type MutationVerdict, mutationVerdict } from './mutation-status';

/**
 * Settle on the server's verdict for `mutationId`: re-check whenever its
 * queue row or its rejection changes (the upload queue writes one of them
 * when a verdict lands). Backs `pendingUx: 'pending'` mutations.
 */
export function awaitMutationVerdict(
  engine: Pick<SyncEngine, 'db' | 'watch'>,
  mutationId: string
): Promise<MutationVerdict> {
  return new Promise((resolve, reject) => {
    // `deleted_at` is selected because a watch fires only when its rows
    // change: a confirmed upload soft-deletes the queue row in place.
    const watch = engine.watch(sql<{ id: string; deleted_at: string | null }>`
      SELECT id, deleted_at FROM sync_engine_mutations WHERE id = ${mutationId}
      UNION ALL
      SELECT id, deleted_at FROM sync_engine_write_rejections
      WHERE mutation_id = ${mutationId}
    `);
    let settled = false;
    let unsubscribe: () => void = () => undefined;
    const check = (): void => {
      void mutationVerdict(engine.db, mutationId).then(
        (verdict) => {
          if (settled || verdict.status === 'pending') return;
          settled = true;
          unsubscribe();
          resolve(verdict);
        },
        (error: unknown) => {
          if (settled) return;
          settled = true;
          unsubscribe();
          reject(error);
        }
      );
    };
    unsubscribe = watch.subscribe(check);
    check();
  });
}
