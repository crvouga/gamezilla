import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveEntries } from './check-evidence-archive';
import { evidencePaths } from './check-evidence-selection';
import {
  cachedShardResult,
  checkSchedule,
  writeSchedule,
} from './check-plan-schedule';
import type { CheckTask } from './check-shards';
import { balanceShards, validateShardResult } from './check-shards';
import { jobResults, summarize } from './check-verdict';

function task(
  id: string,
  hit: boolean,
  dependencies: string[] = []
): CheckTask {
  return {
    taskId: id,
    hash: '0123456789abcdef',
    hit,
    source: hit ? 'REMOTE' : null,
    command: 'bun test',
    directory: 'pkgs/example',
    seconds: 60,
    durationSource: 'history',
    dependencies,
  };
}

const CACHED = Array.from({ length: 40 }, (_, i) =>
  task(`cached-${i}#tc`, true)
);

test('the schedule names only the shards with uncached work', () => {
  const plan = balanceShards(
    [...CACHED, ...[0, 1, 2, 3].map((i) => task(`leaf-${i}#test`, false))],
    32,
    120
  );
  const schedule = checkSchedule(plan);
  expect(schedule.shards).toEqual([0, 1]);
  expect(schedule.consumers).toBe(false);
  // Every other shard past the prerequisites is recorded from the cache.
  expect(schedule.cached).toEqual([
    ...Array.from({ length: 30 }, (_, i) => i + 2),
    33,
  ]);
});

test('a fan-in stage with uncached work is scheduled after its producers', () => {
  const plan = balanceShards(
    [
      task('a#test:spec:0', false),
      task('b#test:spec:0', false),
      task('report#prepare', false, ['a#test:spec:0', 'b#test:spec:0']),
    ],
    4,
    120
  );
  expect(checkSchedule(plan)).toEqual({
    shards: [0],
    consumers: true,
    cached: [1, 2, 3],
  });
});

test('a fully cached plan schedules nothing and still accounts for every task', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'check-schedule-'));
  try {
    const plan = balanceShards(CACHED, 8, 120);
    const schedule = writeSchedule(plan, fixture);
    expect(schedule.shards).toEqual([]);
    expect(schedule.consumers).toBe(false);
    expect(
      JSON.parse(
        readFileSync(join(fixture, '.cache/check-ci/schedule.json'), 'utf8')
      )
    ).toEqual({ shards: [], consumers: false });
    const recorded = schedule.cached.map((index) => {
      const entries = archiveEntries(
        join(fixture, `.cache/check-ci/cached/results-${index}.tar.gz`)
      );
      // The verdict and report jobs read the same archives a shard uploads.
      expect(evidencePaths(entries, 'verdict', plan)).toEqual([
        `.cache/check-ci/results/shard-${index}.json`,
      ]);
      expect(
        archiveEntries(
          join(fixture, `.cache/check-ci/cached/evidence-${index}.tar.gz`)
        )
      ).toEqual(entries);
      return JSON.parse(
        readFileSync(
          join(fixture, `.cache/check-ci/results/shard-${index}.json`),
          'utf8'
        )
      ) as ReturnType<typeof cachedShardResult>;
    });
    for (const result of recorded)
      validateShardResult(plan.shards[result.index]!, result.tasks);
    const verdict = summarize({
      planned: plan.tasks.map((item) => item.taskId),
      shards: recorded,
      jobs: jobResults(
        {
          plan: 'success',
          schedule: 'success',
          shards: 'skipped',
          consumers: 'skipped',
        },
        schedule
      ),
    });
    expect(verdict.passed).toBe(true);
    expect(verdict.jobs).toEqual([
      { name: 'check:plan', result: 'success' },
      { name: 'check:schedule', result: 'success' },
      { name: 'check:shards', result: 'cached' },
      { name: 'check:consumers', result: 'cached' },
    ]);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('a shard with uncached work is never recorded from the cache', () => {
  const plan = balanceShards([...CACHED, task('leaf#test', false)], 4, 120);
  expect(() => cachedShardResult(plan.shards[0]!)).toThrow(
    'Shard 0 has uncached tasks'
  );
  expect(checkSchedule(plan).cached).not.toContain(0);
});

test('a scheduled stage that was skipped fails the verdict', () => {
  const plan = balanceShards([...CACHED, task('leaf#test', false)], 4, 120);
  const schedule = checkSchedule(plan);
  const cached = schedule.cached.map((index) =>
    cachedShardResult(plan.shards[index]!)
  );
  const verdict = summarize({
    planned: plan.tasks.map((item) => item.taskId),
    shards: cached,
    jobs: jobResults(
      {
        plan: 'success',
        schedule: 'success',
        shards: 'skipped',
        consumers: 'skipped',
      },
      schedule
    ),
  });
  expect(verdict.passed).toBe(false);
  expect(verdict.jobs.find((job) => job.name === 'check:shards')).toEqual({
    name: 'check:shards',
    result: 'skipped',
  });
  // Nothing the skipped shard owned has a verdict.
  expect(verdict.failures).toBe(plan.shards[0]!.tasks.length);
});

test('skipped never passes without a plan, and no job can claim to be cached', () => {
  expect(
    jobResults(
      {
        plan: 'skipped',
        schedule: 'skipped',
        shards: 'skipped',
        consumers: 'skipped',
      },
      null
    ).map((job) => job.result)
  ).toEqual(['skipped', 'skipped', 'skipped', 'skipped']);
  expect(
    jobResults(
      {
        plan: 'cached',
        schedule: 'cached',
        shards: 'cached',
        consumers: undefined,
      },
      { shards: [], consumers: false }
    ).map((job) => job.result)
  ).toEqual(['unknown', 'unknown', 'unknown', 'unknown']);
  // The plan and the schedule always run.
  expect(
    jobResults(
      {
        plan: 'skipped',
        schedule: 'skipped',
        shards: 'skipped',
        consumers: 'skipped',
      },
      { shards: [], consumers: false }
    ).map((job) => job.result)
  ).toEqual(['skipped', 'skipped', 'cached', 'cached']);
});
