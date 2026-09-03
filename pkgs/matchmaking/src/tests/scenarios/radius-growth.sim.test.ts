import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import type { TickResult } from '../../interface/matchmaking';
import type { StatusResult } from '../../interface/types';
import {
  defineMatchmakingSystem,
  join,
  lastTick,
  MATCHMAKING_PROPERTIES,
  matched,
  matchmaking,
  matchmakingKnobs,
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
    await using run = await script(
      defineMatchmakingSystem({
        radius: { baseRadius: 10, radiusGrowthPerSecond: 10, maxRadius: 400 },
      }),
      {
        seed: 70,
        knobs: matchmakingKnobs(),
        properties: MATCHMAKING_PROPERTIES,
      }
    );
    const formula = { numeric: [{ tag: RatingAttr, weight: 1 }] };
    await run.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [formula] },
    });
    await run.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1080), formulas: [formula] },
    });
    let waited = 0;
    while (waited < 500) {
      if (await run.observe(matched, ['a'])) {
        throw new Error(`never: matched at ${String(waited)}ms`);
      }
      await run.apply(stepTime, 100);
      waited += 100;
    }
    waited = 0;
    for (;;) {
      if (await run.observe(matched, ['a'])) break;
      if (waited >= 30_000) {
        throw new Error('until: not matched within 30000ms');
      }
      await run.apply(stepTime, 1_000);
      waited += 1_000;
    }
    expect(((await run.observe(statusOf, 'b')) as StatusResult).status).toBe(
      'matched'
    );
  });

  test('stricter per-formula radius bounds the match', async () => {
    await using run = await script(matchmaking, {
      seed: 71,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
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
    await using run = await script(matchmaking, {
      seed: 72,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
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
