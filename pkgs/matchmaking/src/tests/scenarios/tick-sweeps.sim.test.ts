import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld, requireMmWorld } from '../../sim/system';
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
    await using host = await openMatchmakingWorld({
      seed: 50,
      tuning: { maxWaitSeconds: 30 },
    });
    const world = requireMmWorld(host.state);
    const p = await world.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    expect((await world.tick()).expiredRemoved).toBe(0);
    await world.runFor(120_000);
    expect((await world.tick()).expiredRemoved).toBe(1);
    expect(await p.status()).toBeNull();
  });

  test('matchedRemoved reaps matched rows older than matchedRetentionSeconds', async () => {
    await using host = await openMatchmakingWorld({
      seed: 51,
      tuning: { matchedRetentionSeconds: 10 },
    });
    const world = requireMmWorld(host.state);
    const a = await world.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
    });
    const b = await world.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
    });
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
    await world.runFor(60_000);
    expect((await world.tick()).matchedRemoved).toBe(2);
    expect(await a.status()).toBeNull();
    expect(await b.status()).toBeNull();
  });

  test('tick on an empty queue is a clean no-op', async () => {
    await using host = await openMatchmakingWorld({ seed: 52 });
    const world = requireMmWorld(host.state);
    expect(await world.tick()).toEqual({
      matches: 0,
      passes: 0,
      partitions: 0,
      expiredRemoved: 0,
      matchedRemoved: 0,
    });
  });
});
