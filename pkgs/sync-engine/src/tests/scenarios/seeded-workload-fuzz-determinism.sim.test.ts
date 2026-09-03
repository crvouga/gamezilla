import { describe, expect, test } from 'bun:test';
import { start } from '@pkgs/dst';
import {
  acmeDraws,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  runAcmeSeed,
  seedsFromEnv,
  setNote,
  syncVirtualHost,
} from '../apps/acme';

describe('seeded workload fuzz determinism', () => {
  test('same seed runAcmeSeed is deterministic', async () => {
    const first = await runAcmeSeed({ seed: 123, steps: 12, clientCount: 2 });
    const second = await runAcmeSeed({ seed: 123, steps: 12, clientCount: 2 });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect(first).toEqual(second);
  });

  test(
    'seed corpus + env seeds converge',
    async () => {
      const corpus = [1, 2, 3, 7, 11, 13, 17, 31, 42, 99];
      const fromEnv = seedsFromEnv(
        process.env as { SYNC_SIM_SEED?: string; SYNC_SIM_SEEDS?: string }
      );
      const seeds = fromEnv.length > 0 ? fromEnv : corpus;
      for (const seed of seeds) {
        const result = await runAcmeSeed({
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
    { timeout: 180_000 }
  );

  test(
    'three clients with longer skew/crash workload converge',
    async () => {
      const result = await runAcmeSeed({
        seed: 404,
        steps: 32,
        clientCount: 3,
        sampleFaults: false,
      });
      if (!result.ok) {
        throw new Error(
          `fuzz failed seed=${result.seed.toString(16)} steps=${result.steps}: ${result.error}`
        );
      }
      expect(result.ok).toBe(true);
    },
    { timeout: 120_000 }
  );

  test(
    'extended corpus profile (3 clients / 36 steps) converges',
    async () => {
      const corpus = [101, 202, 404, 505];
      for (const seed of corpus) {
        const result = await runAcmeSeed({
          seed,
          steps: 36,
          clientCount: 3,
          sampleFaults: false,
        });
        if (!result.ok) {
          throw new Error(
            `extended fuzz failed seed=${result.seed.toString(16)} steps=${result.steps}: ${result.error}`
          );
        }
        expect(result.ok).toBe(true);
      }
    },
    { timeout: 180_000 }
  );

  test(
    'lossy faults sample still settles (best-effort)',
    async () => {
      const result = await runAcmeSeed({
        seed: 777,
        steps: 12,
        clientCount: 2,
        sampleFaults: true,
      });
      if (!result.ok) {
        expect(result.error.includes('seq-monotonicity')).toBe(false);
        return;
      }
      expect(result.ok).toBe(true);
    },
    { timeout: 60_000 }
  );

  test('single mutate then fuzz-style settle', async () => {
    await using run = await start(acmeSystem, {
      seed: 88,
      host: syncVirtualHost(),
      draws: acmeDraws({ clientCount: 0 }),
      properties: [],
    });

    await run.apply(addClient, 'alice');
    await run.apply(mutate, 'alice', setNote, { id: 'n1', body: 'ok' });
    await expectConverged(run);
  });
});
