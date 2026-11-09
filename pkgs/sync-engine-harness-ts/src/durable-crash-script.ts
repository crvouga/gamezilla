/**
 * One fixed day of offline use that crosses every durable step of the client
 * sync path: first open (local schema reconcile, scope bookkeeping, snapshot
 * apply), writes while offline (apply + queue insert), the upload drain
 * (acknowledge + retire), a peer's change merged under pending writes
 * (merge upsert + rebase), a cleared cache (wipe + re-apply), and an app
 * update that bumps the local schema epoch (migration + re-apply).
 *
 * Every step that drives `alice` tolerates her process dying under it: once
 * she is dead, later steps of hers are skipped, exactly as a person whose
 * app died stops using it until they reopen it.
 */

import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { SCHEMA_EPOCH } from '@pkgs/sync-engine-client-ts/local-schema';
import {
  clientAlive,
  diedAtBoundary,
  durableAppend,
  type StoredWork,
  storedWork,
} from './durable-crash-actions';
import { setNote } from './mutations';
import { addClient, clearLocalData, mutate } from './regression-actions';
import {
  partition,
  restart,
  resumeNetwork,
} from './regression-random-faults-actions';
import type { SyncHarness } from './scenario-system';

export const LEDGER = 'ledger';
export const ALICE = 'alice';
export const BOB = 'bob';
const SETTLE_MS = 20_000;

/** Run `step` for alice while she is alive; her dying under it is not an error. */
async function aliceStep(
  s: Run<SyncHarness>,
  step: () => Promise<void>
): Promise<void> {
  if (!(await s.read(clientAlive, ALICE))) return;
  try {
    await step();
  } catch (error) {
    if (await s.read(diedAtBoundary, ALICE)) return;
    throw error;
  }
}

/** Wait until alice shows/queues what `pred` wants, or until she has died. */
async function aliceSees(
  s: Run<SyncHarness>,
  pred: (work: StoredWork) => boolean
): Promise<void> {
  await aliceStep(s, async () => {
    await s.until(
      async (h) => ({
        alive: clientAlive(h, ALICE),
        work: await storedWork(h, ALICE, LEDGER),
      }),
      {
        maxMs: SETTLE_MS,
        pred: (v) => !v.alive || pred(v.work),
      }
    );
  });
}

/** The note shows every token in `tokens` and nothing waits to upload. */
const settledWith =
  (...tokens: string[]) =>
  (work: StoredWork) =>
    work.present &&
    work.queued.length === 0 &&
    tokens.every((t) => work.shown.includes(t));

export type ScriptEnd = {
  /** The local schema epoch of the app alice last opened (or was opening). */
  readonly schemaEpoch: number;
};

export async function runDurableCrashScript(
  s: Run<SyncHarness>
): Promise<ScriptEnd> {
  let schemaEpoch = SCHEMA_EPOCH;
  try {
    await s.apply(addClient, ALICE);
  } catch (error) {
    // Dying during first open is one of the crash points.
    if (!(await s.read(diedAtBoundary, ALICE))) throw error;
  }
  await s.apply(addClient, BOB);
  await s.apply(mutate, BOB, setNote, { id: LEDGER, body: 'seed' });
  await aliceSees(s, settledWith());

  // Offline writes: apply + queue insert, nothing uploads.
  await aliceStep(s, () => s.apply(partition, ALICE, 'all'));
  await s.apply(durableAppend, ALICE, LEDGER, 'a1');
  await s.apply(durableAppend, ALICE, LEDGER, 'a2');
  // A peer's change lands on the server while alice still holds her writes.
  await s.apply(durableAppend, BOB, LEDGER, 'b1');

  // Reconnect: upload drain, acknowledge, retire, merge + rebase.
  await aliceStep(s, () => s.apply(resumeNetwork, ALICE, 'all'));
  await aliceSees(s, settledWith('a1', 'a2', 'b1'));

  // A cleared cache with a write still queued: wipe + re-apply.
  await aliceStep(s, () => s.apply(partition, ALICE, 'all'));
  await s.apply(durableAppend, ALICE, LEDGER, 'a3');
  await aliceStep(s, () => s.apply(clearLocalData, ALICE, 'cache'));

  // An app update that bumps the local schema epoch, a write still queued.
  await s.apply(durableAppend, ALICE, LEDGER, 'a4');
  if (await s.read(clientAlive, ALICE)) schemaEpoch = SCHEMA_EPOCH + 1;
  await aliceStep(s, () =>
    s.apply(restart, ALICE, {
      preserveLocalDb: true,
      schemaEpoch,
    })
  );
  await aliceStep(s, () => s.apply(resumeNetwork, ALICE, 'all'));
  await s.apply(durableAppend, ALICE, LEDGER, 'a5');
  await s.apply(durableAppend, BOB, LEDGER, 'b2');
  await aliceSees(s, settledWith('a3', 'a4', 'a5', 'b2'));
  return { schemaEpoch };
}
