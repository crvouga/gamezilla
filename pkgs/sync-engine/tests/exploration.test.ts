import { describe, expect, test } from 'bun:test';
import { EXAMPLE_DST_FAULTS_HOST, exampleSystem } from '@pkgs/sync-engine/sim';

const TIME = { weight: 1, minMs: 0, maxMs: 40 } as const;

/**
 * The pool slice `specs/sync/note-replication.qnt` does not draw: the rest of
 * the example domain (folders, shared spaces, silent catalog inserts) and the
 * faults whose effect on unsent notes has no product rule yet — a full
 * device, an app that fails to open, a revoked or outdated sign-in, a
 * damaged unsent edit, data cleared while edits wait, pruned write records,
 * single-channel cut-outs, dropped publishes, a second engine on one
 * database. Connectivity and crashes are in the slice so they interleave.
 * Walks over it can only claim the standing properties and convergence; once
 * a fault's rule is decided it moves into the model.
 */
const UNMODELED = [
  'domain',
  'server',
  'armStoragePressure',
  'failNextOpen',
  'auth',
  'protocolCut',
  'tamperLocalStorage',
  'clearLocalData',
  'pruneServerArtifacts',
  'partition',
  'restoreNetwork',
  'setFaults',
  'freeze',
  'thaw',
  'publishFault',
  'armPubsubFault',
  'addPeerEngine',
  'disconnect',
  'connect',
  'crash',
  'restart',
] as const;

/** Seeded walk over the whole pool; the recorded choices are the fingerprint. */
async function walkChoices(seed: number, steps: number): Promise<string> {
  await using s = await exampleSystem.run({ seed, args: { clientCount: 2 } });
  const w = await s.randomActions({ steps, time: TIME });
  return JSON.stringify(w.steps);
}

describe('explore pool', () => {
  // Framework contract: a seed replays the same walk.
  test('same seed → identical walk choices', async () => {
    expect(await walkChoices(123, 12)).toBe(await walkChoices(123, 12));
  });

  test(
    'walks over the unmodeled slice keep the standing properties',
    async () => {
      for (const seed of [1, 2, 3, 7, 11, 13, 17, 31, 42, 99]) {
        const report = await exampleSystem.explore({
          seed,
          episodes: 1,
          steps: 16,
          args: { clientCount: 3 },
          actions: UNMODELED,
          stopOnViolation: true,
          time: TIME,
        });
        expect(report.failures.map((f) => f.error)).toEqual([]);
      }
    },
    { timeout: 180_000 }
  );

  // The lossy host perturbs every hop of the run at once, which a model
  // step cannot express; it claims only that sequence order survives.
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
