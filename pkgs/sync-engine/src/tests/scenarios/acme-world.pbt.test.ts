import { describe, test } from 'bun:test';
import { assertDstProperty, fc } from '@pkgs/pbt';
import { runAcmeSeed } from '../apps/acme';
import { acmeDstApp } from '../apps/acme/dst-app';
import {
  runShrunkWorldProperty,
  worldPropertyInputs,
} from '../dst/world-runner';

describe('acme world PBT / DST', () => {
  test(
    'fc.commands sequences replay on SimWorld and converge',
    async () => {
      await assertDstProperty(
        'acme world converges',
        fc.asyncProperty(
          worldPropertyInputs(acmeDstApp, 14),
          async ([seed, knobs, cmds]) => {
            await runShrunkWorldProperty({
              app: acmeDstApp,
              seed,
              knobs,
              cmds,
            });
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
          const a = await runAcmeSeed({
            seed,
            steps: 8,
            clientCount: 2,
            sampleFaults: false,
          });
          const b = await runAcmeSeed({
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
