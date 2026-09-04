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
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: priority', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('high-priority joiner is matched before same-bucket FIFO peer', async () => {
    await using s = await matchmaking.script({ seed: 80 });
    await s.apply(join, {
      ref: 'a',
      input: {
        data: RatingAttr(1000),
        formulas: [
          {
            numeric: [{ tag: RatingAttr, weight: 1 }],
            radius: { baseRadius: 0, radiusGrowthPerSecond: 0, maxRadius: 0 },
          },
        ],
      },
    });
    await s.elapse(1);
    await s.apply(join, {
      ref: 'b',
      input: {
        data: RatingAttr(1005),
        formulas: [SimpleFormula],
        priority: 100,
      },
    });
    await s.elapse(1);
    await s.apply(join, {
      ref: 'c',
      input: { data: RatingAttr(1010), formulas: [SimpleFormula] },
    });
    await s.apply(tick, { opts: { maxPassesPerPartition: 1 } });
    expect(((await s.observe(lastTick)) as TickResult).matches).toBe(1);
    const ids = await s.observe(participantIds);
    const b = expectMatched((await s.observe(statusOf, 'b')) as StatusResult);
    expect(b.peers[0]?.participantId).toBe(ids['c']);
    expect(((await s.observe(statusOf, 'a')) as StatusResult).status).toBe(
      'waiting'
    );
  });
});
