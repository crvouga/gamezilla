import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { TickResult } from '../../interface/matchmaking';
import {
  join,
  lastTick,
  matchmaking,
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
    await using s = await matchmaking.script({
      seed: 50,
      args: { tuning: { maxWaitSeconds: 30 } },
    });
    await s.apply(join, {
      ref: 'p',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
    });
    await s.apply(tick, {});
    expect(((await s.observe(lastTick)) as TickResult).expiredRemoved).toBe(0);
    await s.elapse(120_000);
    await s.apply(tick, {});
    expect(((await s.observe(lastTick)) as TickResult).expiredRemoved).toBe(1);
    expect(await s.observe(statusOf, 'p')).toBeNull();
  });

  test('matchedRemoved reaps matched rows older than matchedRetentionSeconds', async () => {
    await using s = await matchmaking.script({
      seed: 51,
      args: { tuning: { matchedRetentionSeconds: 10 } },
    });
    await s.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
    });
    await s.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1010), formulas: [SimpleFormula] },
    });
    await s.apply(tick, { opts: { maxPassesPerPartition: 1 } });
    expect(((await s.observe(lastTick)) as TickResult).matches).toBe(1);
    await s.elapse(60_000);
    await s.apply(tick, {});
    expect(((await s.observe(lastTick)) as TickResult).matchedRemoved).toBe(2);
    expect(await s.observe(statusOf, 'a')).toBeNull();
    expect(await s.observe(statusOf, 'b')).toBeNull();
  });

  test('tick on an empty queue is a clean no-op', async () => {
    await using s = await matchmaking.script({ seed: 52 });
    await s.apply(tick, {});
    expect(await s.observe(lastTick)).toEqual({
      matches: 0,
      passes: 0,
      partitions: 0,
      expiredRemoved: 0,
      matchedRemoved: 0,
    });
  });
});
