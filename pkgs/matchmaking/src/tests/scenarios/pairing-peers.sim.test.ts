import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { TickResult } from '../../interface/matchmaking';
import type { StatusResult } from '../../interface/types';
import {
  join,
  lastTick,
  matchmaking,
  participantIds,
  statusOf,
  tick,
} from '../../sim/scenario';
import {
  expectMatched,
  NameAttr,
  RatingAttr,
  registerTestCrashHandler,
  UUID_REGEX,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };
const fourPasses = { opts: { maxPassesPerPartition: 4 } };

describe('matchmaking sim: pairing / peers', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('paired participants see the same matchId and each other as peers', async () => {
    await using s = await matchmaking.script({ seed: 20 });
    await s.apply(join, {
      ref: 'a',
      input: {
        data: { ...RatingAttr(1000), ...NameAttr('a') },
        formulas: [SimpleFormula],
      },
    });
    await s.apply(join, {
      ref: 'b',
      input: {
        data: { ...RatingAttr(1020), ...NameAttr('b') },
        formulas: [SimpleFormula],
      },
    });
    await s.apply(tick, fourPasses);
    expect(((await s.observe(lastTick)) as TickResult).matches).toBe(1);
    const ids = await s.observe(participantIds);
    const a = expectMatched((await s.observe(statusOf, 'a')) as StatusResult);
    const b = expectMatched((await s.observe(statusOf, 'b')) as StatusResult);
    expect(a.matchId).toMatch(UUID_REGEX);
    expect(a.matchId).toBe(b.matchId);
    expect(a.peers.map((p) => p.participantId)).toEqual([ids['b'] as string]);
    expect(b.peers.map((p) => p.participantId)).toEqual([ids['a'] as string]);
  });

  test('three participants — only the closest pair matches', async () => {
    await using s = await matchmaking.script({ seed: 21 });
    const ratings = { a: 1000, b: 1020, c: 2000 } as const;
    for (const [ref, rating] of Object.entries(ratings)) {
      await s.apply(join, {
        ref,
        input: { data: RatingAttr(rating), formulas: [SimpleFormula] },
      });
    }
    await s.apply(tick, fourPasses);
    for (const [ref, expected] of [
      ['a', 'matched'],
      ['b', 'matched'],
      ['c', 'waiting'],
    ] as const) {
      expect(((await s.observe(statusOf, ref)) as StatusResult).status).toBe(
        expected
      );
    }
  });
});
