import type { VerifyTask } from './verify-shards';

/** A task with an uncached ancestor cannot restore its whole dependency closure. */
export function uncachedDependents(tasks: readonly VerifyTask[]): Set<string> {
  const local = new Set(
    tasks.filter((task) => task.cacheable === false).map((task) => task.taskId)
  );
  for (let size = -1; size !== local.size; ) {
    size = local.size;
    for (const task of tasks)
      if (task.dependencies.some((id) => local.has(id))) local.add(task.taskId);
  }
  return local;
}

/** Keep connected execution together; transferable prerequisites may stay shared. */
export function uncachedTaskGroups(
  tasks: readonly VerifyTask[],
  prerequisites: ReadonlySet<string>
): Set<string> {
  const remaining = tasks.filter((task) => !prerequisites.has(task.taskId));
  const ids = new Set(remaining.map((task) => task.taskId));
  const local = uncachedDependents(remaining);
  for (let size = -1; size !== local.size; ) {
    size = local.size;
    for (const task of remaining) {
      if (task.dependencies.some((id) => local.has(id))) local.add(task.taskId);
      if (local.has(task.taskId))
        for (const id of task.dependencies) if (ids.has(id)) local.add(id);
    }
  }
  return local;
}
