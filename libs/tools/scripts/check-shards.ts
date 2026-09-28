/**
 * Split one `check` run across several CI machines.
 *
 * GitHub-hosted runners for this repo have 2 cores, and a wide change (one
 * edit to a package most of the repo depends on) misses ~200 tasks: ~50 min on
 * one runner. The Check workflow instead plans once and fans the misses out:
 *
 *   check:plan   `turbo run --dry=json` over the whole gate (turbo-preflight),
 *                then {@link planShards} assigns every MISS to one shard.
 *   check:shard  one runner per shard: `turbo run <its task ids>`, which also
 *                schedules each task's `dependsOn` closure (restored from the
 *                shared remote cache when another shard already built it).
 *   check        green only when the plan and every shard are green.
 *
 * The verdict is still turbo's own: a HIT at plan time is a passed task for
 * these exact inputs, and every MISS is assigned to exactly one shard, which
 * fails unless that task passed. Balance only decides how fast — never what
 * is checked.
 *
 * Balance is longest-processing-time first over expected task cost
 * ({@link TASK_COSTS_PATH}). The costs are measured where they are spent — on
 * the 2-core CI shards, which upload their turbo run summaries — and refreshed
 * from a cold Check run with
 * `bun run libs/tools/scripts/check-shards.ts --harvest <run id>`
 * (or `--write-costs <summary.json>…` for summaries already on disk). A
 * laptop-measured table was off by up to 13× for the spec suites, which put a
 * ten-minute task beside thirty others on one runner.
 * A task that depends on another miss (other than a `tc`) goes to the same
 * shard, so a build and the budget check reading its output never both build.
 * `tc` is left to duplicate: it is the cheapest task in the graph and a shard
 * restores whatever another shard already uploaded.
 */
import { spawnSync } from 'node:child_process';
import {
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PlannedTask, RunPlan } from './turbo-preflight';

export const TASK_COSTS_PATH = join(
  import.meta.dirname,
  'check-task-costs.json'
);

/**
 * Most runners one Check run takes. GitHub caps concurrent jobs per account
 * (20 on the free plan), shared by every open PR and the Deploy workflow.
 */
export const MAX_SHARDS = 12;

/**
 * Expected work per shard, in cost-table seconds. Fewer shards than this
 * would allow is pointless: each runner pays ~40s of checkout and setup.
 */
export const TARGET_SHARD_COST = 60;

/** Cost of a task the table has never seen and whose type it has not either. */
const UNKNOWN_TASK_COST = 5;

export type TaskCosts = Readonly<Record<string, number>>;

export type ShardPlan = {
  /** Task ids per shard; empty when every task was a cache hit. */
  readonly shards: readonly (readonly string[])[];
  /** Expected cost per shard, same order. */
  readonly costs: readonly number[];
};

function taskName(taskId: string): string {
  return taskId.slice(taskId.indexOf('#') + 1);
}

/** Median measured cost per task name (`lint`, `test:spec`, …). */
function typeMedians(costs: TaskCosts): Map<string, number> {
  const byType = new Map<string, number[]>();
  for (const [id, seconds] of Object.entries(costs)) {
    const list = byType.get(taskName(id)) ?? [];
    list.push(seconds);
    byType.set(taskName(id), list);
  }
  const medians = new Map<string, number>();
  for (const [type, list] of byType) {
    list.sort((a, b) => a - b);
    medians.set(type, list[Math.floor(list.length / 2)] ?? UNKNOWN_TASK_COST);
  }
  return medians;
}

export function expectedCost(
  taskId: string,
  costs: TaskCosts,
  medians: ReadonlyMap<string, number> = typeMedians(costs)
): number {
  return costs[taskId] ?? medians.get(taskName(taskId)) ?? UNKNOWN_TASK_COST;
}

/**
 * Misses that must share a runner: a miss and the non-`tc` misses it depends
 * on (union-find over those edges). Deterministic order.
 */
function bundleMisses(misses: readonly PlannedTask[]): string[][] {
  const parent = new Map(misses.map((task) => [task.taskId, task.taskId]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root) as string;
    parent.set(id, root);
    return root;
  };
  for (const task of misses) {
    for (const dep of task.dependencies) {
      if (!parent.has(dep) || taskName(dep) === 'tc') continue;
      parent.set(find(dep), find(task.taskId));
    }
  }
  const bundles = new Map<string, string[]>();
  for (const task of misses) {
    const root = find(task.taskId);
    const bundle = bundles.get(root) ?? [];
    bundle.push(task.taskId);
    bundles.set(root, bundle);
  }
  return [...bundles.values()].map((bundle) => bundle.sort());
}

/** Assign every miss in `plan` to one of at most `maxShards` shards. */
export function planShards(
  plan: Pick<RunPlan, 'toExecute'>,
  costs: TaskCosts,
  maxShards: number = MAX_SHARDS
): ShardPlan {
  if (plan.toExecute.length === 0) return { shards: [], costs: [] };
  const medians = typeMedians(costs);
  const bundles = bundleMisses(plan.toExecute).map((ids) => ({
    ids,
    cost: ids.reduce((sum, id) => sum + expectedCost(id, costs, medians), 0),
  }));
  const total = bundles.reduce((sum, bundle) => sum + bundle.cost, 0);
  const count = Math.max(
    1,
    Math.min(maxShards, bundles.length, Math.ceil(total / TARGET_SHARD_COST))
  );
  // Heaviest first onto the lightest shard; ties by id keep it deterministic.
  bundles.sort(
    (a, b) => b.cost - a.cost || (a.ids[0] ?? '').localeCompare(b.ids[0] ?? '')
  );
  const shards = Array.from({ length: count }, () => ({
    ids: [] as string[],
    cost: 0,
  }));
  for (const bundle of bundles) {
    let lightest = shards[0] as (typeof shards)[number];
    for (const shard of shards)
      if (shard.cost < lightest.cost) lightest = shard;
    lightest.ids.push(...bundle.ids);
    lightest.cost += bundle.cost;
  }
  return {
    shards: shards.map((shard) => shard.ids.sort()),
    costs: shards.map((shard) => Math.round(shard.cost)),
  };
}

export function readTaskCosts(path: string = TASK_COSTS_PATH): TaskCosts {
  return JSON.parse(readFileSync(path, 'utf8')) as TaskCosts;
}

type SummaryTask = {
  readonly taskId: string;
  readonly cache?: { readonly status?: string };
  readonly execution?: { readonly startTime: number; readonly endTime: number };
};

/** Measured seconds per executed task in a turbo `--summarize` summary. */
export function costsFromSummary(summaryJson: string): Record<string, number> {
  const summary = JSON.parse(summaryJson) as { tasks: SummaryTask[] };
  const costs: Record<string, number> = {};
  for (const task of summary.tasks) {
    if (task.cache?.status === 'HIT' || task.execution === undefined) continue;
    const seconds = (task.execution.endTime - task.execution.startTime) / 1000;
    costs[task.taskId] = Math.max(1, Math.round(seconds));
  }
  return Object.fromEntries(
    Object.entries(costs).sort(([a], [b]) => a.localeCompare(b))
  );
}

/**
 * `previous` updated with every task measured in `summaries`. A task no
 * summary ran keeps its old cost; a task measured twice (a `tc` two shards
 * both built) keeps the larger.
 */
export function mergeCosts(
  previous: TaskCosts,
  summaries: readonly string[]
): Record<string, number> {
  const measured: Record<string, number> = {};
  for (const summary of summaries) {
    for (const [id, seconds] of Object.entries(costsFromSummary(summary))) {
      measured[id] = Math.max(measured[id] ?? 0, seconds);
    }
  }
  return Object.fromEntries(
    Object.entries({ ...previous, ...measured }).sort(([a], [b]) =>
      a.localeCompare(b)
    )
  );
}

/** Every `*.json` file under `dir`, recursively. */
function jsonFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return jsonFiles(path);
    return name.endsWith('.json') ? [path] : [];
  });
}

/** The shard summaries a Check run uploaded (`turbo-summary-<run>-shard-<n>`). */
function downloadRunSummaries(runId: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'check-costs-'));
  try {
    const download = spawnSync(
      'gh',
      ['run', 'download', runId, '-p', `turbo-summary-${runId}-*`, '-D', dir],
      { stdio: 'inherit' }
    );
    if (download.status !== 0) {
      throw new Error(`gh run download ${runId} failed`);
    }
    return jsonFiles(dir).map((path) => readFileSync(path, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.main) {
  const [flag, ...rest] = process.argv.slice(2);
  let summaries: string[];
  if (flag === '--harvest' && rest.length === 1) {
    summaries = downloadRunSummaries(rest[0] as string);
  } else if (flag === '--write-costs' && rest.length > 0) {
    summaries = rest.map((path) => readFileSync(path, 'utf8'));
  } else {
    console.error(
      [
        'usage: bun run libs/tools/scripts/check-shards.ts --harvest <Check run id>',
        '       bun run libs/tools/scripts/check-shards.ts --write-costs <turbo run summary.json>…',
      ].join('\n')
    );
    process.exit(1);
  }
  if (summaries.length === 0) {
    console.error('check-shards: no turbo run summaries to read');
    process.exit(1);
  }
  const costs = mergeCosts(readTaskCosts(), summaries);
  writeFileSync(TASK_COSTS_PATH, `${JSON.stringify(costs, null, 2)}\n`);
  console.log(
    `check-shards: ${String(summaries.length)} summaries → ${String(Object.keys(costs).length)} task costs in ${TASK_COSTS_PATH}`
  );
}

/** Printed plan: one line per shard. */
export function formatShardPlan(plan: ShardPlan): string {
  if (plan.shards.length === 0) {
    return 'check-shards: every task is a cache hit; no shard needed.';
  }
  return [
    `check-shards: ${String(plan.shards.length)} shard(s)`,
    ...plan.shards.map(
      (ids, index) =>
        `  shard ${String(index)}: ${String(ids.length)} task(s), ~${String(plan.costs[index] ?? 0)}s  ${ids.slice(0, 4).join(' ')}${ids.length > 4 ? ' …' : ''}`
    ),
  ].join('\n');
}

/**
 * `$GITHUB_OUTPUT` lines the Check workflow reads: `shards` (the matrix, a JSON
 * array of indexes) and `assignment` (JSON array of task-id arrays).
 */
export function shardPlanOutputs(plan: ShardPlan): string {
  const indexes = plan.shards.map((_, index) => index);
  return (
    `shards=${JSON.stringify(indexes)}\n` +
    `assignment=${JSON.stringify(plan.shards)}\n`
  );
}
