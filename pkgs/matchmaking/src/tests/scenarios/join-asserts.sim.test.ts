import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { AttributeState } from '@pkgs/attribute';
import { MATCHMAKING_PAYLOAD_LIMITS } from '../../interface/payload-limits';
import { openMatchmakingWorld } from '../../sim/system';
import { NameAttr, RatingAttr, registerTestCrashHandler } from '../fixtures';

const SimpleFormula = { numeric: [{ tag: RatingAttr, weight: 1 }] };

describe('matchmaking sim: join asserts', () => {
  let disposeCrash: () => void;
  beforeAll(() => {
    disposeCrash = registerTestCrashHandler();
  });
  afterAll(() => {
    disposeCrash();
  });

  test('throws on empty formulas array', async () => {
    await using host = await openMatchmakingWorld({ seed: 10 });
    const world = host.facade;
    await expect(
      world.join({ data: RatingAttr(1000), formulas: [] })
    ).rejects.toThrow();
  });

  test('throws on empty formula (no terms)', async () => {
    await using host = await openMatchmakingWorld({ seed: 11 });
    const world = host.facade;
    await expect(
      world.join({ data: RatingAttr(1000), formulas: [{ numeric: [] }] })
    ).rejects.toThrow();
  });

  test('throws on negative numeric weight', async () => {
    await using host = await openMatchmakingWorld({ seed: 12 });
    const world = host.facade;
    await expect(
      world.join({
        data: RatingAttr(1000),
        formulas: [{ numeric: [{ tag: RatingAttr, weight: -1 }] }],
      })
    ).rejects.toThrow();
  });

  test('throws when required numeric attr is missing', async () => {
    await using host = await openMatchmakingWorld({ seed: 13 });
    const world = host.facade;
    await expect(
      world.join({ data: NameAttr('orphan'), formulas: [SimpleFormula] })
    ).rejects.toThrow();
  });

  test('throws when data contains a non-keyword key', async () => {
    await using host = await openMatchmakingWorld({ seed: 14 });
    const world = host.facade;
    await expect(
      world.join({
        data: { badkey: 1 } as unknown as AttributeState,
        formulas: [SimpleFormula],
      })
    ).rejects.toThrow();
  });

  test('rejects groupSize out of range', async () => {
    await using host = await openMatchmakingWorld({ seed: 15 });
    const world = host.facade;
    await expect(
      world.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        groupSize: 1,
      })
    ).rejects.toThrow();
    await expect(
      world.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        groupSize: 17,
      })
    ).rejects.toThrow();
  });

  test('rejects priority out of range', async () => {
    await using host = await openMatchmakingWorld({ seed: 16 });
    const world = host.facade;
    await expect(
      world.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        priority: -1001,
      })
    ).rejects.toThrow();
    await expect(
      world.join({
        data: RatingAttr(1000),
        formulas: [SimpleFormula],
        priority: 1001,
      })
    ).rejects.toThrow();
  });

  test('MATCHMAKING_PAYLOAD_LIMITS exposes positive caps', () => {
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxDataKeys).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxFormulas).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxTermsPerFormula).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxStringBytes).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes).toBeGreaterThan(0);
  });
});
