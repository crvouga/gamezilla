// @io-wall-ok — CI scheduling adapter; records only shard indexes and cached task identities.
/**
 * Which shards a Check plan starts. A shard whose tasks are all cache hits has
 * nothing to execute, so no runner is started for it: `check:start` records
 * its cached verdicts here and hands the workflow a matrix of the shards that
 * still have work. A cached result is a passed result for those exact
 * inputs, the same verdict the shard itself would have reported.
 *
 * The matrix is a `check:start` job output, and GitHub drops a job output
 * that contains a masked secret (`github-check-plan-output-secret-masking`).
 * One dev secret is the digit `1` (Check run 38209389895), so the matrix
 * names no shard: the shards with work are numbered first, the matrix has
 * one entry for each, and shard N is the Nth matrix job.
 */
import { appendFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packShardEvidence } from './check-evidence-pack';
import type { Result } from './check-shard-results';
import type { CheckPlan, CheckShard } from './check-shards';
import { executes, validatePlan } from './check-shards';

export type CheckSchedule = {
  /** Check-stage shards with at least one task to execute: `0..n-1`. */
  readonly shards: readonly number[];
  /** Whether the fan-in stage has a task to execute. */
  readonly consumers: boolean;
  /** Shards past the prerequisites with nothing to execute. */
  readonly cached: readonly number[];
};

/** Number the check shards with work first, so the workflow starts `0..n-1`. */
export function startedFirst(plan: CheckPlan): CheckPlan {
  const checks = plan.shards.filter((shard) => shard.stage === 'checks');
  const started: CheckPlan = {
    ...plan,
    shards: [
      ...checks.filter(executes),
      ...checks.filter((shard) => !executes(shard)),
      ...plan.shards.filter((shard) => shard.stage !== 'checks'),
    ].map((shard, index) => ({ ...shard, index })),
  };
  validatePlan(started);
  return started;
}

/**
 * The `check:shards` matrix: one entry per shard with work, written in dashes
 * alone, with no letter or digit for a masked secret to match.
 */
export function shardMatrix(schedule: Pick<CheckSchedule, 'shards'>): string {
  if (schedule.shards.some((shard, place) => shard !== place))
    throw new Error('Shards with work must be numbered first');
  return JSON.stringify(schedule.shards.map((shard) => '-'.repeat(shard + 1)));
}

export function checkSchedule(plan: CheckPlan): CheckSchedule {
  return {
    shards: plan.shards
      .filter((shard) => shard.stage === 'checks' && executes(shard))
      .map((shard) => shard.index),
    consumers: plan.shards.some(
      (shard) => shard.stage === 'consumers' && executes(shard)
    ),
    cached: plan.shards
      .filter((shard) => shard.stage !== 'prerequisites' && !executes(shard))
      .map((shard) => shard.index),
  };
}

/** The result file a shard writes when every task it owns is a cache hit. */
export function cachedShardResult(shard: CheckShard) {
  if (executes(shard))
    throw new Error(`Shard ${shard.index} has uncached tasks`);
  const tasks: Result[] = shard.tasks.map((task) => ({
    taskId: task.taskId,
    hash: task.hash,
    passed: true,
    cache: 'HIT',
    milliseconds: 0,
    exitCode: 0,
  }));
  return {
    index: shard.index,
    taskCount: tasks.length,
    estimatedSeconds: shard.seconds,
    actualMs: 0,
    prefetchMs: 0,
    executionMs: 0,
    verdict: 0,
    hits: tasks.length,
    tasks,
  };
}

const ROOT = join(import.meta.dirname, '../../..');
const DIRECTORY = '.cache/check-ci';
const CACHED = `${DIRECTORY}/cached`;

/** Write one verdict archive per cached shard and the matrix to `output`. */
export function writeSchedule(
  plan: CheckPlan,
  root = ROOT,
  output = process.env['GITHUB_OUTPUT']
): CheckSchedule {
  const schedule = checkSchedule(plan);
  rmSync(join(root, CACHED), { recursive: true, force: true });
  mkdirSync(join(root, CACHED), { recursive: true });
  mkdirSync(join(root, DIRECTORY, 'results'), { recursive: true });
  for (const index of schedule.cached) {
    const path = `${DIRECTORY}/results/shard-${index}.json`;
    writeFileSync(
      join(root, path),
      JSON.stringify(cachedShardResult(plan.shards[index]!))
    );
    packShardEvidence(root, index, [path], CACHED);
  }
  if (output) appendFileSync(output, `shards=${shardMatrix(schedule)}\n`);
  return schedule;
}
