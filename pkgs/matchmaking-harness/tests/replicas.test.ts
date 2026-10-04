/**
 * Replica contract: the example app behind three replicas sharing one store
 * answers the same wherever a request lands — a wait joined at one replica
 * is read, changed, stopped and matched at any other, and a replica booting
 * again (`ready`) changes nobody's status. The specs describe waiting and
 * matching; which replica serves a request is not something a person sees.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Run } from '@pkgs/harness-shared/run-types';
import {
  join,
  leave,
  ready,
  tick,
  updateFormulas,
} from '@pkgs/matchmaking-harness/actions';
import {
  NameAttr,
  RatingAttr,
  ratingWithin,
} from '@pkgs/matchmaking-harness/attrs';
import { registerTestCrashHandler } from '@pkgs/matchmaking-harness/crash-handler';
import type { MatchmakingHarness } from '@pkgs/matchmaking-harness/facade';
import {
  lastLeave,
  lastUpdate,
  participantIds,
  replicaIds,
  statusAcrossReplicas,
} from '@pkgs/matchmaking-harness/observations';
import { matchmaking } from '@pkgs/matchmaking-harness/system';
import type {
  LeaveResult,
  StatusResult,
  UpdateFormulasResult,
} from '@pkgs/matchmaking-shared/types';

type Harness = Run<MatchmakingHarness>;

async function open(seed: string): Promise<Harness> {
  return await matchmaking.run({ seed, args: { replicas: 3 } });
}

async function waitAt(
  s: Harness,
  ref: string,
  at: {
    readonly replicaId: string;
    readonly rating: number;
    readonly points: number;
  }
): Promise<void> {
  const { replicaId, rating, points } = at;
  await s.apply(join, {
    ref,
    replicaId,
    input: {
      data: { ...RatingAttr(rating), ...NameAttr(ref) },
      formulas: [ratingWithin(points)],
    },
  });
}

async function idOf(s: Harness, ref: string): Promise<string> {
  const id = (await s.read(participantIds))[ref];
  if (id === undefined) throw new Error(`${ref} never joined`);
  return id;
}

/** `ref`'s status at every replica, keyed by replica. */
async function everywhere(
  s: Harness,
  ref: string
): Promise<Record<string, StatusResult | null>> {
  return (await s.read(statusAcrossReplicas, await idOf(s, ref))) as Record<
    string,
    StatusResult | null
  >;
}

async function statusesEverywhere(
  s: Harness,
  ref: string
): Promise<(string | null)[]> {
  return Object.values(await everywhere(s, ref)).map(
    (one) => one?.status ?? null
  );
}

describe('matchmaking replicas sharing one store', () => {
  let dispose: () => void;
  beforeAll(() => {
    dispose = registerTestCrashHandler();
  });
  afterAll(() => {
    dispose();
  });

  test('a wait joined at one replica is waiting at every replica', async () => {
    await using s = await open('replicas-join');
    await waitAt(s, 'alice', { replicaId: 'r0', rating: 1500, points: 50 });
    expect(await statusesEverywhere(s, 'alice')).toEqual([
      'waiting',
      'waiting',
      'waiting',
    ]);
  });

  test('a wait joined at one replica is left at another', async () => {
    await using s = await open('replicas-leave');
    await waitAt(s, 'alice', { replicaId: 'r0', rating: 1500, points: 50 });
    await s.apply(leave, { ref: 'alice', replicaId: 'r2' });
    expect(((await s.read(lastLeave)) as LeaveResult).removed).toBe(true);
    expect(await statusesEverywhere(s, 'alice')).toEqual([null, null, null]);
  });

  test('formulas updated at one replica count for a tick at another', async () => {
    await using s = await open('replicas-update');
    await waitAt(s, 'alice', { replicaId: 'r0', rating: 1000, points: 5 });
    await waitAt(s, 'bob', { replicaId: 'r1', rating: 1050, points: 200 });
    await s.apply(updateFormulas, {
      ref: 'alice',
      formulas: [ratingWithin(200)],
      replicaId: 'r1',
    });
    expect(((await s.read(lastUpdate)) as UpdateFormulasResult).updated).toBe(
      true
    );
    await s.apply(tick, { replicaId: 'r0' });
    const bob = await idOf(s, 'bob');
    for (const one of Object.values(await everywhere(s, 'alice'))) {
      expect(one?.status).toBe('matched');
      if (one?.status !== 'matched') continue;
      expect(one.peers.map((p) => p.participantId)).toEqual([bob]);
    }
  });

  test('every replica booting again keeps every wait', async () => {
    await using s = await open('replicas-ready');
    await waitAt(s, 'alice', { replicaId: 'r1', rating: 1500, points: 50 });
    for (const replicaId of await s.read(replicaIds)) {
      await s.apply(ready, { replicaId });
    }
    expect(await statusesEverywhere(s, 'alice')).toEqual([
      'waiting',
      'waiting',
      'waiting',
    ]);
  });
});
