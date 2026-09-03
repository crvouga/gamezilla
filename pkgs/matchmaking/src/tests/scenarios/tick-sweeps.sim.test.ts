import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import type { TickResult } from '../../interface/matchmaking';
import {
  defineMatchmakingSystem,
  join,
  lastTick,
  MATCHMAKING_PROPERTIES,
  matchmaking,
  matchmakingKnobs,
  statusOf,
  tick,
} from '../../sim/scenario';
import { RatingAttr, registerTestCrashHandler } from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: tick sweeps', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('expiredRemoved reaps waiters older than maxWaitSeconds', async () => {
    await using run = await script(
      defineMatchmakingSystem({ tuning: { maxWaitSeconds: 30 } }),
      {
        seed: 50,
        knobs: matchmakingKnobs(),
        properties: MATCHMAKING_PROPERTIES,
      }
    );
    await run.apply(join, {
      ref: 'p',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
    });
    await run.apply(tick, {});
    expect(((await run.observe(lastTick)) as TickResult).expiredRemoved).toBe(
      0
    );
    await run.elapse(120_000);
    await run.apply(tick, {});
    expect(((await run.observe(lastTick)) as TickResult).expiredRemoved).toBe(
      1
    );
    expect(await run.observe(statusOf, 'p')).toBeNull();
  });

  test('matchedRemoved reaps matched rows older than matchedRetentionSeconds', async () => {
    await using run = await script(
      defineMatchmakingSystem({ tuning: { matchedRetentionSeconds: 10 } }),
      {
        seed: 51,
        knobs: matchmakingKnobs(),
        properties: MATCHMAKING_PROPERTIES,
      }
    );
    await run.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
    });
    await run.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1010), formulas: [SimpleFormula] },
    });
    await run.apply(tick, { opts: { maxPassesPerPartition: 1 } });
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(1);
    await run.elapse(60_000);
    await run.apply(tick, {});
    expect(((await run.observe(lastTick)) as TickResult).matchedRemoved).toBe(
      2
    );
    expect(await run.observe(statusOf, 'a')).toBeNull();
    expect(await run.observe(statusOf, 'b')).toBeNull();
  });

  test('tick on an empty queue is a clean no-op', async () => {
    await using run = await script(matchmaking, {
      seed: 52,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await run.apply(tick, {});
    expect(await run.observe(lastTick)).toEqual({
      matches: 0,
      passes: 0,
      partitions: 0,
      expiredRemoved: 0,
      matchedRemoved: 0,
    });
  });
});
