import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import type { TickResult } from '../../interface/matchmaking';
import type { StatusResult } from '../../interface/types';
import {
  join,
  lastTick,
  MATCHMAKING_PROPERTIES,
  matchmaking,
  matchmakingKnobs,
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
    await using run = await script(matchmaking, {
      seed: 80,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await run.apply(join, {
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
    await run.elapse(1);
    await run.apply(join, {
      ref: 'b',
      input: {
        data: RatingAttr(1005),
        formulas: [SimpleFormula],
        priority: 100,
      },
    });
    await run.elapse(1);
    await run.apply(join, {
      ref: 'c',
      input: { data: RatingAttr(1010), formulas: [SimpleFormula] },
    });
    await run.apply(tick, { opts: { maxPassesPerPartition: 1 } });
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(1);
    const ids = await run.observe(participantIds);
    const b = expectMatched((await run.observe(statusOf, 'b')) as StatusResult);
    expect(b.peers[0]?.participantId).toBe(ids['c']);
    expect(((await run.observe(statusOf, 'a')) as StatusResult).status).toBe(
      'waiting'
    );
  });
});
