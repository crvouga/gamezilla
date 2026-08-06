import { describe, expect, test } from 'bun:test';

import { runSeed, seedsFromEnv } from './replay';

describe('sim world fuzz', () => {
  test(
    'seed corpus + env seeds converge',
    async () => {
      const corpus = [1, 2, 3, 42, 99];
      const fromEnv = seedsFromEnv(
        process.env as { SYNC_SIM_SEED?: string; SYNC_SIM_SEEDS?: string }
      );
      const seeds = fromEnv.length > 0 ? fromEnv : corpus;
      for (const seed of seeds) {
        const result = await runSeed({
          seed,
          steps: 16,
          clientCount: 2,
          sampleFaults: false,
        });
        if (!result.ok) {
          throw new Error(
            `fuzz failed seed=${result.seed.toString(16)} steps=${result.steps}: ${result.error}`
          );
        }
        expect(result.ok).toBe(true);
      }
    },
    { timeout: 60_000 }
  );

  test(
    'lossy faults sample still settles (best-effort)',
    async () => {
      const result = await runSeed({
        seed: 777,
        steps: 12,
        clientCount: 2,
        sampleFaults: true,
      });
      // Lossy mesh may fail settle; must not corrupt seq monotonicity.
      if (!result.ok) {
        expect(result.error.includes('seq-monotonicity')).toBe(false);
        return;
      }
      expect(result.ok).toBe(true);
    },
    { timeout: 60_000 }
  );
});
