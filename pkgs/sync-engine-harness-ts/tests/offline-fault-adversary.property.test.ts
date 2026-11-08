import { afterAll, beforeAll, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { FAULT_PROFILE_NAMES } from '@pkgs/sync-engine-harness-ts/fault-profiles';
import fc from 'fast-check';
import { arbSteps, sweepOnce } from '@pkgs/sync-engine-harness-ts/offline-sweep';

const unhandled: string[] = [];
const onUnhandled = (reason: unknown) => {
  unhandled.push(reason instanceof Error ? reason.message : String(reason));
};
beforeAll(() => process.on('unhandledRejection', onUnhandled));
afterAll(() => process.off('unhandledRejection', onUnhandled));

for (const name of FAULT_PROFILE_NAMES) {
  test(`every saved write survives a ${name} network`, async () => {
    await assertProperty(
      `offline-first invariants: ${name}`,
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1_000_000 }),
        arbSteps,
        async (seed, steps) => {
          const outcome = await sweepOnce(name, seed, steps);
          expect(outcome.violations).toEqual([]);
          expect(unhandled).toEqual([]);
        }
      )
    );
  }, 120_000);
}
