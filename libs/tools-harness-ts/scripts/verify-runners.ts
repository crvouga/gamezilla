/**
 * How many runners can take this run's shards. Every Verify job runs on a
 * GitHub-hosted runner, and the workflow sets `VERIFY_RUNNERS` to the
 * account's concurrent-job allowance for one run. The plan never makes more
 * shards than these runners: an extra shard only queues and pays its checkout
 * and install again. Without it (a laptop) the plan keeps its configured cap.
 */

/** Runners one Verify run may fill, or `undefined` when unknown. */
export function availableRunners(
  env: Readonly<Record<string, string | undefined>>
): number | undefined {
  const override = env['VERIFY_RUNNERS']?.trim();
  if (!override) return undefined;
  const runners = Number(override);
  if (!Number.isSafeInteger(runners) || runners < 1)
    throw new Error('VERIFY_RUNNERS must be a positive integer');
  return runners;
}
