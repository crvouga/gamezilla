import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { DistanceFormula } from '../../interface/types';
import { openMatchmakingWorld, requireMmWorld } from '../../sim/system';
import {
  expectMatched,
  KindAttr,
  RatingAttr,
  RegionAttr,
  registerTestCrashHandler,
  SkillAttr,
} from '../fixtures';

describe('matchmaking sim: formulas', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('combined numeric formula respects summed distance', async () => {
    await using host = await openMatchmakingWorld({ seed: 30 });
    const world = requireMmWorld(host.state);
    const closeFormula: DistanceFormula = {
      numeric: [
        { tag: RatingAttr, weight: 1 },
        { tag: SkillAttr, weight: 0.5 },
      ],
    };
    await world.join({
      data: { ...RatingAttr(1000), ...SkillAttr(50) },
      formulas: [closeFormula],
    });
    await world.join({
      data: { ...RatingAttr(1030), ...SkillAttr(80) },
      formulas: [closeFormula],
    });
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
  });

  test('categorical penalty needs wait across regions', async () => {
    await using host = await openMatchmakingWorld({ seed: 31 });
    const world = requireMmWorld(host.state);
    const regionFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      categorical: [{ tag: RegionAttr, penalty: 75 }],
    };
    await world.join({
      data: { ...RatingAttr(1000), ...RegionAttr('us-east') },
      formulas: [regionFormula],
    });
    await world.join({
      data: { ...RatingAttr(1000), ...RegionAttr('eu-west') },
      formulas: [regionFormula],
    });
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(0);
    await world.runFor(30_000);
    expect((await world.tick({ maxPassesPerPartition: 1 })).matches).toBe(1);
  });

  test('partition hard-equality never crosses even at max wait', async () => {
    await using host = await openMatchmakingWorld({ seed: 32 });
    const world = requireMmWorld(host.state);
    const kindFormula: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const a = await world.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [kindFormula],
    });
    const b = await world.join({
      data: { ...RatingAttr(1000), ...KindAttr('beta') },
      formulas: [kindFormula],
    });
    await world.never(
      async () =>
        (await a.status())?.status === 'matched' ||
        (await b.status())?.status === 'matched',
      { forMs: 60_000, stepMs: 5_000 }
    );
  });

  test('OR-of-formulas pairs when any pair is mutually accepted', async () => {
    await using host = await openMatchmakingWorld({ seed: 33 });
    const world = requireMmWorld(host.state);
    const alpha: DistanceFormula = {
      numeric: [{ tag: RatingAttr, weight: 1 }],
      partition: [{ tag: KindAttr }],
    };
    const a = await world.join({
      data: { ...RatingAttr(1000), ...KindAttr('alpha') },
      formulas: [alpha, alpha],
    });
    const b = await world.join({
      data: { ...RatingAttr(1010), ...KindAttr('alpha') },
      formulas: [alpha],
    });
    await world.tick({ maxPassesPerPartition: 1 });
    expect(expectMatched(await a.status()).peers[0]?.participantId).toBe(
      b.participantId
    );
  });
});
