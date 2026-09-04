import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { TickResult } from '../../interface/matchmaking';
import type {
  DistanceFormula,
  UpdateFormulasResult,
} from '../../interface/types';
import {
  join,
  lastTick,
  lastUpdate,
  matchmaking,
  tick,
  updateFormulas,
} from '../../sim/scenario';
import { RatingAttr, registerTestCrashHandler } from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };
const onePass = { opts: { maxPassesPerPartition: 1 } };
const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';

describe('matchmaking sim: updateFormulas', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('widening criteria mid-wait allows a previously-rejected peer', async () => {
    await using s = await matchmaking.script({ seed: 100 });
    const tight: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 5, radiusGrowthPerSecond: 0, maxRadius: 5 },
    };
    const open: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 200, radiusGrowthPerSecond: 0, maxRadius: 200 },
    };
    await s.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [tight] },
    });
    await s.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1050), formulas: [open] },
    });
    await s.apply(tick, onePass);
    expect(((await s.observe(lastTick)) as TickResult).matches).toBe(0);
    await s.apply(updateFormulas, { ref: 'a', formulas: [open] });
    expect(
      ((await s.observe(lastUpdate)) as UpdateFormulasResult).updated
    ).toBe(true);
    await s.apply(tick, onePass);
    expect(((await s.observe(lastTick)) as TickResult).matches).toBe(1);
  });

  test('returns updated:false for unknown / matched', async () => {
    await using s = await matchmaking.script({ seed: 101 });
    await s.apply(updateFormulas, {
      participantId: UNKNOWN_ID,
      formulas: [SimpleFormula],
    });
    expect(
      ((await s.observe(lastUpdate)) as UpdateFormulasResult).updated
    ).toBe(false);
    await s.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
    });
    await s.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1010), formulas: [SimpleFormula] },
    });
    await s.apply(tick, onePass);
    await s.apply(updateFormulas, { ref: 'a', formulas: [SimpleFormula] });
    expect(
      ((await s.observe(lastUpdate)) as UpdateFormulasResult).updated
    ).toBe(false);
  });
});
