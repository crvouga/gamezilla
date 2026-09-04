import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { StatusResult } from '../../interface/types';
import { join, matchmaking, statusOf, tick } from '../../sim/scenario';
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
    await using s = await matchmaking.script({ seed: 90 });
    const meta = { route: 'vip', n: 1 };
    await s.apply(join, {
      ref: 'a',
      input: {
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        metadata: meta,
      },
    });
    expect(((await s.observe(statusOf, 'a')) as StatusResult).metadata).toEqual(
      meta
    );
    await s.apply(join, {
      ref: 'b',
      input: {
        data: RatingAttr(1010),
        formulas: [SimpleFormula],
        metadata: { other: true },
      },
    });
    await s.apply(tick, { opts: { maxPassesPerPartition: 1 } });
    const matched = expectMatched(
      (await s.observe(statusOf, 'a')) as StatusResult
    );
    expect(matched.metadata).toEqual(meta);
    expect(matched.peers[0]?.metadata).toEqual({ other: true });
  });

  test('metadata cap enforced', async () => {
    await using s = await matchmaking.script({ seed: 91 });
    await expect(
      s.apply(join, {
        ref: 'a',
        input: {
          data: RatingAttr(1000),
          formulas: [SimpleFormula],
          metadata: { pad: 'x'.repeat(2000) },
        },
      })
    ).rejects.toThrow();
  });
});
