import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { DistanceFormula } from '../../interface/types';
import { openMatchmakingWorld, requireMmWorld } from '../../sim/system';
import {
  assertStatusAgreesAcrossReplicas,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula: DistanceFormula = {
  numeric: [{ tag: RatingAttr, weight: 1 }],
};

describe('matchmaking sim: replicas share one DB', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('join r0 / status r1 / leave r2 see the same store', async () => {
    await using host = await openMatchmakingWorld({
      seed: 200,
      replicas: 3,
    });
    const world = requireMmWorld(host.state);
    const p = await world.join(
      { data: RatingAttr(1000), formulas: [SimpleFormula] },
      'r0'
    );
    const fromR1 = await assertStatusAgreesAcrossReplicas(
      world,
      p.participantId
    );
    expect(fromR1?.status).toBe('waiting');
    expect((await p.leave('r2')).removed).toBe(true);
    expect(await world.replica('r0').mm.status(p.participantId)).toBeNull();
    expect(await world.replica('r1').mm.status(p.participantId)).toBeNull();
  });

  test('updateFormulas on a different replica than join', async () => {
    await using host = await openMatchmakingWorld({
      seed: 201,
      replicas: 2,
    });
    const world = requireMmWorld(host.state);
    const open: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: {
        baseRadius: 200,
        radiusGrowthPerSecond: 0,
        maxRadius: 200,
      },
    };
    const tight: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 5, radiusGrowthPerSecond: 0, maxRadius: 5 },
    };
    const a = await world.join(
      { data: RatingAttr(1000), formulas: [tight] },
      'r0'
    );
    await world.join({ data: RatingAttr(1050), formulas: [open] }, 'r1');
    expect((await world.tick({ maxPassesPerPartition: 1 }, 'r0')).matches).toBe(
      0
    );
    expect((await a.updateFormulas([open], 'r1')).updated).toBe(true);
    expect((await world.tick({ maxPassesPerPartition: 1 }, 'r1')).matches).toBe(
      1
    );
    expect((await a.status('r0'))?.status).toBe('matched');
  });

  test('ready() is idempotent on every replica', async () => {
    await using host = await openMatchmakingWorld({
      seed: 202,
      replicas: 3,
    });
    const world = requireMmWorld(host.state);
    for (const r of world.replicas.values()) {
      await r.mm.ready();
      await r.mm.ready();
    }
    const joined = await world.join(
      { data: RatingAttr(900), formulas: [SimpleFormula] },
      'r2'
    );
    expect(joined.participantId).toBeDefined();
  });
});
