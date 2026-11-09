import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { FaultProfileName } from '@pkgs/sync-engine-harness-ts/fault-profiles';
import { FAULT_PROFILE_NAMES } from '@pkgs/sync-engine-harness-ts/fault-profiles';
import {
  arbConvergenceCommands,
  divergentNodes,
  runConvergenceModel,
  runOnlineReference,
} from '@pkgs/sync-engine-harness-ts/offline-convergence-model';
import fc from 'fast-check';

const arbDevicesAndCommands = fc
  .integer({ min: 2, max: 3 })
  .chain((devices) =>
    fc.tuple(fc.constant(devices), arbConvergenceCommands(devices))
  );

for (const profile of FAULT_PROFILE_NAMES) {
  test(`devices that go offline under a ${profile} network end where always-online devices end`, async () => {
    await assertProperty(
      `offline == online: ${profile}`,
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1_000_000 }),
        arbDevicesAndCommands,
        async (seed, [devices, commands]) => {
          const { outcome, writes } = await runConvergenceModel({
            profile: profile as FaultProfileName,
            seed,
            devices,
            commands,
          });
          expect(outcome.violations).toEqual([]);
          const reference = await runOnlineReference({
            seed,
            devices,
            writes,
          });
          expect(reference.violations).toEqual([]);
          expect(divergentNodes(outcome, reference)).toEqual([]);
        }
      )
    );
  }, 600_000);
}
