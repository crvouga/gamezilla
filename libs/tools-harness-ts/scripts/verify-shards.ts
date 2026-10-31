import type { PlannedTask } from './turbo-preflight';
import { transferable, verifyStages } from './verify-stages';

export type VerifyTask = PlannedTask & {
  readonly command: string;
  readonly directory: string;
  readonly seconds: number;
  readonly durationSource: 'history' | 'family' | 'fallback';
};
export type VerifyShard = {
  readonly index: number;
  readonly stage: 'prerequisites' | 'verifications' | 'consumers';
  readonly seconds: number;
  readonly tasks: readonly VerifyTask[];
};
export type VerifyPlan = {
  readonly version: 2;
  readonly tasks: readonly VerifyTask[];
  readonly shards: readonly VerifyShard[];
};

/** Stable code-point order, independent of the runner's locale. */
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Keep only genuine producer/consumer chains together; source nodes never execute. */
function groups(tasks: readonly VerifyTask[]): VerifyTask[][] {
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
  const result = new Map<string, VerifyTask[]>();
  for (const task of tasks) {
    const key = root(task.taskId);
    const group = result.get(key) ?? [];
    group.push(task);
    result.set(key, group);
  }
  return [...result.values()];
}

/**
 * A task that is solver proofs from start to end: a package's model verification
 * or a part of one, or the whole-product proofs in the product app's
 * contract suite.
 */
function solverTask(taskId: string): boolean {
  return (
    /#verify:models(?::\d+){0,2}$/.test(taskId) ||
    taskId === '@apps/product-ts#test:contract' ||
    /@apps\/product-ts#test:contract:\d+$/.test(taskId)
  );
}

function modelCount(tasks: readonly VerifyTask[]): number {
  return tasks.filter((task) => !task.hit && solverTask(task.taskId)).length;
}

function lighter(a: VerifyShard, b: VerifyShard): boolean {
  return (
    a.seconds < b.seconds ||
    (a.seconds === b.seconds &&
      (a.tasks.filter(unknown).length < b.tasks.filter(unknown).length ||
        (a.tasks.filter(unknown).length === b.tasks.filter(unknown).length &&
          a.tasks.length < b.tasks.length)))
  );
}

function cost(group: readonly VerifyTask[]): number {
  return group.reduce((sum, task) => sum + taskWeight(task), 0);
}

/**
 * Verify shards worth starting. Every shard pays a runner's checkout and
 * install before its first task, so uncached work is packed into shards of
 * about `targetSeconds` instead of spread over all `count`. Each uncached
 * solver group owns a runner of its own, and so does any other group of a
 * target or more: its seconds fill its own runner, never a share of the
 * runners the smaller groups are packed into.
 */
export function shardWidth(
  ordered: readonly (readonly VerifyTask[])[],
  count: number,
  targetSeconds: number | undefined
): number {
  if (targetSeconds === undefined) return count;
  if (!Number.isFinite(targetSeconds) || targetSeconds <= 0)
    throw new Error('Shard target must be a positive number of seconds');
  return Math.min(count, preferredWidth(ordered, targetSeconds));
}

/** Dedicated proof lanes plus the runners needed to pack other work at target. */
function preferredWidth(
  ordered: readonly (readonly VerifyTask[])[],
  targetSeconds: number
): number {
  const solvers = ordered.filter((group) => modelCount(group) > 0).length;
  const rest = ordered.filter((group) => modelCount(group) === 0);
  const own = rest.filter((group) => cost(group) >= targetSeconds).length;
  const packed = rest
    .filter((group) => cost(group) < targetSeconds)
    .reduce((sum, group) => sum + cost(group), 0);
  return Math.max(1, solvers + own + Math.ceil(packed / targetSeconds));
}

/**
 * The fewest shards that hold the work with none past `fillSeconds`: a group
 * at least that long fills a shard alone, the rest pack together. Unlike
 * {@link preferredWidth} it reserves no proof lanes; those are a preference
 * a small pool cannot afford, not a deadline.
 */
function deadlineWidth(
  ordered: readonly (readonly VerifyTask[])[],
  fillSeconds: number
): number {
  const own = ordered.filter((group) => cost(group) >= fillSeconds).length;
  const packed = ordered
    .filter((group) => cost(group) < fillSeconds)
    .reduce((sum, group) => sum + cost(group), 0);
  return Math.max(1, own + Math.ceil(packed / fillSeconds));
}

/** The runners that can take a plan's shards, and how full one shard may get. */
export type ShardCapacity = {
  readonly runners: number;
  /** Seconds of estimated work a shard may hold and still finish inside its deadline. */
  readonly fillSeconds: number;
};

/** What starting one more shard costs, and how much of its runner's time must be tasks. */
export type ShardSizing = {
  /** Seconds a shard spends outside its tasks: checkout, setup, plan restore, upload. */
  readonly setupSeconds: number;
  /** A shard holds at least this many times its setup in work, per slot. */
  readonly setupMultiple: number;
  /** Turbo slots per shard. */
  readonly slots: number;
};

/** How the plan sized its shards, for the log. */
export type ShardTarget = {
  readonly targetSeconds: number;
  readonly uncachedSeconds: number;
  readonly longestGroupSeconds: number;
  readonly efficiencySeconds: number;
};

/**
 * Seconds of uncached work worth starting one shard for. A shard holds at
 * least `setupMultiple` times its setup per slot, so setup stays a small
 * share of the runner's time, and never less than the longest indivisible
 * task group: the run cannot finish before that group does, so smaller
 * shards only pay setup again without finishing sooner. `fillSeconds`, the
 * most a shard may hold inside its deadline, caps it.
 */
export function adaptiveShardTarget(
  tasks: readonly VerifyTask[],
  sizing: ShardSizing,
  fillSeconds = Number.POSITIVE_INFINITY
): ShardTarget {
  if (
    !(sizing.setupSeconds > 0) ||
    !(sizing.setupMultiple > 0) ||
    !Number.isSafeInteger(sizing.slots) ||
    sizing.slots < 1
  )
    throw new Error('Shard sizing needs positive setup, multiple and slots');
  const verifications = verifyStages(
    [...tasks].sort((a, b) => compare(a.taskId, b.taskId))
  ).verifications;
  const longestGroupSeconds = Math.max(
    0,
    ...groups(verifications).map((group) => cost(group))
  );
  const efficiencySeconds =
    sizing.setupMultiple * sizing.setupSeconds * sizing.slots;
  return {
    targetSeconds: Math.min(
      fillSeconds,
      Math.max(efficiencySeconds, longestGroupSeconds)
    ),
    uncachedSeconds: cost(verifications),
    longestGroupSeconds,
    efficiencySeconds,
  };
}

/**
 * Spread uncached solver groups, then LPT; ties use stable discovery order.
 * `targetSeconds` narrows the plan to the shards its uncached work needs
 * ({@link shardWidth}), and `capacity` to the runners that can take them: a
 * shard beyond them would only queue and pay its checkout and install again.
 * Too few runners never pack a shard past `fillSeconds`; the extra shards
 * queue instead. Shard indices stay `0..count-1`, so the prerequisite and
 * consumer stages keep theirs. Proofs retain dedicated runners when that
 * preferred layout fits the cap; otherwise all allocated runners share the
 * work.
 */
export function balanceShards(
  tasks: readonly VerifyTask[],
  count: number,
  targetSeconds?: number,
  capacity?: ShardCapacity
): VerifyPlan {
  if (!Number.isSafeInteger(count) || count < 1 || count > 64)
    throw new Error('VERIFY_SHARDS must be an integer in 1..64');
  if (
    capacity !== undefined &&
    (!Number.isSafeInteger(capacity.runners) ||
      capacity.runners < 1 ||
      !(capacity.fillSeconds > 0))
  )
    throw new Error('Shard capacity needs positive runners and fill seconds');
  const every = Array.from({ length: count }, (_, index) => ({
    index,
    stage: 'verifications' as const,
    seconds: 0,
    tasks: [] as VerifyTask[],
  }));
  const canonical = [...tasks].sort((a, b) => compare(a.taskId, b.taskId));
  const stages = verifyStages(canonical);
  const ordered = groups(
    [...stages.verifications].sort((a, b) => compare(a.taskId, b.taskId))
  ).sort((a, b) => cost(b) - cost(a) || compare(a[0]!.taskId, b[0]!.taskId));
  const cap =
    capacity === undefined
      ? count
      : Math.min(
          count,
          Math.max(
            capacity.runners,
            deadlineWidth(ordered, capacity.fillSeconds)
          )
        );
  const bins = every.slice(0, shardWidth(ordered, cap, targetSeconds));
  // Reserve proof runners only when the preferred layout fits. At the cap,
  // unused proof capacity must not force all other work onto too few runners.
  const isolate =
    targetSeconds !== undefined &&
    preferredWidth(ordered, targetSeconds) <= cap;
  const placement =
    targetSeconds !== undefined
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
  const shards: VerifyShard[] = [...every];
  for (const stage of ['prerequisites', 'consumers'] as const)
    shards.push({
      index: shards.length,
      stage,
      tasks: stages[stage],
      seconds: cost(stages[stage]),
    });
  const plan: VerifyPlan = { version: 2, tasks: canonical, shards };
  validatePlan(plan);
  return plan;
}

/** Exact set equality and dependency ownership, never a hard-coded task count. */
export function validatePlan(plan: VerifyPlan): void {
  if (plan.version !== 2 || plan.shards.length < 1)
    throw new Error('Invalid Verify plan');
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
  if (owners.size !== expected.size) throw new Error('Omitted Verify task');
  const rank = { prerequisites: 0, verifications: 1, consumers: 2 };
  const byId = new Map(plan.tasks.map((task) => [task.taskId, task]));
  for (const shard of plan.shards)
    if (!(shard.stage in rank)) throw new Error('Unknown Verification stage');
  for (const shard of plan.shards)
    for (const task of shard.tasks)
      for (const dep of task.dependencies)
        if (
          owners.has(dep) &&
          owners.get(dep) !== shard.index &&
          (!transferable(dep, byId) ||
            rank[plan.shards[owners.get(dep)!]!.stage] >= rank[shard.stage])
        )
          throw new Error(`Cross-shard dependency: ${task.taskId} -> ${dep}`);
}

export function imbalance(values: readonly number[]): number {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return mean > 0 ? Math.max(...values) / mean - 1 : 0;
}

export function validateShardResult(
  shard: VerifyShard,
  results: readonly {
    readonly taskId: string;
    readonly hash: string;
    readonly passed: boolean;
    readonly interrupted?: boolean;
    readonly exitCode?: number;
  }[]
): void {
  const expected = new Map(shard.tasks.map((task) => [task.taskId, task.hash]));
  const seen = new Set<string>();
  for (const task of results) {
    if (seen.has(task.taskId))
      throw new Error(`Task ${task.taskId} was reported twice`);
    if (expected.get(task.taskId) !== task.hash)
      throw new Error(
        `Task ${task.taskId} ran with hash ${task.hash}, but the plan expected ${expected.get(task.taskId) ?? '(it is not in this shard)'}`
      );
    if (!task.passed)
      throw new Error(
        task.interrupted
          ? `Task ${task.taskId} never finished: the shard was stopped first`
          : `Task ${task.taskId} failed with exit code ${task.exitCode ?? 'unknown'}`
      );
    seen.add(task.taskId);
  }
  if (seen.size !== expected.size)
    throw new Error(
      `Incomplete shard result: ${expected.size - seen.size} planned task(s) have no result`
    );
}

/** Cache verdicts consume no execution slots; restore time is reported separately. */
export function taskWeight(task: VerifyTask): number {
  return task.hit ? 0 : task.seconds;
}
function unknown(task: VerifyTask): boolean {
  return !task.hit && task.durationSource !== 'history';
}

/** A shard with nothing to execute never starts a runner. */
export function executes(shard: VerifyShard): boolean {
  return shard.tasks.some((task) => !task.hit);
}

/**
 * A runner kept for proofs alone. A proof that outruns its budget ends the
 * shard, so unrelated work is never queued behind one. Its duration is the
 * proof's estimate, not a packing choice.
 */
function dedicatedSolver(shard: VerifyShard): boolean {
  const running = shard.tasks.filter((task) => !task.hit);
  return running.length > 0 && running.every((task) => solverTask(task.taskId));
}

export function planWarnings(plan: VerifyPlan): string[] {
  const running = plan.shards.filter(
    (shard) =>
      shard.stage === 'verifications' &&
      executes(shard) &&
      !dedicatedSolver(shard)
  );
  const lightest = Math.min(...running.map((shard) => shard.seconds));
  // A heavier dedicated group cannot be divided to fill a lighter runner.
  // Keep the lightest runners, including single groups: an underfilled runner
  // can reveal poor packing elsewhere. Cache hits add no executable groups.
  const verifications = running.filter(
    (shard) =>
      shard.seconds === lightest ||
      groups(shard.tasks).filter((group) => cost(group) > 0).length > 1
  );
  if (verifications.length === 0) return [];
  const values = verifications.map((shard) => shard.seconds);
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
  const counts = verifications.map(
    (shard) => shard.tasks.filter(unknown).length
  );
  const mean = counts.reduce((sum, value) => sum + value, 0) / counts.length;
  if (Math.max(...counts) > Math.max(Math.ceil(mean) + 1, mean * 1.25))
    warnings.push(
      `Unknown-duration tasks concentrated on one shard (${counts.join(', ')})`
    );
  return warnings;
}
