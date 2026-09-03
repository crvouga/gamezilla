import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { AttributeState } from '@pkgs/attribute';
import { script } from '@pkgs/dst';
import { MATCHMAKING_PAYLOAD_LIMITS } from '../../interface/payload-limits';
import {
  join,
  MATCHMAKING_PROPERTIES,
  matchmaking,
  matchmakingKnobs,
} from '../../sim/scenario';
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
    await using run = await script(matchmaking, {
      seed: 10,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await expect(
      run.apply(join, {
        ref: 'p',
        input: { data: RatingAttr(1000), formulas: [] },
      })
    ).rejects.toThrow();
  });

  test('throws on empty formula (no terms)', async () => {
    await using run = await script(matchmaking, {
      seed: 11,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await expect(
      run.apply(join, {
        ref: 'p',
        input: { data: RatingAttr(1000), formulas: [{ numeric: [] }] },
      })
    ).rejects.toThrow();
  });

  test('throws on negative numeric weight', async () => {
    await using run = await script(matchmaking, {
      seed: 12,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await expect(
      run.apply(join, {
        ref: 'p',
        input: {
          data: RatingAttr(1000),
          formulas: [{ numeric: [{ tag: RatingAttr, weight: -1 }] }],
        },
      })
    ).rejects.toThrow();
  });

  test('throws when required numeric attr is missing', async () => {
    await using run = await script(matchmaking, {
      seed: 13,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await expect(
      run.apply(join, {
        ref: 'p',
        input: { data: NameAttr('orphan'), formulas: [SimpleFormula] },
      })
    ).rejects.toThrow();
  });

  test('throws when data contains a non-keyword key', async () => {
    await using run = await script(matchmaking, {
      seed: 14,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    await expect(
      run.apply(join, {
        ref: 'p',
        input: {
          data: { badkey: 1 } as unknown as AttributeState,
          formulas: [SimpleFormula],
        },
      })
    ).rejects.toThrow();
  });

  test('rejects groupSize out of range', async () => {
    await using run = await script(matchmaking, {
      seed: 15,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    for (const groupSize of [1, 17]) {
      await expect(
        run.apply(join, {
          ref: `p${String(groupSize)}`,
          input: {
            data: RatingAttr(1000),
            formulas: [SimpleFormula],
            groupSize,
          },
        })
      ).rejects.toThrow();
    }
  });

  test('rejects priority out of range', async () => {
    await using run = await script(matchmaking, {
      seed: 16,
      knobs: matchmakingKnobs(),
      properties: MATCHMAKING_PROPERTIES,
    });
    for (const priority of [-1001, 1001]) {
      await expect(
        run.apply(join, {
          ref: `p${String(priority)}`,
          input: {
            data: RatingAttr(1000),
            formulas: [SimpleFormula],
            priority,
          },
        })
      ).rejects.toThrow();
    }
  });

  test('MATCHMAKING_PAYLOAD_LIMITS exposes positive caps', () => {
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxDataKeys).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxFormulas).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxTermsPerFormula).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxStringBytes).toBeGreaterThan(0);
    expect(MATCHMAKING_PAYLOAD_LIMITS.maxMetadataBytes).toBeGreaterThan(0);
  });
});
