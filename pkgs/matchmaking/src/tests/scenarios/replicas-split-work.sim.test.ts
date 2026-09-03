import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { StatusResult } from '../../interface/types';
import {
  join,
  participantIds,
  passTime,
  startMatchmaking,
  statuses,
  tickAllWith,
} from '../../sim/scenario';
import {
  assertMatchInvariants,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: replica split work', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('maxPairsPerPass:1 still pairs everyone across concurrent workers', async () => {
    await using run = await startMatchmaking({
      seed: 220,
      replicas: 2,
      backend: 'postgres',
      tuning: { maxPairsPerPass: 1 },
    });
    for (let i = 0; i < 8; i += 1) {
      await run.apply(passTime, 1);
      await run.apply(join, {
        ref: `p${String(i)}`,
        input: { data: RatingAttr(1000 + i), formulas: [SimpleFormula] },
      });
    }
    for (let round = 0; round < 8; round += 1) {
      await run.apply(tickAllWith, { maxPassesPerPartition: 1 });
      const all = (await run.observe(statuses())) as Record<
        string,
        StatusResult | null
      >;
      if (Object.values(all).every((s) => s?.status === 'matched')) break;
    }
    const ids = Object.values(await run.observe(participantIds));
    const { matchCount, waiting } = await assertMatchInvariants(run, ids);
    expect(waiting).toBe(0);
    expect(matchCount).toBe(4);
  });
});
