/**
 * The client dies at every durable boundary of a day of offline use — just
 * before and just after each commit — and is reopened from the same storage.
 * After sync, every write is applied exactly once or explicitly refused,
 * nothing the person was told was saved (or could see) vanishes, and nothing
 * lands twice.
 */
import { expect, test } from 'bun:test';
import {
  CRASH_MOMENTS,
  durableStep,
  recordDurableBoundaries,
  runCrashPoint,
} from '@pkgs/sync-engine-harness-ts/durable-crash-sweep';

const SEED = 1;

test('the script crosses every durable step of the client sync path', async () => {
  const steps = new Set((await recordDurableBoundaries(SEED)).map(durableStep));
  expect([...steps].sort()).toEqual([
    'local schema reconcile, migration or cache wipe',
    'push checkpoint',
    'pushed row applied',
    'scope bookkeeping',
    'snapshot merged + pending writes rebased',
    'upload acknowledged + retired',
    'write applied + queued for upload',
  ]);
});

test('a crash at any durable boundary loses and doubles no write', async () => {
  const boundaries = await recordDurableBoundaries(SEED);
  const failures: string[] = [];
  const perStep = new Map<string, { points: number; failed: number }>();
  for (const boundary of boundaries) {
    for (const when of CRASH_MOMENTS) {
      const result = await runCrashPoint(SEED, boundary.index, when);
      const key = `${durableStep(boundary)} | ${when}`;
      const row = perStep.get(key) ?? { points: 0, failed: 0 };
      row.points += 1;
      if (result.violations.length > 0) row.failed += 1;
      perStep.set(key, row);
      // The replay must die exactly where the recording said the boundary is.
      if (result.verdict?.crash?.boundary.index !== boundary.index) {
        failures.push(`${String(boundary.index)} ${when}: did not crash there`);
      }
      for (const violation of result.violations) {
        failures.push(`${String(boundary.index)} ${when}: ${violation}`);
      }
    }
  }
  // Evidence for reviewers: one line per durable step and crash moment.
  for (const [key, row] of perStep) {
    process.stdout.write(
      `crash-points | ${key} | ${String(row.points)} | ${String(row.failed)}\n`
    );
  }
  expect(failures).toEqual([]);
}, 240_000);
