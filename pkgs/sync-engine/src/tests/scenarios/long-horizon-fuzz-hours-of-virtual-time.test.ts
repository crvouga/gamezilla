import { describe, expect, test } from 'bun:test';

import { runSeed, seedsFromEnv } from '../../domain-packs/notes-app';

/** Committed corpus — modest multi-client profiles that settle reliably. */
const CORPUS = [1, 7, 11, 17, 31, 42, 99, 404] as const;

describe('long horizon fuzz hours of virtual time', () => {
  test(
    'larger runSeed profile + corpus seeds converge',
    async () => {
      const fromEnv = seedsFromEnv(
        process.env as { SYNC_SIM_SEED?: string; SYNC_SIM_SEEDS?: string }
      );
      const seeds = fromEnv.length > 0 ? fromEnv : [...CORPUS];
      for (const seed of seeds) {
        const result = await runSeed({
          seed,
          steps: 36,
          clientCount: 3,
          dstFaults: true,
        });
        if (!result.ok) {
          throw new Error(
            `long-horizon failed seed=${result.seed.toString(16)} steps=${result.steps}: ${result.error}`
          );
        }
        expect(result.ok).toBe(true);
      }
    },
    { timeout: 240_000 }
  );

  test(
    'skew/crash-friendly mid profile still settles',
    async () => {
      const result = await runSeed({
        seed: 909,
        steps: 48,
        clientCount: 3,
        dstFaults: true,
      });
      if (!result.ok) {
        throw new Error(
          `long-horizon mid profile failed seed=${result.seed.toString(16)}: ${result.error}`
        );
      }
      expect(result.ok).toBe(true);
    },
    { timeout: 120_000 }
  );
});
