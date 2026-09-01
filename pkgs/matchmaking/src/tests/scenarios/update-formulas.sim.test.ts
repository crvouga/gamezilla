import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { DistanceFormula } from '../../interface/types';
import { openMatchmakingWorld, requireMmWorld } from '../../sim/system';
import { RatingAttr, registerTestCrashHandler } from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: updateFormulas', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('widening criteria mid-wait allows a previously-rejected peer', async () => {
    await using host = await openMatchmakingWorld({ seed: 100 });
    const world = requireMmWorld(host.state);
    const tight: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 5, radiusGrowthPerSecond: 0, maxRadius: 5 },
    };
    const open: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: {
        baseRadius: 200,
        radiusGrowthPerSecond: 0,
        maxRadius: 200,
      },
    };
    const a = await world.join({
      data: RatingAttr(1000),
      formulas: [tight],
    });
    await world.join({ data: RatingAttr(1050), formulas: [open] });
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(0);
    expect((await a.updateFormulas([open])).updated).toBe(true);
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
  });

  test('returns updated:false for unknown / matched', async () => {
    await using host = await openMatchmakingWorld({ seed: 101 });
    const world = requireMmWorld(host.state);
    expect(
      (
        await world.mm.updateFormulas('00000000-0000-0000-0000-000000000000', [
          SimpleFormula,
        ])
      ).updated
    ).toBe(false);
    const a = await world.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    await world.join({ data: RatingAttr(1010), formulas: [SimpleFormula] });
    await world.tick({ maxPassesPerPartition: 1 });
    expect((await a.updateFormulas([SimpleFormula])).updated).toBe(false);
  });
});
