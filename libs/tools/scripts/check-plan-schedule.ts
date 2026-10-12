// @io-wall-ok — CI scheduling adapter; records only shard indexes and cached task identities.
/**
 * Which jobs a Check plan starts. A shard whose tasks are all cache hits has
 * nothing to execute, so no runner is started for it: `check:plan` records
 * its cached verdicts here and `check:schedule` hands the workflow the shards
 * that still have work. A cached result is a passed result for those exact
 * inputs, the same verdict the shard itself would have reported.
 *
 * `schedule.json` holds shard indexes and one boolean. It travels as an
 * artifact to a job that loads no secrets, because a job output written
 * beside masked secrets is suppressed (`github-check-plan-output-secret-masking`).
 */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packShardEvidence } from './check-evidence-pack';
import type { Result } from './check-shard-results';
import type { CheckPlan, CheckShard } from './check-shards';
import { executes } from './check-shards';

export type CheckSchedule = {
  /** Check-stage shards with at least one task to execute. */
  readonly shards: readonly number[];
  /** Whether the fan-in stage has a task to execute. */
  readonly consumers: boolean;
  /** Shards past the prerequisites with nothing to execute. */
  readonly cached: readonly number[];
};

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

/** Write the schedule and one verdict archive per cached shard. */
export function writeSchedule(plan: CheckPlan, root = ROOT): CheckSchedule {
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
  writeFileSync(
    join(root, DIRECTORY, 'schedule.json'),
    JSON.stringify({ shards: schedule.shards, consumers: schedule.consumers })
  );
  return schedule;
}
