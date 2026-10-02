// @io-wall-ok — reads CI summaries and writes measured task costs.
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
import { downloadRunArtifacts } from './workflow-artifacts';
export const TASK_COSTS_PATH = join(
  import.meta.dirname,
  'check-task-costs.json'
);

export type TaskCosts = Readonly<Record<string, number>>;

export function readTaskCosts(): TaskCosts {
  return JSON.parse(readFileSync(TASK_COSTS_PATH, 'utf8')) as TaskCosts;
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

/** The execution and publication summaries a Check run uploaded. */
function downloadRunSummaries(runId: string): string[] {
  const dir = mkdtempSync(join(tmpdir(), 'check-costs-'));
  try {
    downloadRunArtifacts(runId, 'turbo-summary-', dir);
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
        'usage: bun run libs/tools/scripts/check-task-costs.ts --harvest <Check run id>',
        '       bun run libs/tools/scripts/check-task-costs.ts --write-costs <turbo run summary.json>…',
      ].join('\n')
    );
    process.exit(1);
  }
  if (summaries.length === 0) {
    console.error('check-task-costs: no turbo run summaries to read');
    process.exit(1);
  }
  const costs = mergeCosts(readTaskCosts(), summaries);
  writeFileSync(TASK_COSTS_PATH, `${JSON.stringify(costs, null, 2)}\n`);
  console.log(
    `check-task-costs: ${String(summaries.length)} summaries → ${String(Object.keys(costs).length)} task costs in ${TASK_COSTS_PATH}`
  );
}
