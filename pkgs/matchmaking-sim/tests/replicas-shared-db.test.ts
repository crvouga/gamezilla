import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type {
  DistanceFormula,
  LeaveResult,
  StatusResult,
  TickResult,
  UpdateFormulasResult,
} from '@pkgs/matchmaking/interface';
import {
  assertStatusAgreesAcrossReplicas,
  join,
  lastLeave,
  lastTick,
  lastUpdate,
  leave,
  matchmaking,
  participantIds,
  RatingAttr,
  ready,
  registerTestCrashHandler,
  replicaIds,
  statusById,
  statusOf,
  tick,
  updateFormulas,
} from '@pkgs/matchmaking-sim';

const SimpleFormula: DistanceFormula = {
  numeric: [{ tag: RatingAttr, weight: 1 }],
};
const onePass = { maxPassesPerPartition: 1 };

describe('matchmaking sim: replicas share one DB', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('join r0 / status r1 / leave r2 see the same store', async () => {
    await using s = await matchmaking.run({
      seed: 200,
      args: { replicas: 3 },
    });
    await s.apply(join, {
      ref: 'p',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
      replicaId: 'r0',
    });
    const participantId = (await s.read(participantIds))['p'] as string;
    const seen = await assertStatusAgreesAcrossReplicas(s, participantId);
    expect(seen?.status).toBe('waiting');
    await s.apply(leave, { ref: 'p', replicaId: 'r2' });
    expect(((await s.read(lastLeave)) as LeaveResult).removed).toBe(true);
    expect(await s.read(statusById, participantId, 'r0')).toBeNull();
    expect(await s.read(statusById, participantId, 'r1')).toBeNull();
  });

  test('updateFormulas on a different replica than join', async () => {
    await using s = await matchmaking.run({
      seed: 201,
      args: { replicas: 2 },
    });
    const open: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 200, radiusGrowthPerSecond: 0, maxRadius: 200 },
    };
    const tight: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 5, radiusGrowthPerSecond: 0, maxRadius: 5 },
    };
    await s.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [tight] },
      replicaId: 'r0',
    });
    await s.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1050), formulas: [open] },
      replicaId: 'r1',
    });
    await s.apply(tick, { opts: onePass, replicaId: 'r0' });
    expect(((await s.read(lastTick)) as TickResult).matches).toBe(0);
    await s.apply(updateFormulas, {
      ref: 'a',
      formulas: [open],
      replicaId: 'r1',
    });
    expect(((await s.read(lastUpdate)) as UpdateFormulasResult).updated).toBe(
      true
    );
    await s.apply(tick, { opts: onePass, replicaId: 'r1' });
    expect(((await s.read(lastTick)) as TickResult).matches).toBe(1);
    expect(((await s.read(statusOf, 'a', 'r0')) as StatusResult).status).toBe(
      'matched'
    );
  });

  test('ready() is idempotent on every replica', async () => {
    await using s = await matchmaking.run({
      seed: 202,
      args: { replicas: 3 },
    });
    for (const replicaId of await s.read(replicaIds)) {
      await s.apply(ready, { replicaId });
      await s.apply(ready, { replicaId });
    }
    await s.apply(join, {
      ref: 'p',
      input: { data: RatingAttr(900), formulas: [SimpleFormula] },
      replicaId: 'r2',
    });
    expect((await s.read(participantIds))['p']).toBeDefined();
  });
});
