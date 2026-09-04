import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { TickResult } from '../../interface/matchmaking';
import type { DistanceFormula, StatusResult } from '../../interface/types';
import {
  join,
  lastTick,
  matched,
  matchmaking,
  participantIds,
  statusOf,
  stepTime,
  tick,
} from '../../sim/scenario';
import {
  expectMatched,
  KindAttr,
  RatingAttr,
  RegionAttr,
  registerTestCrashHandler,
  SkillAttr,
} from '../fixtures';

const onePass = { opts: { maxPassesPerPartition: 1 } };

describe('matchmaking sim: formulas', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('combined numeric formula respects summed distance', async () => {
    await using s = await matchmaking.script({ seed: 30 });
    const closeFormula: DistanceFormula = {
      numeric: [
        { tag: RatingAttr, weight: 1 },
        { tag: SkillAttr, weight: 0.5 },
      ],
    };
    await s.apply(join, {
      ref: 'a',
      input: {
        data: { ...RatingAttr(1000), ...SkillAttr(50) },
        formulas: [closeFormula],
      },
    });
    await s.apply(join, {
      ref: 'b',
      input: {
        data: { ...RatingAttr(1030), ...SkillAttr(80) },
        formulas: [closeFormula],
      },
    });
    await s.apply(tick, onePass);
    expect(((await s.observe(lastTick)) as TickResult).matches).toBe(1);
  });

  test('categorical penalty needs wait across regions', async () => {
    await using s = await matchmaking.script({ seed: 31 });
    const regionFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      categorical: [{ tag: RegionAttr, penalty: 75 }],
    };
    await s.apply(join, {
      ref: 'a',
      input: {
        data: { ...RatingAttr(1000), ...RegionAttr('us-east') },
        formulas: [regionFormula],
      },
    });
    await s.apply(join, {
      ref: 'b',
      input: {
        data: { ...RatingAttr(1000), ...RegionAttr('eu-west') },
        formulas: [regionFormula],
      },
    });
    await s.apply(tick, onePass);
    expect(((await s.observe(lastTick)) as TickResult).matches).toBe(0);
    await s.elapse(30_000);
    await s.apply(tick, onePass);
    expect(((await s.observe(lastTick)) as TickResult).matches).toBe(1);
  });

  test('partition hard-equality never crosses even at max wait', async () => {
    await using s = await matchmaking.script({ seed: 32 });
    const kindFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    await s.apply(join, {
      ref: 'a',
      input: {
        data: { ...RatingAttr(1000), ...KindAttr('alpha') },
        formulas: [kindFormula],
      },
    });
    await s.apply(join, {
      ref: 'b',
      input: {
        data: { ...RatingAttr(1000), ...KindAttr('beta') },
        formulas: [kindFormula],
      },
    });
    let waited = 0;
    while (waited < 60_000) {
      if (await s.observe(matched, ['a', 'b'])) {
        throw new Error(`never: matched at ${String(waited)}ms`);
      }
      await s.apply(stepTime, 5_000);
      waited += 5_000;
    }
  });

  test('OR-of-formulas pairs when any pair is mutually accepted', async () => {
    await using s = await matchmaking.script({ seed: 33 });
    const alpha: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    await s.apply(join, {
      ref: 'a',
      input: {
        data: { ...RatingAttr(1000), ...KindAttr('alpha') },
        formulas: [alpha, alpha],
      },
    });
    await s.apply(join, {
      ref: 'b',
      input: {
        data: { ...RatingAttr(1010), ...KindAttr('alpha') },
        formulas: [alpha],
      },
    });
    await s.apply(tick, onePass);
    const ids = await s.observe(participantIds);
    const a = expectMatched((await s.observe(statusOf, 'a')) as StatusResult);
    expect(a.peers[0]?.participantId).toBe(ids['b']);
  });
});
