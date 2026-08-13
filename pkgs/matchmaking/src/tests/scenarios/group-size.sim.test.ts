import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingSimWorld } from '../../sim/world';
import {
  expectMatched,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: groupSize', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('groupSize: 3 forms one match', async () => {
    await using world = await openMatchmakingSimWorld({ seed: 60 });
    const a = await world.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
      groupSize: 3,
    });
    const b = await world.join({
      data: RatingAttr(1005),
      formulas: [SimpleFormula],
      groupSize: 3,
    });
    const c = await world.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
      groupSize: 3,
    });
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
    const ma = expectMatched(await a.status());
    expect(ma.matchId).toBe(expectMatched(await b.status()).matchId);
    expect(ma.peers).toHaveLength(2);
    expect(new Set(ma.peers.map((p) => p.participantId))).toEqual(
      new Set([b.participantId, c.participantId])
    );
  });

  test('mixed groupSize never cross-matches', async () => {
    await using world = await openMatchmakingSimWorld({ seed: 61 });
    await world.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
      groupSize: 2,
    });
    await world.join({
      data: RatingAttr(1005),
      formulas: [SimpleFormula],
      groupSize: 3,
    });
    await world.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
      groupSize: 3,
    });
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(0);
  });
});
