import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld, requireMmWorld } from '../../sim/system';
import {
  assertMatchInvariants,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: concurrent replica ticks', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('tickAll never double-matches a participant', async () => {
    await using host = await openMatchmakingWorld({
      seed: 210,
      replicas: 3,
      backend: 'postgres',
    });
    const world = requireMmWorld(host.state);
    const participants = [];
    for (let i = 0; i < 12; i += 1) {
      world.clock.advance(1);
      participants.push(
        await world.join({
          data: RatingAttr(1500 + i),
          formulas: [SimpleFormula],
        })
      );
    }
    const results = await world.tickAll({ maxPassesPerPartition: 4 });
    const matchSum = results.reduce((n, r) => n + r.matches, 0);
    const { matchCount, waiting } = await assertMatchInvariants(
      world,
      participants
    );
    expect(matchSum).toBe(matchCount);
    expect(matchCount * 2 + waiting).toBe(participants.length);
    for (const p of participants) {
      const st = await p.status();
      expect(
        st === null || st.status === 'waiting' || st.status === 'matched'
      ).toBe(true);
    }
  });
});
