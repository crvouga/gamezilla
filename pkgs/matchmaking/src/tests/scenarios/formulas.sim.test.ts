import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { script } from '@pkgs/dst';
import type { TickResult } from '../../interface/matchmaking';
import type { DistanceFormula, StatusResult } from '../../interface/types';
import {
  join,
  lastTick,
  MATCHMAKING_PROPERTIES,
  matched,
  matchmaking,
  matchmakingKnobs,
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
    await using run = await script(matchmaking, {
      seed: 30,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const closeFormula: DistanceFormula = {
      numeric: [
        { tag: RatingAttr, weight: 1 },
        { tag: SkillAttr, weight: 0.5 },
      ],
    };
    await run.apply(join, {
      ref: 'a',
      input: {
        data: { ...RatingAttr(1000), ...SkillAttr(50) },
        formulas: [closeFormula],
      },
    });
    await run.apply(join, {
      ref: 'b',
      input: {
        data: { ...RatingAttr(1030), ...SkillAttr(80) },
        formulas: [closeFormula],
      },
    });
    await run.apply(tick, onePass);
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(1);
  });

  test('categorical penalty needs wait across regions', async () => {
    await using run = await script(matchmaking, {
      seed: 31,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const regionFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      categorical: [{ tag: RegionAttr, penalty: 75 }],
    };
    await run.apply(join, {
      ref: 'a',
      input: {
        data: { ...RatingAttr(1000), ...RegionAttr('us-east') },
        formulas: [regionFormula],
      },
    });
    await run.apply(join, {
      ref: 'b',
      input: {
        data: { ...RatingAttr(1000), ...RegionAttr('eu-west') },
        formulas: [regionFormula],
      },
    });
    await run.apply(tick, onePass);
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(0);
    await run.elapse(30_000);
    await run.apply(tick, onePass);
    expect(((await run.observe(lastTick)) as TickResult).matches).toBe(1);
  });

  test('partition hard-equality never crosses even at max wait', async () => {
    await using run = await script(matchmaking, {
      seed: 32,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const kindFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    await run.apply(join, {
      ref: 'a',
      input: {
        data: { ...RatingAttr(1000), ...KindAttr('alpha') },
        formulas: [kindFormula],
      },
    });
    await run.apply(join, {
      ref: 'b',
      input: {
        data: { ...RatingAttr(1000), ...KindAttr('beta') },
        formulas: [kindFormula],
      },
    });
    let waited = 0;
    while (waited < 60_000) {
      if (await run.observe(matched, ['a', 'b'])) {
        throw new Error(`never: matched at ${String(waited)}ms`);
      }
      await run.apply(stepTime, 5_000);
      waited += 5_000;
    }
  });

  test('OR-of-formulas pairs when any pair is mutually accepted', async () => {
    await using run = await script(matchmaking, {
      seed: 33,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    const alpha: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    await run.apply(join, {
      ref: 'a',
      input: {
        data: { ...RatingAttr(1000), ...KindAttr('alpha') },
        formulas: [alpha, alpha],
      },
    });
    await run.apply(join, {
      ref: 'b',
      input: {
        data: { ...RatingAttr(1010), ...KindAttr('alpha') },
        formulas: [alpha],
      },
    });
    await run.apply(tick, onePass);
    const ids = await run.observe(participantIds);
    const a = expectMatched((await run.observe(statusOf, 'a')) as StatusResult);
    expect(a.peers[0]?.participantId).toBe(ids['b']);
  });
});
