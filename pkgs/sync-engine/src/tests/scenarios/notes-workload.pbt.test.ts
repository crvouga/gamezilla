import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { runNotesSeed } from '../../domain-packs/notes-app/replay';
import {
  runShrunkWorldProperty,
  worldPropertyInputs,
} from '../arbitraries/world-runner';

describe('notes workload PBT / DST', () => {
  test(
    'fc.commands sequences replay on SimWorld and converge',
    async () => {
      await assertDstProperty(
        'workload command replay',
        fc.asyncProperty(
          worldPropertyInputs(12),
          async ([seed, knobs, cmds]) => {
            await runShrunkWorldProperty({ seed, knobs, cmds });
          }
        )
      );
    },
    { timeout: 120_000 }
  );

  test(
    'runSeed is deterministic for a generated seed',
    async () => {
      await assertDstProperty(
        'runSeed determinism',
        fc.asyncProperty(fc.integer({ min: 1, max: 10_000 }), async (seed) => {
          const a = await runNotesSeed({
            seed,
            steps: 8,
            clientCount: 2,
            sampleFaults: false,
          });
          const b = await runNotesSeed({
            seed,
            steps: 8,
            clientCount: 2,
            sampleFaults: false,
          });
          if (!a.ok) {
            throw new Error(`runSeed failed: ${a.error}`);
          }
          if (!b.ok) {
            throw new Error(`runSeed failed: ${b.error}`);
          }
          if (a.ok !== b.ok || a.steps !== b.steps) {
            throw new Error('runSeed not deterministic');
          }
          if (a.ok && b.ok && a.seed !== b.seed) {
            throw new Error('runSeed seed mismatch');
          }
        }),
        { numRuns: 5 }
      );
    },
    { timeout: 120_000 }
  );
});
