import { describe, expect, test } from 'bun:test';
import {
  ACME_DST_FAULTS_HOST,
  acmeSystem,
  addClient,
  expectConverged,
  mutate,
  setNote,
} from '../apps/acme';
import { walkThenConverge } from '../apps/acme/walk-converge';

const TIME = { weight: 1, minMs: 0, maxMs: 40 } as const;

/** Seeded walk over the whole pool; the recorded choices are the fingerprint. */
async function walkChoices(seed: number, steps: number): Promise<string> {
  await using s = await acmeSystem.script({ seed, args: { clientCount: 2 } });
  const w = await s.walk({ steps, time: TIME });
  return JSON.stringify(w.choices);
}

describe('seeded workload fuzz determinism', () => {
  test('same seed → identical walk choices', async () => {
    expect(await walkChoices(123, 12)).toBe(await walkChoices(123, 12));
  });

  test(
    'seed corpus converges (explore, one episode per seed)',
    async () => {
      for (const seed of [1, 2, 3, 7, 11, 13, 17, 31, 42, 99]) {
        const report = await acmeSystem.explore({
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
      await walkThenConverge({
        seed: 404,
        steps: 32,
        args: { clientCount: 3 },
      });
    },
    { timeout: 120_000 }
  );

  test(
    'extended corpus profile (3 clients / 36 steps) converges',
    async () => {
      for (const seed of [101, 202, 404, 505]) {
        await walkThenConverge({ seed, steps: 36, args: { clientCount: 3 } });
      }
    },
    { timeout: 180_000 }
  );

  test(
    'lossy faults host still settles (best-effort)',
    async () => {
      const report = await acmeSystem.explore({
        host: ACME_DST_FAULTS_HOST,
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

  test('single mutate then fuzz-style settle', async () => {
    await using s = await acmeSystem.script({
      seed: 88,
      args: { clientCount: 0 },
    });

    await s.apply(addClient, 'alice');
    await s.apply(mutate, 'alice', setNote, { id: 'n1', body: 'ok' });
    await expectConverged(s);
  });
});
