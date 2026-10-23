import type { VerifyPlan } from './verify-shards';
import { requiredTasks } from './verify-stage-cache';

export function evidencePaths(
  entries: readonly string[],
  mode: string,
  plan: VerifyPlan | null
): string[] {
  const hashes = new Set(
    plan
      ? requiredTasks(
          plan,
          plan.shards
            .filter((shard) => shard.stage === 'consumers')
            .flatMap((shard) => shard.tasks)
        ).map((task) => task.hash)
      : []
  );
  return entries.filter((entry) => {
    if (
      /^\.cache\/verify-ci\/results\/shard-\d+\.json$/.test(entry) ||
      entry === '.cache/verify-ci/plan.payload'
    )
      return true;
    const cache =
      /^\.turbo\/cache\/([0-9a-f]{16,64})(?:\.tar\.zst|-meta\.json)$/.exec(
        entry
      );
    return (
      cache !== null &&
      (mode === 'prerequisites' ||
        (mode === 'consumers' && hashes.has(cache[1]!)))
    );
  });
}
