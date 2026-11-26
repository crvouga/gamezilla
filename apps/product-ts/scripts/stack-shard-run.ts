// @io-wall-ok — CLI helper: run one browser partition of the stack suite, record what each run took.
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wallClock } from '@pkgs/clock-shared-ts/wall';
import { nightlyShard } from './nightly-shard';
import { REPO_ROOT, runSpecProcess, specPackageDirs } from './spec-suites';
import type { StackRun } from './stack-shards';
import {
  choosePartition,
  partitionCount,
  planStackShards,
  readStackPackages,
  runArgs,
  stackRuns,
} from './stack-shards';

/**
 * `apps/product-ts/.cache/stack-shard/shard.json`: the runner's partition,
 * its runs, each with its expected and measured seconds and its exit code.
 * Rewritten after every run, so a runner killed at its deadline still shows
 * what it reached.
 */
const RECORD_PATH = join(
  import.meta.dirname,
  '../.cache/stack-shard/shard.json'
);

type RunRecord = {
  readonly dir: string;
  readonly part: string | null;
  readonly expectedSeconds: number;
  readonly measuredSeconds: number | null;
  readonly exitCode: number | null;
};

/** One runner's partition and what it says about coverage. */
export type PartitionPlan = {
  /** 1-based, or `null` when this runner has no partition tonight. */
  readonly partition: number | null;
  readonly partitions: number;
  readonly night: number | null;
  readonly runs: readonly StackRun[];
  readonly expectedSeconds: number;
  /** What this runner verifies of the suite, for the log and job summary. */
  readonly coverage: string;
};

function label(run: StackRun): string {
  const part = runArgs(run).join(' ');
  return `${run.dir}${part === '' ? '' : ` ${part}`} (~${String(run.seconds)} s)`;
}

function pending(run: StackRun): RunRecord {
  return {
    dir: run.dir,
    part: runArgs(run)[1] ?? null,
    expectedSeconds: run.seconds,
    measuredSeconds: null,
    exitCode: null,
  };
}

function rerun(partition: number): string {
  return `\`gh workflow run verify-nightly.yml -f group=browser -f browser-partition=${String(partition)}\``;
}

function coverageOf(
  choice: { readonly partition: number | null; readonly night: number | null },
  partitions: number,
  runners: number
): string {
  const { partition, night } = choice;
  const of = `of ${String(partitions)}`;
  if (partition === null)
    return `This browser runner has no partition: the suite has only ${String(partitions)}.`;
  if (night === null)
    return `Browser partition ${String(partition)} ${of}, named by hand. Rerun it with ${rerun(partition)}.`;
  const tonight = Math.min(runners, partitions);
  const nights = Math.ceil(partitions / runners);
  return `Browser partition ${String(partition)} ${of} (UTC day ${String(night)}). A night runs ${String(tonight)} ${of} partitions, not the whole suite: every partition runs once in ${String(nights)} nights. Rerun this one with ${rerun(partition)}.`;
}

/**
 * The partition this runner verifies, or `null` for the whole suite (no
 * nightly runner and no named partition: `bun verify-nightly browser`).
 */
export function planPartition(env: NodeJS.ProcessEnv): PartitionPlan | null {
  const slot = nightlyShard(env);
  const input = {
    slot,
    night: env['NIGHTLY_NIGHT'],
    partition: env['BROWSER_PARTITION'],
  };
  const named = input.partition?.trim() ?? '';
  if (named === '' && choosePartition(input, 1).kind === 'whole') return null;
  const runs = stackRuns(readStackPackages(REPO_ROOT, specPackageDirs()));
  const partitions = partitionCount(runs);
  const choice = choosePartition(input, partitions);
  const plan = planStackShards(runs, partitions);
  const index = choice.kind === 'partition' ? choice.index : null;
  const night = choice.kind === 'partition' ? choice.night : null;
  const partition = index === null ? null : index + 1;
  return {
    partition,
    partitions,
    night,
    runs: index === null ? [] : (plan.shards[index] ?? []),
    expectedSeconds: index === null ? 0 : (plan.loads[index] ?? 0),
    coverage: coverageOf({ partition, night }, partitions, slot.count),
  };
}

/** Say what this runner verifies where a person reads it: the log and the job summary. */
export function announcePartition(
  plan: PartitionPlan,
  env: NodeJS.ProcessEnv
): void {
  process.stdout.write(
    `[stack] ${plan.coverage} ${String(plan.runs.length)} runs, ~${String(plan.expectedSeconds)} s expected.\n`
  );
  const summary = env['GITHUB_STEP_SUMMARY'];
  if (summary !== undefined && summary !== '')
    appendFileSync(summary, `${plan.coverage}\n`);
}

/** Run a partition's `test:spec` processes; the first failure's code, else 0. */
export async function runStackShard(
  env: NodeJS.ProcessEnv,
  plan: PartitionPlan
): Promise<number> {
  const records = plan.runs.map(pending);
  const record = () => {
    mkdirSync(join(RECORD_PATH, '..'), { recursive: true });
    const { partition, partitions, night, expectedSeconds, coverage } = plan;
    const body = { partition, partitions, night, coverage, expectedSeconds };
    writeFileSync(
      RECORD_PATH,
      `${JSON.stringify({ ...body, runs: records }, null, 2)}\n`
    );
  };
  record();
  let code = 0;
  for (const [position, run] of plan.runs.entries()) {
    process.stdout.write(`\n[spec] ${label(run)}\n`);
    const started = wallClock.now();
    const status = await runSpecProcess(run.dir, env, runArgs(run));
    records[position] = {
      ...pending(run),
      measuredSeconds: Math.round((wallClock.now() - started) / 1000),
      exitCode: status,
    };
    record();
    if (status !== 0 && code === 0) code = status;
  }
  return code;
}
