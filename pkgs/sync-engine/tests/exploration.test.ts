import { describe, expect, test } from 'bun:test';
import {
  EXAMPLE_DST_FAULTS_HOST,
  exampleSystem,
  walkThenInSync,
} from '@pkgs/sync-engine/sim';

const TIME = { weight: 1, minMs: 0, maxMs: 40 } as const;

/** Seeded walk over the whole pool; the recorded choices are the fingerprint. */
async function walkChoices(seed: number, steps: number): Promise<string> {
  await using s = await exampleSystem.run({ seed, args: { clientCount: 2 } });
  const w = await s.randomActions({ steps, time: TIME });
  return JSON.stringify(w.steps);
}

/**
 * Framework contracts for the explore pool: a seed replays the same walk, and
 * walks over the whole fault pool (skew, storage pressure, broker crashes, …
 * — faults `note-replication.qnt` does not model) keep the standing
 * properties and converge.
 */
describe('explore pool', () => {
  test('same seed → identical walk choices', async () => {
    expect(await walkChoices(123, 12)).toBe(await walkChoices(123, 12));
  });

  test(
    'seed corpus staysInSync (explore, one episode per seed)',
    async () => {
      for (const seed of [1, 2, 3, 7, 11, 13, 17, 31, 42, 99]) {
        const report = await exampleSystem.explore({
          seed,
          episodes: 1,
          steps: 16,
          args: { clientCount: 2 },
          stopOnViolation: true,
          time: TIME,
        });
        expect(report.failures.map((f) => f.error)).toEqual([]);
      }
    },
    { timeout: 180_000 }
  );

  test(
    'three clients with longer skew/crash workload converge',
    async () => {
      await walkThenInSync({
        seed: 404,
        steps: 32,
        args: { clientCount: 3 },
      });
    },
    { timeout: 120_000 }
  );

  test(
    'extended corpus profile (3 clients / 36 steps) staysInSync',
    async () => {
      for (const seed of [101, 202, 404, 505]) {
        await walkThenInSync({ seed, steps: 36, args: { clientCount: 3 } });
      }
    },
    { timeout: 180_000 }
  );

  test(
    'lossy faults host still settles (best-effort)',
    async () => {
      const report = await exampleSystem.explore({
        runtime: EXAMPLE_DST_FAULTS_HOST,
        seed: 777,
        episodes: 1,
        steps: 12,
        args: { clientCount: 2 },
        stopOnViolation: true,
        time: TIME,
      });
      for (const failure of report.failures) {
        expect(failure.error.includes('seq-monotonicity')).toBe(false);
      }
    },
    { timeout: 60_000 }
  );
});
