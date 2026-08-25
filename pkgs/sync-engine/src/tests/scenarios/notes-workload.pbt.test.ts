import { describe, expect, test } from 'bun:test';
import { assertProperty, fc } from '@pkgs/pbt';

import { runSeed } from '../../domain-packs/notes-app/replay';
import {
  initialWorkloadModel,
  type WorkloadReal,
  workloadCommands,
} from '../arbitraries/workload-command';

describe('notes workload PBT / DST', () => {
  test('fc.commands model respects online/offline preconditions', async () => {
    await assertProperty(
      'workload command model',
      fc.asyncProperty(workloadCommands(10), async (cmds) => {
        const real: WorkloadReal = { actions: [] };
        await fc.asyncModelRun(
          () => ({ model: initialWorkloadModel(), real }),
          cmds
        );
        for (const action of real.actions) {
          expect(action.kind).toBeDefined();
        }
      }),
      { numRuns: 15 }
    );
  });

  test('runSeed is deterministic for a generated seed', async () => {
    await assertProperty(
      'runSeed determinism',
      fc.asyncProperty(fc.integer({ min: 1, max: 10_000 }), async (seed) => {
        const a = await runSeed({
          seed,
          steps: 8,
          clientCount: 2,
          sampleFaults: false,
        });
        const b = await runSeed({
          seed,
          steps: 8,
          clientCount: 2,
          sampleFaults: false,
        });
        expect(a).toEqual(b);
        expect(a.ok).toBe(true);
      }),
      { numRuns: 5 }
    );
  }, 120_000);
});
