import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  CRASH_MOMENTS,
  runCrashPoint,
} from '@pkgs/sync-engine-harness-ts/durable-crash-sweep';
import fc from 'fast-check';

/** Above the boundary count of any seed: past the end means "no crash". */
const MAX_BOUNDARY = 300;

test('for any run seed and any crash point, no write is lost or doubled', async () => {
  await assertProperty(
    'durable crash points keep every write exactly once',
    fc.asyncProperty(
      fc.integer({ min: 1, max: 10_000 }),
      fc.integer({ min: 1, max: MAX_BOUNDARY }),
      fc.constantFrom(...CRASH_MOMENTS),
      async (seed, at, when) => {
        const result = await runCrashPoint(seed, at, when);
        expect(result.violations).toEqual([]);
      }
    )
  );
}, 120_000);
