import type { PlannedTask } from './turbo-preflight';

export type CheckTask = PlannedTask & {
  readonly command: string;
  readonly directory: string;
  readonly seconds: number;
};
export type CheckShard = {
  readonly index: number;
  readonly seconds: number;
  readonly tasks: readonly CheckTask[];
};
export type CheckPlan = {
  readonly version: 1;
  readonly tasks: readonly CheckTask[];
  readonly shards: readonly CheckShard[];
};

/** Stable code-point order, independent of the runner's locale. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Keep only genuine producer/consumer chains together; source nodes never execute. */
function groups(tasks: readonly CheckTask[]): CheckTask[][] {
  const parent = new Map(tasks.map((task) => [task.taskId, task.taskId]));
  function root(id: string): string {
    const next = parent.get(id)!;
    if (next === id) return id;
    const result = root(next);
    parent.set(id, result);
    return result;
  }
  for (const task of tasks)
    for (const dep of task.dependencies)
      if (parent.has(dep)) parent.set(root(dep), root(task.taskId));
  const result = new Map<string, CheckTask[]>();
  for (const task of tasks) {
    const key = root(task.taskId);
    const group = result.get(key) ?? [];
    group.push(task);
    result.set(key, group);
  }
  return [...result.values()];
}

/** LPT over measured seconds; ties use task ID, then the lowest shard index. */
export function balanceShards(
  tasks: readonly CheckTask[],
  count: number
): CheckPlan {
  if (!Number.isSafeInteger(count) || count < 1 || count > 64)
    throw new Error('CHECK_SHARDS must be an integer in 1..64');
  const bins = Array.from({ length: count }, (_, index) => ({
    index,
    seconds: 0,
    tasks: [] as CheckTask[],
  }));
  const cost = (group: readonly CheckTask[]) =>
    group.reduce((sum, task) => sum + task.seconds, 0);
  const ordered = groups(
    [...tasks].sort((a, b) => compare(a.taskId, b.taskId))
  ).sort((a, b) => cost(b) - cost(a) || compare(a[0]!.taskId, b[0]!.taskId));
  for (const group of ordered) {
    const bin = bins.reduce((best, candidate) =>
      candidate.seconds < best.seconds ? candidate : best
    );
    bin.tasks.push(...group);
    bin.seconds += cost(group);
  }
  const plan: CheckPlan = { version: 1, tasks, shards: bins };
  validatePlan(plan);
  return plan;
}

/** Exact set equality and dependency ownership, never a hard-coded task count. */
export function validatePlan(plan: CheckPlan): void {
  if (plan.version !== 1 || plan.shards.length < 1)
    throw new Error('Invalid Check plan');
  const expected = new Map(plan.tasks.map((task) => [task.taskId, task.hash]));
  if (expected.size !== plan.tasks.length)
    throw new Error('Duplicate discovered task');
  const owners = new Map<string, number>();
  for (const [index, shard] of plan.shards.entries()) {
    if (shard.index !== index) throw new Error('Invalid shard index');
    for (const task of shard.tasks) {
      if (owners.has(task.taskId) || expected.get(task.taskId) !== task.hash)
        throw new Error(`Duplicate or unknown shard task: ${task.taskId}`);
      owners.set(task.taskId, index);
    }
  }
  if (owners.size !== expected.size) throw new Error('Omitted Check task');
  for (const shard of plan.shards)
    for (const task of shard.tasks)
      for (const dep of task.dependencies)
        if (owners.has(dep) && owners.get(dep) !== shard.index)
          throw new Error(`Cross-shard dependency: ${task.taskId} -> ${dep}`);
}

export function imbalance(values: readonly number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return mean > 0 ? Math.max(...values) / mean - 1 : 0;
}

export function validateShardResult(
  shard: CheckShard,
  results: readonly {
    readonly taskId: string;
    readonly hash: string;
    readonly passed: boolean;
  }[]
): void {
  const expected = new Map(shard.tasks.map((task) => [task.taskId, task.hash]));
  const seen = new Set<string>();
  for (const task of results) {
    if (
      seen.has(task.taskId) ||
      expected.get(task.taskId) !== task.hash ||
      !task.passed
    )
      throw new Error(`Failed, duplicated or changed task: ${task.taskId}`);
    seen.add(task.taskId);
  }
  if (seen.size !== expected.size) throw new Error('Incomplete shard result');
}
