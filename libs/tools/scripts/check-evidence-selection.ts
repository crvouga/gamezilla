import type { CheckPlan } from './check-shards';
import { requiredTasks } from './check-stage-cache';

export function evidencePaths(
  entries: readonly string[],
  mode: string,
  plan: CheckPlan | null
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
      /^\.cache\/check-ci\/results\/shard-\d+\.json$/.test(entry) ||
      entry === '.cache/check-ci/plan.payload'
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
