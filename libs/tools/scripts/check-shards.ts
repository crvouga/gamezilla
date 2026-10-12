import { checkStages } from './check-stages';
import type { PlannedTask } from './turbo-preflight';

export type CheckTask = PlannedTask & {
  readonly command: string;
  readonly directory: string;
  readonly seconds: number;
  readonly durationSource: 'history' | 'family' | 'fallback';
};
export type CheckShard = {
  readonly index: number;
  readonly stage: 'prerequisites' | 'checks' | 'consumers';
  readonly seconds: number;
  readonly tasks: readonly CheckTask[];
};
export type CheckPlan = {
  readonly version: 2;
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

function modelCount(tasks: readonly CheckTask[]): number {
  return tasks.filter(
    (task) => !task.hit && task.taskId.endsWith('#check:models')
  ).length;
}

function lighter(a: CheckShard, b: CheckShard): boolean {
  return (
    a.seconds < b.seconds ||
    (a.seconds === b.seconds &&
      (a.tasks.filter(unknown).length < b.tasks.filter(unknown).length ||
        (a.tasks.filter(unknown).length === b.tasks.filter(unknown).length &&
          a.tasks.length < b.tasks.length)))
  );
}

function cost(group: readonly CheckTask[]): number {
  return group.reduce((sum, task) => sum + taskWeight(task), 0);
}

/**
 * Check shards worth starting. Every shard pays a runner's checkout and
 * install before its first task, so uncached work is packed into shards of
 * about `targetSeconds` instead of spread over all `count`. Each uncached
 * solver group owns a runner of its own, beside the ones the rest needs.
 */
export function shardWidth(
  ordered: readonly (readonly CheckTask[])[],
  count: number,
  targetSeconds: number | undefined
): number {
  if (targetSeconds === undefined) return count;
  if (!Number.isFinite(targetSeconds) || targetSeconds <= 0)
    throw new Error('Shard target must be a positive number of seconds');
  const solvers = ordered.filter((group) => modelCount(group) > 0).length;
  const rest = ordered
    .filter((group) => modelCount(group) === 0)
    .reduce((sum, group) => sum + cost(group), 0);
  return Math.min(
    count,
    Math.max(1, solvers + Math.ceil(rest / targetSeconds))
  );
}

/**
 * Spread uncached solver groups, then LPT; ties use stable discovery order.
 * `targetSeconds` narrows the plan to the shards its uncached work needs
 * ({@link shardWidth}), each solver group alone on its runner; the rest stay
 * empty and never start.
 */
export function balanceShards(
  tasks: readonly CheckTask[],
  count: number,
  targetSeconds?: number
): CheckPlan {
  if (!Number.isSafeInteger(count) || count < 1 || count > 64)
    throw new Error('CHECK_SHARDS must be an integer in 1..64');
  const every = Array.from({ length: count }, (_, index) => ({
    index,
    stage: 'checks' as const,
    seconds: 0,
    tasks: [] as CheckTask[],
  }));
  const canonical = [...tasks].sort((a, b) => compare(a.taskId, b.taskId));
  const stages = checkStages(canonical);
  const ordered = groups(
    [...stages.checks].sort((a, b) => compare(a.taskId, b.taskId))
  ).sort((a, b) => cost(b) - cost(a) || compare(a[0]!.taskId, b[0]!.taskId));
  const bins = every.slice(0, shardWidth(ordered, count, targetSeconds));
  // A narrowed plan places solver groups first and keeps everything else off
  // their runners: a proof that outruns its budget ends its shard, and the
  // tasks queued behind it would end unrun with it.
  const isolate = targetSeconds !== undefined;
  const placement = isolate
    ? [
        ...ordered.filter((group) => modelCount(group) > 0),
        ...ordered.filter((group) => modelCount(group) === 0),
      ]
    : ordered;
  for (const group of placement) {
    const leastModels = Math.min(...bins.map((bin) => modelCount(bin.tasks)));
    const free = bins.filter((bin) => modelCount(bin.tasks) === 0);
    const candidates = modelCount(group)
      ? bins.filter((bin) => modelCount(bin.tasks) === leastModels)
      : isolate && free.length > 0
        ? free
        : bins;
    const bin = candidates.reduce((best, candidate) =>
      lighter(candidate, best) ? candidate : best
    );
    bin.tasks.push(...group);
    bin.seconds += cost(group);
  }
  const shards: CheckShard[] = [...every];
  for (const stage of ['prerequisites', 'consumers'] as const)
    shards.push({
      index: shards.length,
      stage,
      tasks: stages[stage],
      seconds: cost(stages[stage]),
    });
  const plan: CheckPlan = { version: 2, tasks: canonical, shards };
  validatePlan(plan);
  return plan;
}

/** Exact set equality and dependency ownership, never a hard-coded task count. */
export function validatePlan(plan: CheckPlan): void {
  if (plan.version !== 2 || plan.shards.length < 1)
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
  for (const task of plan.tasks)
    if (!Number.isFinite(task.seconds) || task.seconds <= 0)
      throw new Error(`Invalid task estimate: ${task.taskId}`);
  if (owners.size !== expected.size) throw new Error('Omitted Check task');
  const rank = { prerequisites: 0, checks: 1, consumers: 2 };
  for (const shard of plan.shards)
    if (!(shard.stage in rank)) throw new Error('Unknown Check stage');
  for (const shard of plan.shards)
    for (const task of shard.tasks)
      for (const dep of task.dependencies)
        if (
          owners.has(dep) &&
          owners.get(dep) !== shard.index &&
          rank[plan.shards[owners.get(dep)!]!.stage] >= rank[shard.stage]
        )
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

/** Cache verdicts consume no execution slots; restore time is reported separately. */
export function taskWeight(task: CheckTask): number {
  return task.hit ? 0 : task.seconds;
}
function unknown(task: CheckTask): boolean {
  return !task.hit && task.durationSource !== 'history';
}

/** A shard with nothing to execute never starts a runner. */
export function executes(shard: CheckShard): boolean {
  return shard.tasks.some((task) => !task.hit);
}

export function planWarnings(plan: CheckPlan): string[] {
  // Only shards that start are compared; a fully cached plan has none.
  const checks = plan.shards.filter(
    (shard) => shard.stage === 'checks' && executes(shard)
  );
  if (checks.length === 0) return [];
  const values = checks.map((shard) => shard.seconds);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const warnings: string[] = [];
  if (max > 0 && (min === 0 || max / min > 1.25))
    warnings.push(
      `Estimated max/min exceeds 1.25 (${min.toFixed(1)}s..${max.toFixed(1)}s)`
    );
  if (max > average * 1.2)
    warnings.push(
      `Heaviest shard exceeds average by more than 20% (${max.toFixed(1)}s / ${average.toFixed(1)}s)`
    );
  const counts = checks.map((shard) => shard.tasks.filter(unknown).length);
  const mean = counts.reduce((sum, value) => sum + value, 0) / counts.length;
  if (Math.max(...counts) > Math.max(Math.ceil(mean) + 1, mean * 1.25))
    warnings.push(
      `Unknown-duration tasks concentrated on one shard (${counts.join(', ')})`
    );
  return warnings;
}
