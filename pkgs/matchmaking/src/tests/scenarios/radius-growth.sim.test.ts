import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { TickResult } from '../../interface/matchmaking';
import type { StatusResult } from '../../interface/types';
import {
  join,
  lastTick,
  startMatchmaking,
  statusOf,
  tick,
  waitNeverMatched,
  waitUntilMatched,
} from '../../sim/scenario';
import { RatingAttr, registerTestCrashHandler } from '../fixtures';

const onePass = { opts: { maxPassesPerPartition: 1 } };

describe('matchmaking sim: radius growth', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('far pair never matches at t=0; until matched after wait', async () => {
    await using run = await startMatchmaking({
      seed: 70,
      radius: { baseRadius: 10, radiusGrowthPerSecond: 10, maxRadius: 400 },
    });
    const formula = { numeric: [{ tag: RatingAttr, weight: 1 }] };
    await run.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [formula] },
    });
    await run.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1080), formulas: [formula] },
    });
    await run.apply(waitNeverMatched, {
      refs: ['a'],
      forMs: 500,
      stepMs: 100,
    });
    await run.apply(waitUntilMatched, {
      refs: ['a'],
      budgetMs: 30_000,
      stepMs: 1_000,
    });
    expect(((await run.observe(statusOf('b'))) as StatusResult).status).toBe(
      'matched'
    );
  });

  test('stricter per-formula radius bounds the match', async () => {
    await using run = await startMatchmaking({ seed: 71 });
    await run.apply(join, {
      ref: 'a',
      input: {
        data: RatingAttr(1000),
        formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
      },
    });
    await run.apply(join, {
      ref: 'b',
      input: {
        data: RatingAttr(1030),
        formulas: [
          {
            numeric: [{ tag: RatingAttr, weight: 1 }],
            radius: { baseRadius: 10, radiusGrowthPerSecond: 0, maxRadius: 10 },
          },
        ],
      },
    });
    await run.apply(tick, onePass);
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(0);
  });

  test('looser per-formula radius lets pair match', async () => {
    await using run = await startMatchmaking({ seed: 72 });
    const wide = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 200, radiusGrowthPerSecond: 0, maxRadius: 200 },
    };
    await run.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [wide] },
    });
    await run.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1180), formulas: [wide] },
    });
    await run.apply(tick, onePass);
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(1);
  });
});
