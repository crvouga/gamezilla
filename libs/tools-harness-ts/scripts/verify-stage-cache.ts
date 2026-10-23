// @io-wall-ok — transfer exact Turbo artifacts; never omit dependency hashes or rerun another owner.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { prefetchRemoteHits, resolveTurboCacheDir } from './turbo-preflight';
import type { VerifyPlan, VerifyShard } from './verify-shards';

export function requiredTasks(plan: VerifyPlan, roots: VerifyShard['tasks']) {
  const byId = new Map(plan.tasks.map((task) => [task.taskId, task]));
  const needed = new Set<string>();
  const queue = roots.flatMap((task) => task.dependencies);
  for (const id of queue) {
    if (needed.has(id)) continue;
    needed.add(id);
    queue.push(...(byId.get(id)?.dependencies ?? []));
  }
  return plan.tasks.filter((task) => needed.has(task.taskId));
}

export function publishedTasks(plan: VerifyPlan, shard: VerifyShard) {
  const otherRoots = plan.shards
    .filter((item) => item.index !== shard.index)
    .flatMap((item) => item.tasks.filter((task) => !task.hit));
  const needed = new Set(
    requiredTasks(plan, otherRoots).map((task) => task.taskId)
  );
  return shard.tasks.filter((task) => needed.has(task.taskId));
}

export async function prepareStage(
  plan: VerifyPlan,
  shard: VerifyShard,
  env: NodeJS.ProcessEnv,
  root: string
) {
  const dependencies = requiredTasks(
    plan,
    shard.tasks.filter((task) => !task.hit)
  );
  const own = new Set(shard.tasks.map((task) => task.taskId));
  const external = dependencies.filter((task) => !own.has(task.taskId));
  const publish = publishedTasks(plan, shard);
  const restore = [...dependencies, ...publish].filter(
    (task) => task.hit || !own.has(task.taskId)
  );
  await prefetchRemoteHits(
    { tasks: plan.tasks, toExecute: [], remoteHits: restore },
    root,
    env
  );
  const missing = external.filter(
    (task) =>
      !existsSync(join(resolveTurboCacheDir(root, env), `${task.hash}.tar.zst`))
  );
  const absent = new Set(missing.map((task) => task.taskId));
  const blocked = new Set(
    shard.tasks
      .filter(
        (task) =>
          !task.hit &&
          requiredTasks(plan, [task]).some((dep) => absent.has(dep.taskId))
      )
      .map((task) => task.taskId)
  );
  return { dependencies, publish, missing, blocked };
}

/** Files for consumers, even if remote upload is unavailable. */
export function stageCachePaths(
  plan: VerifyPlan,
  shard: VerifyShard,
  root: string,
  failed: boolean
): string[] {
  return publishedTasks(plan, shard).flatMap((task) => {
    const paths = [
      `.turbo/cache/${task.hash}.tar.zst`,
      `.turbo/cache/${task.hash}-meta.json`,
    ];
    if (failed) return paths.filter((path) => existsSync(join(root, path)));
    for (const path of paths)
      if (!existsSync(join(root, path)))
        throw new Error(`Missing published output: ${task.taskId}; ${path}`);
    return paths;
  });
}
