import type { VerifyTask } from './verify-shards';

/** Builds run once; fan-in consumers run after the distributed verifications. */
export function verifyStages(tasks: readonly VerifyTask[]) {
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const prerequisites = new Set<string>();
  function include(id: string): void {
    if (prerequisites.has(id) || !byId.has(id)) return;
    prerequisites.add(id);
    for (const dep of byId.get(id)!.dependencies) include(dep);
  }
  const users = new Map<string, number>();
  for (const task of tasks)
    for (const id of task.dependencies) users.set(id, (users.get(id) ?? 0) + 1);
  // A shared producer may itself consume generated inputs. Promote the
  // chain to a fixed point, independent of task discovery order.
  for (let size = -1; size !== prerequisites.size; ) {
    size = prerequisites.size;
    for (const task of tasks) {
      // A shared uncached checker produces no transferable Turbo archive.
      // Leave it with its consumers in one verification shard instead.
      const sharedSource =
        task.cacheable !== false &&
        (users.get(task.taskId) ?? 0) > 1 &&
        task.dependencies.every(
          (id) =>
            !byId.has(id) || prerequisites.has(id) || id.endsWith('#build')
        );
      if (
        (task.taskId.endsWith('#build') || sharedSource) &&
        transferable(task.taskId, byId)
      )
        include(task.taskId);
    }
  }
  const consumers = new Set<string>();
  for (const task of tasks)
    if (
      !prerequisites.has(task.taskId) &&
      task.dependencies.filter((id) => byId.has(id) && !prerequisites.has(id))
        .length > 1
    )
      consumers.add(task.taskId);
  for (let size = -1; size !== consumers.size; ) {
    size = consumers.size;
    for (const task of tasks) {
      if (task.dependencies.some((id) => consumers.has(id)))
        consumers.add(task.taskId);
      // A live check has no Turbo archive to transfer. Keep it alongside
      // every consumer, even when a fan-in moves that chain to the last stage.
      if (consumers.has(task.taskId))
        for (const id of task.dependencies)
          if (byId.has(id) && !transferable(id, byId)) consumers.add(id);
    }
  }
  for (const id of prerequisites)
    if (consumers.has(id)) throw new Error(`Cyclic Verification stages: ${id}`);
  return {
    prerequisites: tasks.filter((task) => prerequisites.has(task.taskId)),
    verifications: tasks.filter(
      (task) => !prerequisites.has(task.taskId) && !consumers.has(task.taskId)
    ),
    consumers: tasks.filter((task) => consumers.has(task.taskId)),
  };
}

/** Only reusable cache artifacts can cross a prerequisite-stage boundary. */
export function transferable(
  id: string,
  tasks: ReadonlyMap<string, VerifyTask>,
  seen = new Set<string>()
): boolean {
  if (seen.has(id)) return true;
  seen.add(id);
  const task = tasks.get(id);
  return (
    task === undefined ||
    (task.cacheable !== false &&
      task.dependencies.every((dependency) =>
        transferable(dependency, tasks, seen)
      ))
  );
}
