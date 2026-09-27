import { describe, expect, test } from 'bun:test';
import { EXAMPLE_DST_FAULTS_HOST, exampleSystem } from '@pkgs/sync-engine/sim';

const TIME = { weight: 1, minMs: 0, maxMs: 40 } as const;

/** Seeded walk over the whole pool; the recorded choices are the fingerprint. */
async function walkChoices(seed: number, steps: number): Promise<string> {
  await using s = await exampleSystem.run({ seed, args: { clientCount: 2 } });
  const w = await s.randomActions({ steps, time: TIME });
  return JSON.stringify(w.steps);
}

/**
 * Two framework contracts of the explore pool. Every behavior the pool's
 * walks used to draw is a step of `specs/sync/note-replication.qnt`; these
 * two cannot be:
 *
 * - Same seed, same walk: reproducing a run from its seed compares two runs,
 *   not a product state after a step.
 * - The lossy host loses, repeats and delays every hop at random, so replies
 *   get lost and devices retry on backoffs the model never drew: no step
 *   boundary has a state the model can name (tried as a model action; it
 *   diverged on most traces). The claim is only the standing sequence-order
 *   property.
 */
describe('explore pool', () => {
  test('same seed → identical walk choices', async () => {
    expect(await walkChoices(123, 12)).toBe(await walkChoices(123, 12));
  });

  test(
    'lossy faults host keeps sequence order (best-effort settle)',
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
