/**
 * After a crash: reopen alice from the storage her dead process left, let
 * everyone sync, and judge every write the person made.
 */

import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { appendedTokens } from './append-note-mutation';
import {
  clientAlive,
  type DurableWriteOutcome,
  durableCrashes,
  durableWriteOutcomes,
  type StoredWork,
  storedWork,
} from './durable-crash-actions';
import type { CrashMoment, DurableBoundary } from './durable-crash-points';
import { ALICE, LEDGER, type ScriptEnd } from './durable-crash-script';
import { expectInSync } from './expect-in-sync';
import { liveNote } from './reads';
import { restart } from './regression-random-faults-actions';
import type { SyncHarness } from './scenario-system';

export type WriteVerdict = {
  readonly token: string;
  readonly told: DurableWriteOutcome;
  /** The dead process's storage showed or queued it. */
  readonly kept: boolean;
  /** Times the server applied it after restart + sync. */
  readonly applied: number;
};

export type CrashVerdict = {
  /** Where alice died, or null when the armed boundary never came. */
  readonly crash: {
    readonly boundary: DurableBoundary;
    readonly when: CrashMoment;
  } | null;
  readonly leftBehind: StoredWork;
  readonly writes: readonly WriteVerdict[];
  /** Alice's device and the server show the same note after sync. */
  readonly agrees: boolean;
};

function count(tokens: readonly string[], token: string): number {
  return tokens.filter((t) => t === token).length;
}

/** Reopen from the same storage, sync, and read what happened to every write. */
export async function restartAndSettle(
  s: Run<SyncHarness>,
  end: ScriptEnd
): Promise<CrashVerdict> {
  const crashed = !(await s.read(clientAlive, ALICE));
  const crash = (await s.read(durableCrashes)).find(
    (c) => c.clientId === ALICE
  );
  const leftBehind = await s.read(storedWork, ALICE, LEDGER);
  if (crashed) {
    await s.apply(restart, ALICE, {
      preserveLocalDb: true,
      schemaEpoch: end.schemaEpoch,
    });
  }
  await expectInSync(s);
  const server = await s.read(liveNote, 'server', LEDGER);
  const local = await s.read(liveNote, ALICE, LEDGER);
  const applied = appendedTokens(server?.body ?? '');
  const told = await s.read(durableWriteOutcomes);
  const kept = new Set([...leftBehind.shown, ...leftBehind.queued]);
  return {
    crash:
      crash === undefined
        ? null
        : { boundary: crash.boundary, when: crash.when },
    leftBehind,
    agrees: local !== null && local.body === server?.body,
    writes: Object.entries(told).map(([token, outcome]) => ({
      token,
      told: outcome,
      kept: kept.has(token),
      applied: count(applied, token),
    })),
  };
}

/** What the person is owed for one write, given what they were told and saw. */
export function owedApplications(write: WriteVerdict): 0 | 1 | 'atMostOnce' {
  if (write.told === 'refused' || write.told === 'notMade') return 0;
  if (write.told === 'acknowledged' || write.kept) return 1;
  // Died in flight and the device kept nothing: the person never saw it saved.
  return 'atMostOnce';
}

/**
 * Exactly once or explicitly refused; nothing the person was told was saved,
 * or could see on their device, silently vanishes; nothing lands twice.
 * Returns one line per violation (empty when the run is correct).
 */
export function workLostOrDoubled(verdict: CrashVerdict): string[] {
  const violations: string[] = [];
  if (!verdict.agrees) violations.push('device and server disagree after sync');
  for (const write of verdict.writes) {
    const owed = owedApplications(write);
    const ok =
      owed === 'atMostOnce' ? write.applied <= 1 : write.applied === owed;
    if (!ok) {
      violations.push(
        `${write.token}: told ${write.told}${write.kept ? ', kept on device' : ''}; applied ${String(write.applied)}x, owed ${String(owed)}`
      );
    }
  }
  return violations;
}
