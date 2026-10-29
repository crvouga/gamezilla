// @io-wall-ok — CLI entry: reads the workspace and GitHub, writes the brief.
/**
 * `bun ci:stats` writes one markdown document with everything needed to size
 * the hardware that hosts this repository's CI: the declared workload, the
 * workflow files, and GitHub's run and job history. Hand the file to an LLM
 * with a goal and a budget.
 *
 * Flags: `--days <n>` of history (default 14), `--budget <text>`,
 * `--goals <text>`, `--have <text>` (hardware already owned), `--out <path>`,
 * `--no-github` (skip run history; the declared workload still prints).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { arch, cpus, platform, totalmem } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { buildHistory, type HistoryStats, type Window } from './ci-stats-build';
import type { JobRecord, RunRecord } from './ci-stats-history';
import {
  type FleetRunner,
  type HostFacts,
  renderStats,
  type StatsInput,
} from './ci-stats-render';
import { readWorkload, type WorkflowDefinition } from './ci-stats-workload';

const ROOT = join(import.meta.dirname, '../../..');
const CACHE_DIR = join(ROOT, '.cache/ci-stats');
const DEFAULT_OUT = join(CACHE_DIR, 'CI_STATS.md');
const FETCH_CONCURRENCY = 6;
const MAX_RUNS_PER_WORKFLOW = 1000;
const MS_PER_DAY = 86_400_000;
const BYTES_PER_GIB = 1024 ** 3;
const JOB_FIELDS =
  '{name,conclusion,created_at,started_at,completed_at,runner_name,steps:[.steps[]|{name,conclusion,started_at,completed_at}]}';

type RawJob = {
  name: string;
  conclusion: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  runner_name: string | null;
  steps: {
    name: string;
    conclusion: string | null;
    started_at: string | null;
    completed_at: string | null;
  }[];
};

type RawRun = {
  databaseId: number;
  event: string;
  status: string;
  conclusion: string;
  createdAt: string;
  startedAt: string;
  updatedAt: string;
  headBranch: string;
};

const RETRIES = 4;
const BACKOFF_MS = 1500;
const TRANSIENT = /HTTP 5\d\d|timed? ?out|connection|EOF|temporar/i;

async function ghOnce(args: readonly string[]): Promise<string> {
  const child = Bun.spawn(['gh', ...args], { stdout: 'pipe', stderr: 'pipe' });
  const [out, err, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`gh ${args.join(' ')}: ${err.trim()}`);
  return out;
}

/** `gh`, retried with backoff while GitHub answers with a transient error. */
async function gh(args: readonly string[]): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await ghOnce(args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= RETRIES || !TRANSIENT.test(message)) throw error;
      await Bun.sleep(BACKOFF_MS * attempt);
    }
  }
}

function lines<T>(text: string): T[] {
  return text
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as T);
}

async function listRuns(
  repository: string,
  workflow: WorkflowDefinition,
  since: string
): Promise<RunRecord[]> {
  const raw = JSON.parse(
    await gh([
      'run',
      'list',
      '--repo',
      repository,
      '--workflow',
      workflow.file,
      '--created',
      `>=${since.slice(0, 10)}`,
      '--limit',
      String(MAX_RUNS_PER_WORKFLOW),
      '--json',
      'databaseId,event,status,conclusion,createdAt,startedAt,updatedAt,headBranch',
    ])
  ) as RawRun[];
  return raw
    .filter((run) => run.status === 'completed')
    .map((run) => ({
      workflow: workflow.name,
      id: run.databaseId,
      event: run.event,
      conclusion: run.conclusion || null,
      createdAt: run.createdAt,
      startedAt: run.startedAt,
      updatedAt: run.updatedAt,
      headBranch: run.headBranch,
    }));
}

/** A finished run never changes, so its jobs are fetched once and kept. */
async function runJobs(
  repository: string,
  run: RunRecord
): Promise<JobRecord[]> {
  const cached = join(CACHE_DIR, 'jobs', `${String(run.id)}.json`);
  const raw = existsSync(cached)
    ? (JSON.parse(readFileSync(cached, 'utf8')) as RawJob[])
    : await fetchJobs(repository, run.id, cached);
  return raw.map((job) => ({
    workflow: run.workflow,
    runId: run.id,
    name: job.name,
    conclusion: job.conclusion,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    runnerName: job.runner_name,
    steps: job.steps.map((step) => ({
      name: step.name,
      conclusion: step.conclusion,
      startedAt: step.started_at,
      completedAt: step.completed_at,
    })),
  }));
}

async function fetchJobs(
  repository: string,
  id: number,
  cached: string
): Promise<RawJob[]> {
  const jobs = lines<RawJob>(
    await gh([
      'api',
      '--paginate',
      `repos/${repository}/actions/runs/${String(id)}/jobs?per_page=100`,
      '--jq',
      `.jobs[] | ${JOB_FIELDS}`,
    ])
  );
  mkdirSync(dirname(cached), { recursive: true });
  writeFileSync(cached, JSON.stringify(jobs));
  return jobs;
}

/** Run `task` over `items`, at most `limit` at a time, keeping their order. */
async function pool<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

type Collected = {
  readonly history: HistoryStats;
  readonly skippedRuns: number;
};

/** A run whose jobs cannot be read is left out whole, and counted. */
async function collectHistory(
  repository: string,
  workflows: readonly WorkflowDefinition[],
  window: Window
): Promise<Collected> {
  const perWorkflow = await Promise.all(
    workflows.map((workflow) => listRuns(repository, workflow, window.from))
  );
  const runs = perWorkflow.flat();
  console.log(`ci-stats: fetching jobs for ${String(runs.length)} runs`);
  const fetched = await pool(runs, FETCH_CONCURRENCY, async (run) => {
    try {
      return await runJobs(repository, run);
    } catch (error) {
      console.warn(
        `ci-stats: skipping run ${String(run.id)}: ${String(error)}`
      );
      return undefined;
    }
  });
  const kept = runs.filter((_, index) => fetched[index] !== undefined);
  const jobs = fetched.flatMap((list) => list ?? []);
  return {
    history: buildHistory(kept, jobs, window),
    skippedRuns: runs.length - kept.length,
  };
}

async function fleet(repository: string): Promise<FleetRunner[] | undefined> {
  try {
    const raw = lines<{
      name: string;
      os: string;
      status: string;
      busy: boolean;
      labels: string[];
    }>(
      await gh([
        'api',
        '--paginate',
        `repos/${repository}/actions/runners?per_page=100`,
        '--jq',
        '.runners[] | {name,os,status,busy,labels:[.labels[].name]}',
      ])
    );
    return raw;
  } catch {
    return undefined;
  }
}

/** Only the `VERIFY_*` knobs: other repository variables name cloud roles. */
async function verifyVariables(
  repository: string
): Promise<Record<string, string>> {
  try {
    const raw = JSON.parse(
      await gh([
        'variable',
        'list',
        '--repo',
        repository,
        '--json',
        'name,value',
      ])
    ) as { name: string; value: string }[];
    return Object.fromEntries(
      raw
        .filter((entry) => entry.name.startsWith('VERIFY_'))
        .map((entry) => [entry.name, entry.value])
    );
  } catch {
    return {};
  }
}

function hostFacts(): HostFacts {
  const list = cpus();
  return {
    platform: platform(),
    arch: arch(),
    cpuModel: list[0]?.model.trim() ?? 'unknown',
    logicalCpus: list.length,
    memoryGib: Math.round(totalmem() / BYTES_PER_GIB),
  };
}

async function repositoryName(): Promise<string> {
  return (
    await gh([
      'repo',
      'view',
      '--json',
      'nameWithOwner',
      '--jq',
      '.nameWithOwner',
    ])
  ).trim();
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      days: { type: 'string', default: '14' },
      budget: { type: 'string' },
      goals: { type: 'string' },
      have: { type: 'string' },
      out: { type: 'string', default: DEFAULT_OUT },
      'no-github': { type: 'boolean', default: false },
    },
  });
  const days = Number(values.days);
  if (!Number.isSafeInteger(days) || days < 1)
    throw new Error('--days must be a positive integer');
  const now = new Date();
  const window: Window = {
    from: new Date(now.getTime() - days * MS_PER_DAY).toISOString(),
    to: now.toISOString(),
  };
  const workload = readWorkload(ROOT);
  const online = !values['no-github'];
  const repository = online ? await repositoryName() : 'unknown';
  const collected = online
    ? await collectHistory(repository, workload.workflows, window)
    : undefined;
  const input: StatsInput = {
    generatedAt: window.to,
    repository,
    days,
    budget: values.budget,
    goals: values.goals,
    have: values.have,
    host: hostFacts(),
    workload,
    variables: online ? await verifyVariables(repository) : {},
    fleet: online ? await fleet(repository) : undefined,
    history: collected?.history,
    skippedRuns: collected?.skippedRuns ?? 0,
  };
  const out = values.out ?? DEFAULT_OUT;
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${renderStats(input)}\n`);
  console.log(`ci-stats: wrote ${out}`);
}

if (import.meta.main) await main();
