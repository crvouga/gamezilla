// @io-wall-ok — reads the workspace graph, the task-cost file and the workflow files.
/**
 * The load the repository itself declares: what a cold gate costs, how the
 * `pr` profile splits from the `release` one, the longest indivisible tasks,
 * and what each workflow file asks of a runner. No network, no run history.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { type LoadReport, loadReport, readLoadInput } from './ci-load';
import { createTaskEstimator } from './verify-task-estimates';

export type TaskRow = {
  readonly id: string;
  readonly seconds: number;
  readonly source: 'history' | 'family' | 'fallback';
};

export type ProfileSplit = {
  readonly prSeconds: number;
  readonly releaseOnlySeconds: number;
  readonly prTasks: number;
  readonly releaseOnlyTasks: number;
  readonly longest: readonly TaskRow[];
  readonly longestPr: readonly TaskRow[];
};

export type WorkflowJobDefinition = {
  readonly id: string;
  readonly runsOn: string;
  readonly timeoutMinutes: number | undefined;
};

export type WorkflowDefinition = {
  readonly file: string;
  readonly name: string;
  readonly crons: readonly string[];
  readonly jobs: readonly WorkflowJobDefinition[];
  readonly shardCap: string | undefined;
};

export type Workload = {
  readonly load: LoadReport;
  readonly split: ProfileSplit;
  readonly workflows: readonly WorkflowDefinition[];
};

const TOP_TASKS = 12;

export function readWorkload(root: string): Workload {
  const input = readLoadInput(root);
  const estimate = createTaskEstimator(input.costs);
  const rows = input.packages.flatMap((pkg) =>
    pkg.tasks.map((task): TaskRow => {
      const id = `${pkg.name}#${task}`;
      const { seconds, durationSource } = estimate(id);
      return { id, seconds, source: durationSource };
    })
  );
  return {
    load: loadReport(input),
    split: profileSplit(rows),
    workflows: readWorkflows(join(root, '.github/workflows')),
  };
}

/**
 * Task rows for every gate task. A pull request runs the whole gate, the
 * `release` profile (`verify-profile.ts`), so nothing is left to Release
 * alone and `releaseOnly*` stay zero; the fields remain so the report keeps
 * its shape.
 */
export function profileSplit(rows: readonly TaskRow[]): ProfileSplit {
  return {
    prSeconds: sum(rows),
    releaseOnlySeconds: 0,
    prTasks: rows.length,
    releaseOnlyTasks: 0,
    longest: longest(rows),
    longestPr: longest(rows),
  };
}

function sum(rows: readonly TaskRow[]): number {
  return rows.reduce((total, row) => total + row.seconds, 0);
}

function longest(rows: readonly TaskRow[]): TaskRow[] {
  return [...rows].sort((a, b) => b.seconds - a.seconds).slice(0, TOP_TASKS);
}

function readWorkflows(dir: string): WorkflowDefinition[] {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.yml'))
    .sort()
    .map((file) => parseWorkflow(file, readFileSync(join(dir, file), 'utf8')));
}

/** A line scan, not a YAML parse: it reads only the keys named here. */
export function parseWorkflow(file: string, text: string): WorkflowDefinition {
  const lines = text.split('\n');
  const jobs: { id: string; runsOn: string; timeoutMinutes?: number }[] = [];
  let inJobs = false;
  for (const line of lines) {
    if (/^jobs:\s*$/.test(line)) inJobs = true;
    else if (inJobs && /^\S/.test(line) && !line.startsWith('#'))
      inJobs = false;
    const id = inJobs
      ? /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line)?.[1]
      : undefined;
    if (id) jobs.push({ id, runsOn: '' });
    const job = jobs.at(-1);
    if (!inJobs || !job) continue;
    const runsOn = /^ {4}runs-on:\s*(.+?)\s*$/.exec(line)?.[1];
    if (runsOn) job.runsOn = runsOn;
    const timeout = /^ {4}timeout-minutes:\s*(\d+)\s*$/.exec(line)?.[1];
    if (timeout) job.timeoutMinutes = Number(timeout);
  }
  return {
    file,
    name: /^name:\s*(.+?)\s*$/m.exec(text)?.[1] ?? file,
    crons: [...text.matchAll(/^\s*- cron:\s*'([^']+)'/gm)].flatMap((m) =>
      m[1] ? [m[1]] : []
    ),
    jobs: jobs.map((job) => ({
      id: job.id,
      runsOn: job.runsOn,
      timeoutMinutes: job.timeoutMinutes,
    })),
    shardCap: /^\s*VERIFY_SHARDS:.*\|\|\s*'(\d+)'/m.exec(text)?.[1],
  };
}
