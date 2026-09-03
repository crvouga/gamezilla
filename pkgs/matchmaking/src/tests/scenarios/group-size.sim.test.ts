import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { TickResult } from '../../interface/matchmaking';
import type { StatusResult } from '../../interface/types';
import {
  join,
  lastTick,
  participantIds,
  startMatchmaking,
  statusOf,
  tick,
} from '../../sim/scenario';
import {
  expectMatched,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };
const onePass = { opts: { maxPassesPerPartition: 1 } };

describe('matchmaking sim: groupSize', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('groupSize: 3 forms one match', async () => {
    await using run = await startMatchmaking({ seed: 60 });
    const ratings = { a: 1000, b: 1005, c: 1010 } as const;
    for (const [ref, rating] of Object.entries(ratings)) {
      await run.apply(join, {
        ref,
        input: {
          data: RatingAttr(rating),
          formulas: [SimpleFormula],
          groupSize: 3,
        },
      });
    }
    await run.apply(tick, onePass);
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(1);
    const ids = await run.observe(participantIds);
    const ma = expectMatched(
      (await run.observe(statusOf('a'))) as StatusResult
    );
    const mb = expectMatched(
      (await run.observe(statusOf('b'))) as StatusResult
    );
    expect(ma.matchId).toBe(mb.matchId);
    expect(ma.peers).toHaveLength(2);
    expect(new Set(ma.peers.map((p) => p.participantId))).toEqual(
      new Set([ids['b'] as string, ids['c'] as string])
    );
  });

  test('mixed groupSize never cross-matches', async () => {
    await using run = await startMatchmaking({ seed: 61 });
    const plan = [
      { ref: 'a', rating: 1000, groupSize: 2 },
      { ref: 'b', rating: 1005, groupSize: 3 },
      { ref: 'c', rating: 1010, groupSize: 3 },
    ];
    for (const { ref, rating, groupSize } of plan) {
      await run.apply(join, {
        ref,
        input: {
          data: RatingAttr(rating),
          formulas: [SimpleFormula],
          groupSize,
        },
      });
    }
    await run.apply(tick, onePass);
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(0);
  });
});
