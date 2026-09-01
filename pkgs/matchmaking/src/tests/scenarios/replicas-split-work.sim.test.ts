import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld } from '../../sim/system';
import {
  assertMatchInvariants,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: replica split work', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('maxPairsPerPass:1 still pairs everyone across concurrent workers', async () => {
    await using host = await openMatchmakingWorld({
      seed: 220,
      replicas: 2,
      backend: 'postgres',
      tuning: { maxPairsPerPass: 1 },
    });
    const world = host.facade;
    const participants = [];
    for (let i = 0; i < 8; i += 1) {
      world.clock.advance(1);
      participants.push(
        await world.join({
          data: RatingAttr(1000 + i),
          formulas: [SimpleFormula],
        })
      );
    }
    for (let round = 0; round < 8; round += 1) {
      await world.tickAll({ maxPassesPerPartition: 1 });
      const allMatched = (
        await Promise.all(participants.map((p) => p.status()))
      ).every((s) => s?.status === 'matched');
      if (allMatched) break;
    }
    const { matchCount, waiting } = await assertMatchInvariants(
      world,
      participants
    );
    expect(waiting).toBe(0);
    expect(matchCount).toBe(4);
  });
});
