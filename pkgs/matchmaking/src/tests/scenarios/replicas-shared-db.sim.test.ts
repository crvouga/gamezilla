import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import type { TickResult } from '../../interface/matchmaking';
import type {
  DistanceFormula,
  LeaveResult,
  StatusResult,
  UpdateFormulasResult,
} from '../../interface/types';
import {
  join,
  lastLeave,
  lastTick,
  lastUpdate,
  leave,
  MATCHMAKING_PROPERTIES,
  matchmaking,
  matchmakingKnobs,
  participantIds,
  ready,
  replicaIds,
  statusById,
  statusOf,
  tick,
  updateFormulas,
} from '../../sim/scenario';
import {
  assertStatusAgreesAcrossReplicas,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

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
    await using run = await script(matchmaking, {
      seed: 200,
      knobs: matchmakingKnobs({ replicas: 3 }),
      properties: MATCHMAKING_PROPERTIES,
    });
    await run.apply(join, {
      ref: 'p',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
      replicaId: 'r0',
    });
    const participantId = (await run.observe(participantIds))['p'] as string;
    const seen = await assertStatusAgreesAcrossReplicas(run, participantId);
    expect(seen?.status).toBe('waiting');
    await run.apply(leave, { ref: 'p', replicaId: 'r2' });
    expect(((await run.observe(lastLeave)) as LeaveResult).removed).toBe(true);
    expect(await run.observe(statusById, participantId, 'r0')).toBeNull();
    expect(await run.observe(statusById, participantId, 'r1')).toBeNull();
  });

  test('updateFormulas on a different replica than join', async () => {
    await using run = await script(matchmaking, {
      seed: 201,
      knobs: matchmakingKnobs({ replicas: 2 }),
      properties: MATCHMAKING_PROPERTIES,
    });
    const open: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 200, radiusGrowthPerSecond: 0, maxRadius: 200 },
    };
    const tight: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 5, radiusGrowthPerSecond: 0, maxRadius: 5 },
    };
    await run.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [tight] },
      replicaId: 'r0',
    });
    await run.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1050), formulas: [open] },
      replicaId: 'r1',
    });
    await run.apply(tick, { opts: onePass, replicaId: 'r0' });
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(0);
    await run.apply(updateFormulas, {
      ref: 'a',
      formulas: [open],
      replicaId: 'r1',
    });
    expect(
      ((await run.observe(lastUpdate)) as UpdateFormulasResult).updated
    ).toBe(true);
    await run.apply(tick, { opts: onePass, replicaId: 'r1' });
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(1);
    expect(
      ((await run.observe(statusOf, 'a', 'r0')) as StatusResult).status
    ).toBe('matched');
  });

  test('ready() is idempotent on every replica', async () => {
    await using run = await script(matchmaking, {
      seed: 202,
      knobs: matchmakingKnobs({ replicas: 3 }),
      properties: MATCHMAKING_PROPERTIES,
    });
    for (const replicaId of await run.observe(replicaIds)) {
      await run.apply(ready, { replicaId });
      await run.apply(ready, { replicaId });
    }
    await run.apply(join, {
      ref: 'p',
      input: { data: RatingAttr(900), formulas: [SimpleFormula] },
      replicaId: 'r2',
    });
    expect((await run.observe(participantIds))['p']).toBeDefined();
  });
});
