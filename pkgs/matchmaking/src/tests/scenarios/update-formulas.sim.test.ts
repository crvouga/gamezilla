import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import type { TickResult } from '../../interface/matchmaking';
import type {
  DistanceFormula,
  UpdateFormulasResult,
} from '../../interface/types';
import {
  join,
  lastTick,
  lastUpdate,
  MATCHMAKING_PROPERTIES,
  matchmaking,
  matchmakingKnobs,
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
    await using run = await script(matchmaking, {
      seed: 100,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const tight: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 5, radiusGrowthPerSecond: 0, maxRadius: 5 },
    };
    const open: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      radius: { baseRadius: 200, radiusGrowthPerSecond: 0, maxRadius: 200 },
    };
    await run.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [tight] },
    });
    await run.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1050), formulas: [open] },
    });
    await run.apply(tick, onePass);
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(0);
    await run.apply(updateFormulas, { ref: 'a', formulas: [open] });
    expect(
      ((await run.observe(lastUpdate)) as UpdateFormulasResult).updated
    ).toBe(true);
    await run.apply(tick, onePass);
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(1);
  });

  test('returns updated:false for unknown / matched', async () => {
    await using run = await script(matchmaking, {
      seed: 101,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await run.apply(updateFormulas, {
      participantId: UNKNOWN_ID,
      formulas: [SimpleFormula],
    });
    expect(
      ((await run.observe(lastUpdate)) as UpdateFormulasResult).updated
    ).toBe(false);
    await run.apply(join, {
      ref: 'a',
      input: { data: RatingAttr(1000), formulas: [SimpleFormula] },
    });
    await run.apply(join, {
      ref: 'b',
      input: { data: RatingAttr(1010), formulas: [SimpleFormula] },
    });
    await run.apply(tick, onePass);
    await run.apply(updateFormulas, { ref: 'a', formulas: [SimpleFormula] });
    expect(
      ((await run.observe(lastUpdate)) as UpdateFormulasResult).updated
    ).toBe(false);
  });
});
