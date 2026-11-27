import type { MutationSettlement, MutationVerdict } from './mutation-status';
import {
  mutationSettlementQuery,
  readMutationSettlement,
  settlementFromRow,
} from './mutation-status';
import type { SyncEngine } from './sync-engine-port';

/**
 * Settle on the server's verdict for `mutationId`: re-check whenever its
 * queue row or its rejection changes (the upload queue writes one of them
 * when a verdict lands). Backs `pendingUx: 'pending'` mutations.
 *
 * A rejected optimistic write settles once the device holds the server's rows again.
 * The local apply's optimistic write outlives its rejection until the next
 * merge, and a caller told "rejected" acts next on what the device shows:
 * a retry checked locally against that write (a cooldown it started, a
 * value it claimed) was refused for a write the server had just refused.
 */
export async function awaitMutationVerdict(
  engine: Pick<SyncEngine, 'db' | 'watch' | 'refreshQueries'>,
  mutationId: string
): Promise<MutationVerdict> {
  const { verdict, needsRepair } = await waitForSettlement(engine, mutationId);
  if (needsRepair) await engine.refreshQueries();
  return verdict;
}

async function waitForSettlement(
  engine: Pick<SyncEngine, 'db' | 'watch'>,
  mutationId: string
): Promise<MutationSettlement> {
  const initial = await readMutationSettlement(engine.db, mutationId);
  if (initial.verdict.status !== 'pending') return initial;
  const watch = engine.watch(mutationSettlementQuery(mutationId));
  const finished = Promise.withResolvers<MutationSettlement>();
  const check = () => {
    const row = watch.getSnapshot()[0];
    if (row === undefined) return;
    const settlement = settlementFromRow(row);
    if (settlement.verdict.status !== 'pending') finished.resolve(settlement);
  };
  const unsubscribe = watch.subscribe(check);
  try {
    // The first snapshot covers a retirement that raced subscription.
    check();
    return await finished.promise;
  } finally {
    unsubscribe();
  }
}
