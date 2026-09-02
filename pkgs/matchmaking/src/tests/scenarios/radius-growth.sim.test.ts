import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld } from '../../sim/system';
import { RatingAttr, registerTestCrashHandler } from '../fixtures';

describe('matchmaking sim: radius growth', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('far pair never matches at t=0; until matched after wait', async () => {
    await using world = await openMatchmakingWorld({
      seed: 70,
      radius: {
        baseRadius: 10,
        radiusGrowthPerSecond: 10,
        maxRadius: 400,
      },
    });
    const formula = { numeric: [{ tag: RatingAttr, weight: 1 }] };
    const a = await world.join({
      data: RatingAttr(1000),
      formulas: [formula],
    });
    const b = await world.join({
      data: RatingAttr(1080),
      formulas: [formula],
    });
    await world.waitNever(
      async () => (await a.status())?.status === 'matched',
      {
        forMs: 500,
        stepMs: 100,
      }
    );
    await world.waitUntil(
      async () => (await a.status())?.status === 'matched',
      {
        budgetMs: 30_000,
        stepMs: 1_000,
      }
    );
    expect((await b.status())?.status).toBe('matched');
  });

  test('stricter per-formula radius bounds the match', async () => {
    await using world = await openMatchmakingWorld({ seed: 71 });
    await world.join({
      data: RatingAttr(1000),
      formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
    });
    await world.join({
      data: RatingAttr(1030),
      formulas: [
        {
          numeric: [{ tag: RatingAttr, weight: 1 }],
          radius: {
            baseRadius: 10,
            radiusGrowthPerSecond: 0,
            maxRadius: 10,
          },
        },
      ],
    });
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(0);
  });

  test('looser per-formula radius lets pair match', async () => {
    await using world = await openMatchmakingWorld({ seed: 72 });
    await world.join({
      data: RatingAttr(1000),
      formulas: [
        {
          numeric: [{ tag: RatingAttr, weight: 1 }],
          radius: {
            baseRadius: 200,
            radiusGrowthPerSecond: 0,
            maxRadius: 200,
          },
        },
      ],
    });
    await world.join({
      data: RatingAttr(1180),
      formulas: [
        {
          numeric: [{ tag: RatingAttr, weight: 1 }],
          radius: {
            baseRadius: 200,
            radiusGrowthPerSecond: 0,
            maxRadius: 200,
          },
        },
      ],
    });
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
  });
});
