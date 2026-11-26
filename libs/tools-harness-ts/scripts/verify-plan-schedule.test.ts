import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { archiveEntries } from './verify-evidence-archive';
import { evidencePaths } from './verify-evidence-selection';
import {
  cachedShardResult,
  canSharePlanningRunner,
  shardMatrix,
  startedFirst,
  verifySchedule,
  writeSchedule,
} from './verify-plan-schedule';
import type { VerifyTask } from './verify-shards';
import { balanceShards, validateShardResult } from './verify-shards';
import { singleRunnerStages } from './verify-single-runner';
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

// regression: release-product-build-invalidates-sibling-plan
test('a cold product build and the admin bundle check use isolated runners', () => {
  for (const hit of [false, true]) {
    const plan = balanceShards(
      [
        task('@apps/product-ts#build', hit),
        task('@apps/product-ts#verify:rendered-worker', false, [
          '@apps/product-ts#build',
        ]),
        task('@apps/admin-api-ts#verify:worker-bundle', false),
      ],
      1
    );
    expect(canSharePlanningRunner(plan, verifySchedule(plan))).toBe(hit);
  }
});

// regression: release-single-shard-runner-handoffs
test('a one-shard release runs its prerequisites, six cache misses and final consumer on the planner', () => {
  const misses = Array.from({ length: 6 }, (_, i) =>
    task(`p${i}#test`, false, ['shared#build'])
  );
  const plan = balanceShards(
    [
      ...CACHED,
      task('shared#build', false),
      ...misses,
      task(
        'report#prepare',
        false,
        misses.map((miss) => miss.taskId)
      ),
    ],
    6,
    1000
  );
  const stages = singleRunnerStages(plan);
  expect(stages).toEqual([6, 0, 7]);
  expect(
    stages.flatMap((i) => plan.shards[i]!.tasks.filter((item) => !item.hit))
  ).toHaveLength(8);
  expect(singleRunnerStages(balanceShards(CACHED, 6))).toEqual([6]);
  expect(() =>
    singleRunnerStages(
      balanceShards(
        misses.map((item) => ({ ...item, dependencies: [] })),
        6
      )
    )
  ).toThrow('Parallel shards');
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
  for (const count of [1, 40, 64]) {
    const matrix = shardMatrix({
      shards: Array.from({ length: count }, (_, shard) => shard),
    });
    const entries = JSON.parse(matrix) as Record<'-' | '+', string>[];
    expect(entries).toHaveLength(count);
    expect(new Set(entries.map((entry) => entry['+'])).size).toBe(count);
    expect(matrix).not.toMatch(/[0-9a-z]/i);
  }
});

// regression: concurrent-full-gates-exhaust-free-runners
test('eight gates in a pool share six runner slots and small runs rotate their first slot', () => {
  const lanes = new Set<string>();
  const first = new Set<string>();
  for (let run = 0; run < 8; run++) {
    const matrix = shardMatrix(
      { shards: Array.from({ length: 64 }, (_, i) => i) },
      run
    );
    const entries = JSON.parse(matrix) as Record<'-', string>[];
    first.add(entries[0]!['-']);
    for (const entry of entries) lanes.add(entry['-']);
  }
  expect(lanes.size).toBe(6);
  expect(first.size).toBe(6);
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
    expect(readFileSync(output, 'utf8')).toBe('shards=[]\nconsumers=-\n');
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
    removeTree(fixture, { whenLocked: 'leave' });
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
  const results = (
    start: string | undefined,
    shards: string | undefined,
    schedule: { shards: [] } | null
  ) => jobResults({ start, shards }, schedule).map((job) => job.result);
  expect(results('skipped', 'skipped', null)).toEqual(['skipped', 'skipped']);
  expect(results('cached', 'cached', { shards: [] })).toEqual([
    'unknown',
    'unknown',
  ]);
  expect(results(undefined, undefined, { shards: [] })).toEqual([
    'unknown',
    'unknown',
  ]);
  // The start always runs.
  expect(results('skipped', 'skipped', { shards: [] })).toEqual([
    'skipped',
    'cached',
  ]);
});
