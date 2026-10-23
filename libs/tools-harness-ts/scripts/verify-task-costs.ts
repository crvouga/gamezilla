// @io-wall-ok — reads CI summaries and writes measured task costs.
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { downloadRunArtifacts } from './workflow-artifacts';
export const TASK_COSTS_PATH = join(
  import.meta.dirname,
  'verify-task-costs.json'
);

export type TaskCosts = Readonly<Record<string, number>>;

export function readTaskCosts(): TaskCosts {
  return JSON.parse(readFileSync(TASK_COSTS_PATH, 'utf8')) as TaskCosts;
}

/**
 * What the newest Verification measured on the runners that execute it. `verify:start`
 * restores it from the Actions cache and `verify:end` saves the next one,
 * so shard packing follows the corpus without a commit per harvest.
 */
export const MEASURED_COSTS_PATH = join(
  import.meta.dirname,
  '../../../.cache/verify-ci/measured-costs.json'
);

/**
 * The costs shards are packed by: the committed file, overlaid with the
 * restored measurements. Packing never decides a verdict, so an absent or
 * unreadable overlay falls back to the committed file.
 */
export function readScheduleCosts(path = MEASURED_COSTS_PATH): TaskCosts {
  const committed = readTaskCosts();
  if (!existsSync(path)) return committed;
  try {
    const measured = Object.entries(
      JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    ).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === 'number' &&
        Number.isFinite(entry[1]) &&
        entry[1] > 0
    );
    return { ...committed, ...Object.fromEntries(measured) };
  } catch (error) {
    console.warn(`verify-task-costs: ignoring ${path}: ${String(error)}`);
    return committed;
  }
}

/**
 * What one run teaches the next plan: a task it executed and passed, at the
 * seconds it took; any other planned task keeps the measured cost its plan
 * already had. Estimates, failures and tasks outside the plan are dropped, so
 * the file follows the current graph.
 */
export function measuredCosts(
  planned: readonly {
    readonly taskId: string;
    readonly seconds: number;
    readonly durationSource: string;
  }[],
  results: readonly {
    readonly taskId: string;
    readonly passed: boolean;
    readonly cache: string;
    readonly milliseconds: number;
  }[]
): Record<string, number> {
  const executed = new Map(
    results
      .filter(
        (result) =>
          result.passed &&
          result.cache !== 'HIT' &&
          Number.isFinite(result.milliseconds) &&
          result.milliseconds > 0
      )
      .map((result) => [
        result.taskId,
        Math.max(1, Math.round(result.milliseconds / 1000)),
      ])
  );
  const costs: [string, number][] = [];
  for (const task of planned) {
    const seconds =
      executed.get(task.taskId) ??
      (task.durationSource === 'history' ? task.seconds : undefined);
    if (seconds !== undefined) costs.push([task.taskId, seconds]);
  }
  return Object.fromEntries(costs.sort(([a], [b]) => a.localeCompare(b)));
}

type SummaryTask = {
  readonly taskId: string;
  readonly cache?: { readonly status?: string } | string;
  readonly execution?: {
    readonly startTime: number;
    readonly endTime: number;
    readonly exitCode?: number;
  };
  readonly milliseconds?: number;
  readonly passed?: boolean;
  readonly exitCode?: number;
};

/** Measured seconds per executed task in a turbo `--summarize` summary. */
export function costsFromSummary(summaryJson: string): Record<string, number> {
  const summary = JSON.parse(summaryJson) as { tasks: SummaryTask[] };
  const costs: Record<string, number> = {};
  for (const task of summary.tasks) {
    if (
      task.passed === false ||
      (task.exitCode ?? task.execution?.exitCode ?? 0) !== 0 ||
      task.cache === 'HIT' ||
      (typeof task.cache === 'object' && task.cache.status === 'HIT')
    )
      continue;
    const elapsed =
      task.milliseconds ??
      (task.execution
        ? task.execution.endTime - task.execution.startTime
        : undefined);
    if (elapsed === undefined || !Number.isFinite(elapsed) || elapsed <= 0)
      continue;
    const seconds = elapsed / 1000;
    costs[task.taskId] = Math.max(1, Math.round(seconds));
  }
  return Object.fromEntries(
    Object.entries(costs).sort(([a], [b]) => a.localeCompare(b))
  );
}

/**
 * `previous` updated with every task measured in `summaries`. A task no
 * summary ran keeps its old cost; repeated samples keep the larger cost.
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

/** The execution and publication summaries a Verify run uploaded. */
function downloadRunSummaries(runId: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'verify-costs-'));
  try {
    downloadRunArtifacts(runId, 'verify-ci-details', dir);
    return jsonFiles(dir)
      .filter((path) => /shard-\d+\.json$/.test(path))
      .map((path) => readFileSync(path, 'utf8'));
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
        'usage: bun run libs/tools-harness-ts/scripts/verify-task-costs.ts --harvest <Verify run id>',
        '       bun run libs/tools-harness-ts/scripts/verify-task-costs.ts --write-costs <turbo run summary.json>…',
      ].join('\n')
    );
    process.exit(1);
  }
  if (summaries.length === 0) {
    console.error('verify-task-costs: no turbo run summaries to read');
    process.exit(1);
  }
  const costs = mergeCosts(readTaskCosts(), summaries);
  writeFileSync(TASK_COSTS_PATH, `${JSON.stringify(costs, null, 2)}\n`);
  console.log(
    `verify-task-costs: ${String(summaries.length)} summaries → ${String(Object.keys(costs).length)} task costs in ${TASK_COSTS_PATH}`
  );
}
