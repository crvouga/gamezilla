import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { TickResult } from '../../interface/matchmaking';
import type { StatusResult } from '../../interface/types';
import {
  join,
  lastTickAll,
  matchmaking,
  participantIds,
  statuses,
  tickAllWith,
} from '../../sim/scenario';
import {
  assertMatchInvariants,
  RatingAttr,
  registerTestCrashHandler,
} from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: concurrent replica ticks', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('tickAll never double-matches a participant', async () => {
    await using s = await matchmaking.script({
      seed: 210,
      args: { replicas: 3, backend: 'postgres' },
    });
    for (let i = 0; i < 12; i += 1) {
      await s.elapse(1);
      await s.apply(join, {
        ref: `p${String(i)}`,
        input: { data: RatingAttr(1500 + i), formulas: [SimpleFormula] },
      });
    }
    await s.apply(tickAllWith, { maxPassesPerPartition: 4 });
    const results = (await s.observe(lastTickAll)) as TickResult[];
    const matchSum = results.reduce((n, r) => n + r.matches, 0);
    const ids = Object.values(await s.observe(participantIds));
    const { matchCount, waiting } = await assertMatchInvariants(s, ids);
    expect(matchSum).toBe(matchCount);
    expect(matchCount * 2 + waiting).toBe(ids.length);
    const all = (await s.observe(statuses)) as Record<
      string,
      StatusResult | null
    >;
    for (const st of Object.values(all)) {
      expect(
        st === null || st.status === 'waiting' || st.status === 'matched'
      ).toBe(true);
    }
  });
});
