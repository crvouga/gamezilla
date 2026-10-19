import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveEntries } from './verify-evidence-archive';
import { evidencePaths } from './verify-evidence-selection';
import {
  cachedShardResult,
  shardMatrix,
  startedFirst,
  verifySchedule,
  writeSchedule,
} from './verify-plan-schedule';
import type { VerifyTask } from './verify-shards';
import { balanceShards, validateShardResult } from './verify-shards';
import { jobResults, summarize } from './verify-verdict';

function task(
  id: string,
  hit: boolean,
  dependencies: string[] = []
): VerifyTask {
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
  const schedule = verifySchedule(plan);
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
  expect(verifySchedule(plan)).toEqual({
    shards: [0],
    consumers: true,
    cached: [1, 2, 3],
  });
});

test('shards with work are numbered first, whatever shard the balance gave them', () => {
  const plan = balanceShards(
    [...CACHED, ...[0, 1, 2, 3].map((i) => task(`leaf-${i}#test`, false))],
    32,
    120
  );
  // The balance's own order, reversed: the two shards with work come last.
  const verifications = plan.shards.filter(
    (shard) => shard.stage === 'verifications'
  );
  const reversed = {
    ...plan,
    shards: [
      ...[...verifications].reverse(),
      ...plan.shards.filter((shard) => shard.stage !== 'verifications'),
    ].map((shard, index) => ({ ...shard, index })),
  };
  expect(verifySchedule(reversed).shards).toEqual([30, 31]);
  const started = startedFirst(reversed);
  expect(verifySchedule(started).shards).toEqual([0, 1]);
  expect(started.shards.map((shard) => shard.index)).toEqual(
    plan.shards.map((shard) => shard.index)
  );
  expect(started.shards.map((shard) => shard.stage)).toEqual(
    plan.shards.map((shard) => shard.stage)
  );
  expect(
    started.shards.flatMap((shard) => shard.tasks.map((item) => item.taskId))
  ).toHaveLength(plan.tasks.length);
  expect(() => shardMatrix(verifySchedule(reversed))).toThrow(
    'Shards with work must be numbered first'
  );
});

// regression: github-verify-plan-output-secret-masking
test('the matrix has one entry per shard with work and nothing a secret could match', () => {
  // Verify run 38209389895 masked the digit 1: `[0,1]` would have been
  // dropped, and every shard skipped.
  expect(shardMatrix({ shards: [] })).toBe('[]');
  expect(shardMatrix({ shards: [0, 1, 2] })).toBe('["-","--","---"]');
  for (const count of [1, 40, 64]) {
    const matrix = shardMatrix({
      shards: Array.from({ length: count }, (_, shard) => shard),
    });
    const entries = JSON.parse(matrix) as string[];
    expect(entries).toHaveLength(count);
    expect(new Set(entries).size).toBe(count);
    expect(matrix).not.toMatch(/[0-9a-z]/i);
  }
});

test('a fully cached plan schedules nothing and still accounts for every task', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'verify-schedule-'));
  try {
    const plan = balanceShards(CACHED, 8, 120);
    const output = join(fixture, 'github-output');
    const schedule = writeSchedule(plan, fixture, output);
    expect(schedule.shards).toEqual([]);
    expect(schedule.consumers).toBe(false);
    // The job output the workflow builds the shard matrix from.
    expect(readFileSync(output, 'utf8')).toBe('shards=[]\n');
    const recorded = schedule.cached.map((index) => {
      const entries = archiveEntries(
        join(fixture, `.cache/verify-ci/cached/results-${index}.tar.gz`)
      );
      // The verdict and report jobs read the same archives a shard uploads.
      expect(evidencePaths(entries, 'verdict', plan)).toEqual([
        `.cache/verify-ci/results/shard-${index}.json`,
      ]);
      expect(
        archiveEntries(
          join(fixture, `.cache/verify-ci/cached/evidence-${index}.tar.gz`)
        )
      ).toEqual(entries);
      return JSON.parse(
        readFileSync(
          join(fixture, `.cache/verify-ci/results/shard-${index}.json`),
          'utf8'
        )
      ) as ReturnType<typeof cachedShardResult>;
    });
    for (const result of recorded)
      validateShardResult(plan.shards[result.index]!, result.tasks);
    const verdict = summarize({
      planned: plan.tasks.map((item) => item.taskId),
      shards: recorded,
      jobs: jobResults({ start: 'success', shards: 'skipped' }, schedule),
    });
    expect(verdict.passed).toBe(true);
    expect(verdict.jobs).toEqual([
      { name: 'verify:start', result: 'success' },
      { name: 'verify:shards', result: 'cached' },
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
  expect(verifySchedule(plan).cached).not.toContain(0);
});

test('a scheduled stage that was skipped fails the verdict', () => {
  const plan = balanceShards([...CACHED, task('leaf#test', false)], 4, 120);
  const schedule = verifySchedule(plan);
  const cached = schedule.cached.map((index) =>
    cachedShardResult(plan.shards[index]!)
  );
  const verdict = summarize({
    planned: plan.tasks.map((item) => item.taskId),
    shards: cached,
    jobs: jobResults({ start: 'success', shards: 'skipped' }, schedule),
  });
  expect(verdict.passed).toBe(false);
  expect(verdict.jobs.find((job) => job.name === 'verify:shards')).toEqual({
    name: 'verify:shards',
    result: 'skipped',
  });
  // Nothing the skipped shard owned has a verdict.
  expect(verdict.failures).toBe(plan.shards[0]!.tasks.length);
});

test('skipped never passes without a plan, and no job can claim to be cached', () => {
  expect(
    jobResults({ start: 'skipped', shards: 'skipped' }, null).map(
      (job) => job.result
    )
  ).toEqual(['skipped', 'skipped']);
  expect(
    jobResults({ start: 'cached', shards: 'cached' }, { shards: [] }).map(
      (job) => job.result
    )
  ).toEqual(['unknown', 'unknown']);
  expect(
    jobResults({ start: undefined, shards: undefined }, { shards: [] }).map(
      (job) => job.result
    )
  ).toEqual(['unknown', 'unknown']);
  // The start always runs.
  expect(
    jobResults({ start: 'skipped', shards: 'skipped' }, { shards: [] }).map(
      (job) => job.result
    )
  ).toEqual(['skipped', 'cached']);
});
