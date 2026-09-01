import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { openMatchmakingWorld } from '../../sim/system';
import {
  expectMatched,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: metadata', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('metadata round-trips through waiting and matched status', async () => {
    await using host = await openMatchmakingWorld({ seed: 90 });
    const world = host.facade;
    const meta = { route: 'vip', n: 1 };
    const a = await world.join({
      data: RatingAttr(1000),
      formulas: [SimpleFormula],
      metadata: meta,
    });
    expect((await a.status())?.metadata).toEqual(meta);
    await world.join({
      data: RatingAttr(1010),
      formulas: [SimpleFormula],
      metadata: { other: true },
    });
    await world.tick({ maxPassesPerPartition: 1 });
    const matched = expectMatched(await a.status());
    expect(matched.metadata).toEqual(meta);
    expect(matched.peers[0]?.metadata).toEqual({ other: true });
  });

  test('metadata cap enforced', async () => {
    await using host = await openMatchmakingWorld({ seed: 91 });
    const world = host.facade;
    await expect(
      world.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        metadata: { pad: 'x'.repeat(2000) },
      })
    ).rejects.toThrow();
  });
});
