import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld } from '../../sim/scenario';
import {
  assertMatchInvariants,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: join during tick', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('joins on r0/r1 while r2 ticks; settle with tickAll', async () => {
    await using world = await openMatchmakingWorld({
      seed: 230,
      replicas: 3,
      backend: 'postgres',
    });
    const warm = [];
    for (let i = 0; i < 4; i += 1) {
      await world.advance(1);
      warm.push(
        await world.join({
          data: RatingAttr(1100 + i),
          formulas: [SimpleFormula],
        })
      );
    }
    const late: typeof warm = [];
    await Promise.all([
      world.replica('r2').tick({ maxPassesPerPartition: 4 }),
      (async () => {
        for (let i = 0; i < 4; i += 1) {
          await world.advance(1);
          late.push(
            await world.join(
              {
                data: RatingAttr(1200 + i),
                formulas: [SimpleFormula],
              },
              i % 2 === 0 ? 'r0' : 'r1'
            )
          );
        }
      })(),
    ]);
    await world.tickAll({ maxPassesPerPartition: 8 });
    const all = [...warm, ...late];
    const { matchCount, waiting } = await assertMatchInvariants(world, all);
    expect(matchCount * 2 + waiting).toBe(all.length);
  });
});
