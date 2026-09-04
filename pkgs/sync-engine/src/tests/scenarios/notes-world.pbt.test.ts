import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';

import { runNotesSeed } from '../../domain-packs/notes-app/replay';
import {
  runShrunkWorldProperty,
  worldPropertyInputs,
} from '../arbitraries/world-runner';

describe('notes world PBT / DST', () => {
  test(
    'random fault command sequences converge after heal',
    async () => {
      await assertDstProperty(
        'notes world converges',
        fc.asyncProperty(
          worldPropertyInputs(14),
          async ([seed, knobs, cmds]) => {
            await runShrunkWorldProperty({ seed, knobs, cmds });
          }
        )
      );
    },
    { timeout: 120_000 }
  );

  test(
    'runSeed stays deterministic (harness)',
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
        }),
        { numRuns: 5 }
      );
    },
    { timeout: 120_000 }
  );
});
