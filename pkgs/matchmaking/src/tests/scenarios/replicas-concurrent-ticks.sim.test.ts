import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import type { TickResult } from '../../interface/matchmaking';
import type { StatusResult } from '../../interface/types';
import {
  join,
  lastTickAll,
  MATCHMAKING_PROPERTIES,
  matchmaking,
  matchmakingKnobs,
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
    await using run = await script(matchmaking, {
      seed: 210,
      knobs: matchmakingKnobs({ replicas: 3, backend: 'postgres' }),
      properties: MATCHMAKING_PROPERTIES,
    });
    for (let i = 0; i < 12; i += 1) {
      await run.elapse(1);
      await run.apply(join, {
        ref: `p${String(i)}`,
        input: { data: RatingAttr(1500 + i), formulas: [SimpleFormula] },
      });
    }
    await run.apply(tickAllWith, { maxPassesPerPartition: 4 });
    const results = (await run.observe(lastTickAll)) as TickResult[];
    const matchSum = results.reduce((n, r) => n + r.matches, 0);
    const ids = Object.values(await run.observe(participantIds));
    const { matchCount, waiting } = await assertMatchInvariants(run, ids);
    expect(matchSum).toBe(matchCount);
    expect(matchCount * 2 + waiting).toBe(ids.length);
    const all = (await run.observe(statuses)) as Record<
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
