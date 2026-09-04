import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { TickResult } from '../../interface/matchmaking';
import type { StatusResult } from '../../interface/types';
import {
  join,
  lastTick,
  matched,
  matchmaking,
  statusOf,
  stepTime,
  tick,
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
    await using s = await matchmaking.script({
      seed: 70,
      args: {
        radius: { baseRadius: 10, radiusGrowthPerSecond: 10, maxRadius: 400 },
      },
    });
    const formula = { numeric: [{ tag: RatingAttr, weight: 1 }] };
    await s.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [formula] },
    });
    await s.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1080), formulas: [formula] },
    });
    let waited = 0;
    while (waited < 500) {
      if (await s.observe(matched, ['a'])) {
        throw new Error(`never: matched at ${String(waited)}ms`);
      }
      await s.apply(stepTime, 100);
      waited += 100;
    }
    waited = 0;
    for (;;) {
      if (await s.observe(matched, ['a'])) break;
      if (waited >= 30_000) {
        throw new Error('until: not matched within 30000ms');
      }
      await s.apply(stepTime, 1_000);
      waited += 1_000;
    }
    expect(((await s.observe(statusOf, 'b')) as StatusResult).status).toBe(
      'matched'
    );
  });

  test('stricter per-formula radius bounds the match', async () => {
    await using s = await matchmaking.script({ seed: 71 });
    await s.apply(join, {
      ref: 'a',
      input: {
        data: RatingAttr(1000),
        formulas: [{ numeric: [{ tag: RatingAttr, weight: 1 }] }],
      },
    });
    await s.apply(join, {
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
    await s.apply(tick, onePass);
    expect(((await s.observe(lastTick)) as TickResult).matches).toBe(0);
  });

  test('looser per-formula radius lets pair match', async () => {
    await using s = await matchmaking.script({ seed: 72 });
    const wide = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 200, radiusGrowthPerSecond: 0, maxRadius: 200 },
    };
    await s.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [wide] },
    });
    await s.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1180), formulas: [wide] },
    });
    await s.apply(tick, onePass);
    expect(((await s.observe(lastTick)) as TickResult).matches).toBe(1);
  });
});
