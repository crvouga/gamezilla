export function distribution(samples: readonly number[]) {
  if (!samples.length) throw new Error('No measured samples');
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {
    samples: sorted.length,
    median:
      sorted.length % 2
        ? sorted[middle]!
        : (sorted[middle - 1]! + sorted[middle]!) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1]!,
    min: sorted[0]!,
    max: sorted.at(-1)!,
  };
}

export function criticalPath(
  tasks: readonly {
    readonly taskId: string;
    readonly dependencies: readonly string[];
    readonly seconds: number;
  }[]
): { seconds: number; tasks: readonly string[] } {
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  const memo = new Map<string, { seconds: number; tasks: string[] }>();
  const active = new Set<string>();
  function visit(id: string): { seconds: number; tasks: string[] } {
    if (memo.has(id)) return memo.get(id)!;
    if (active.has(id)) throw new Error('Cyclic task graph');
    const task = byId.get(id);
    if (!task) return { seconds: 0, tasks: [] };
    active.add(id);
    const prior = task.dependencies
      .map(visit)
      .reduce(
        (longest, path) => (path.seconds > longest.seconds ? path : longest),
        { seconds: 0, tasks: [] as string[] }
      );
    active.delete(id);
    const result = {
      seconds: prior.seconds + task.seconds,
      tasks: [...prior.tasks, id],
    };
    memo.set(id, result);
    return result;
  }
  return tasks
    .map((task) => visit(task.taskId))
    .reduce(
      (longest, path) => (path.seconds > longest.seconds ? path : longest),
      { seconds: 0, tasks: [] as string[] }
    );
}
