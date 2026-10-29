import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { buildHistory } from './ci-stats-build';
import {
  concurrencyStats,
  demandEdges,
  runningEdges,
} from './ci-stats-concurrency';
import {
  distribution,
  type JobRecord,
  jobFamily,
  placement,
  type RunRecord,
  runnerKind,
  secondsBetween,
} from './ci-stats-history';
import { duration, renderStats, table } from './ci-stats-render';
import { parseWorkflow, profileSplit, readWorkload } from './ci-stats-workload';

const ROOT = join(import.meta.dirname, '../../..');

function job(
  overrides: Partial<JobRecord> & Pick<JobRecord, 'name'>
): JobRecord {
  return {
    workflow: 'Verify PR',
    runId: 1,
    conclusion: 'success',
    createdAt: '2026-10-01T00:00:00Z',
    startedAt: '2026-10-01T00:00:00Z',
    completedAt: '2026-10-01T00:01:00Z',
    runnerName: 'box-1',
    steps: [],
    ...overrides,
  };
}

function run(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    workflow: 'Verify PR',
    id: 1,
    event: 'pull_request',
    conclusion: 'success',
    createdAt: '2026-10-01T00:00:00Z',
    startedAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:05:00Z',
    headBranch: 'main',
    ...overrides,
  };
}

describe('history primitives', () => {
  test('a job family drops the caller prefix and the matrix index', () => {
    expect(jobFamily('deploy-verify / verify:shards (12)')).toBe(
      'verify:shards'
    );
    expect(jobFamily('verify:end')).toBe('verify:end');
    expect(jobFamily('health:dev')).toBe('health:dev');
  });

  test('seconds between rejects missing and reversed timestamps', () => {
    expect(secondsBetween('2026-10-01T00:00:00Z', '2026-10-01T00:01:30Z')).toBe(
      90
    );
    expect(secondsBetween(null, '2026-10-01T00:00:00Z')).toBeUndefined();
    expect(
      secondsBetween('2026-10-01T00:01:00Z', '2026-10-01T00:00:00Z')
    ).toBeUndefined();
  });

  test('a distribution of nothing is zeros, not NaN', () => {
    expect(distribution([])).toEqual({
      count: 0,
      p50: 0,
      p90: 0,
      p99: 0,
      max: 0,
      total: 0,
    });
    expect(distribution([1, 2, 3, 4, 100]).max).toBe(100);
  });

  test('runner kinds separate self-hosted, GitHub-hosted and none', () => {
    expect(runnerKind(job({ name: 'a', runnerName: 'DESKTOP-1-2' }))).toBe(
      'self-hosted'
    );
    expect(
      runnerKind(job({ name: 'a', runnerName: 'GitHub Actions 1000051049' }))
    ).toBe('github-hosted');
    expect(runnerKind(job({ name: 'a', runnerName: null }))).toBe('none');
  });

  test('a job that never got a runner is waiting time, not agent time', () => {
    const rows = placement([
      job({ name: 'ran', startedAt: '2026-10-01T00:00:10Z' }),
      job({
        name: 'dropped',
        runnerName: null,
        conclusion: 'cancelled',
        startedAt: null,
        completedAt: '2026-10-01T00:10:00Z',
      }),
    ]);
    const none = rows.find((row) => row.kind === 'none');
    expect(none?.jobs).toBe(1);
    expect(none?.agentHours).toBe(0);
    expect(none?.wait.max).toBe(600);
    expect(rows.find((row) => row.kind === 'self-hosted')?.wait.max).toBe(10);
  });
});

describe('concurrencyStats', () => {
  const at = (minute: number) =>
    `2026-10-01T00:${String(minute).padStart(2, '0')}:00Z`;

  test('finds the peak, what it was made of, and the overlap time', () => {
    const jobs = [
      job({
        name: 'a',
        workflow: 'Release',
        startedAt: at(0),
        completedAt: at(10),
      }),
      job({
        name: 'b',
        workflow: 'Release',
        startedAt: at(2),
        completedAt: at(8),
      }),
      job({
        name: 'c',
        workflow: 'Verify PR',
        startedAt: at(4),
        completedAt: at(6),
      }),
    ];
    const stats = concurrencyStats(runningEdges(jobs));
    expect(stats.peak).toBe(3);
    expect(stats.peakByWorkflow).toEqual({ Release: 2, 'Verify PR': 1 });
    expect(stats.busySeconds).toBe(600);
    expect(stats.overlapSeconds['Release + Verify PR']).toBe(120);
    expect(stats.levelP99).toBe(3);
  });

  test('back-to-back jobs on one agent are not an overlap', () => {
    const stats = concurrencyStats(
      runningEdges([
        job({ name: 'a', startedAt: at(0), completedAt: at(5) }),
        job({ name: 'b', startedAt: at(5), completedAt: at(10) }),
      ])
    );
    expect(stats.peak).toBe(1);
  });

  test('demand counts queued time that running does not', () => {
    const queued = job({
      name: 'a',
      createdAt: at(0),
      startedAt: at(5),
      completedAt: at(6),
    });
    const other = job({ name: 'b', startedAt: at(1), completedAt: at(6) });
    expect(concurrencyStats(runningEdges([queued, other])).peak).toBe(2);
    expect(concurrencyStats(demandEdges([queued, other])).peak).toBe(2);
    expect(concurrencyStats(runningEdges([queued])).peak).toBe(1);
    expect(concurrencyStats(demandEdges([queued])).busySeconds).toBe(360);
  });

  test('no jobs is an empty result', () => {
    expect(concurrencyStats([])).toMatchObject({ peak: 0, busySeconds: 0 });
  });
});

describe('buildHistory', () => {
  const window = { from: '2026-10-01T00:00:00Z', to: '2026-10-03T00:00:00Z' };

  test('per-run measures skip runs no runner took', () => {
    const history = buildHistory(
      [run({ id: 1 }), run({ id: 2, conclusion: 'cancelled' })],
      [
        job({ name: 'verify:shards (0)', runId: 1 }),
        job({ name: 'verify:shards (1)', runId: 1 }),
        job({
          name: 'verify:start',
          runId: 2,
          runnerName: null,
          conclusion: 'cancelled',
          completedAt: '2026-10-01T00:20:00Z',
        }),
      ],
      window
    );
    const workflow = history.workflows[0];
    expect(workflow?.runs).toBe(2);
    expect(workflow?.executedRuns).toBe(1);
    expect(workflow?.shardsPerRun.max).toBe(2);
    expect(workflow?.agentSecondsPerRun.p50).toBe(120);
    expect(workflow?.runsPerDay).toBe(1);
    expect(history.days).toBe(2);
    expect(history.running.peak).toBe(2);
    // The job that waited for a runner and was cancelled is demand, not agent time.
    expect(history.demand.peak).toBe(3);
    expect(history.placement.find((p) => p.kind === 'none')?.agentHours).toBe(
      0
    );
  });

  test('GitHub-hosted jobs count as work but not as self-hosted concurrency', () => {
    const history = buildHistory(
      [run()],
      [
        job({ name: 'verify:shards (0)' }),
        job({ name: 'verify:shards (1)', runnerName: 'GitHub Actions 9' }),
        job({ name: 'verify:shards (2)', runnerName: 'GitHub Actions 10' }),
      ],
      window
    );
    expect(history.running.peak).toBe(1);
    expect(history.runningHosted.peak).toBe(2);
    expect(history.runningAll.peak).toBe(3);
    expect(history.workflows[0]?.shardsPerRun.max).toBe(3);
    expect(history.families.map((f) => f.kind).sort()).toEqual([
      'github-hosted',
      'self-hosted',
    ]);
    expect(
      history.placement.find((p) => p.kind === 'self-hosted')?.firstAt
    ).toBe('2026-10-01T00:00:00.000Z');
  });

  test('family durations come from jobs that passed', () => {
    const history = buildHistory(
      [run()],
      [
        job({ name: 'verify:shards (0)' }),
        job({
          name: 'verify:shards (1)',
          conclusion: 'failure',
          completedAt: '2026-10-01T01:00:00Z',
        }),
      ],
      window
    );
    const family = history.families[0];
    expect(family?.jobs).toBe(2);
    expect(family?.succeeded).toBe(1);
    expect(family?.failed).toBe(1);
    expect(family?.duration.max).toBe(60);
  });
});

describe('workload', () => {
  test('a workflow file is read for its schedule, jobs, timeouts and shard cap', () => {
    const parsed = parseWorkflow(
      'x.yml',
      [
        'name: Example',
        'on:',
        '  schedule:',
        "    - cron: '23 8 * * *'",
        'env:',
        "  VERIFY_SHARDS: ${{ inputs.shards || vars.VERIFY_SHARDS || '64' }}",
        'jobs:',
        '  first:',
        '    runs-on: self-hosted',
        '    timeout-minutes: 30',
        '  second:',
        '    uses: ./.github/workflows/other.yml',
        '',
      ].join('\n')
    );
    expect(parsed.name).toBe('Example');
    expect(parsed.crons).toEqual(['23 8 * * *']);
    expect(parsed.shardCap).toBe('64');
    expect(parsed.jobs).toEqual([
      { id: 'first', runsOn: 'self-hosted', timeoutMinutes: 30 },
      { id: 'second', runsOn: '', timeoutMinutes: undefined },
    ]);
  });

  test('release-only tasks split from the pull-request profile', () => {
    const split = profileSplit([
      { id: '@a#lint', seconds: 10, source: 'history' },
      { id: '@a#test:spec:0', seconds: 200, source: 'history' },
    ]);
    expect(split.prSeconds).toBe(10);
    expect(split.releaseOnlySeconds).toBe(200);
    expect(split.longest[0]?.id).toBe('@a#test:spec:0');
    expect(split.longestPr[0]?.id).toBe('@a#lint');
  });

  test('this repository has a workload and the four workflow files', () => {
    const workload = readWorkload(ROOT);
    expect(workload.load.coldSeconds).toBeGreaterThan(0);
    expect(workload.split.prSeconds + workload.split.releaseOnlySeconds).toBe(
      workload.load.coldSeconds
    );
    expect(workload.workflows.map((w) => w.file)).toEqual(
      expect.arrayContaining([
        'deploy.yml',
        'health.yml',
        'verify-nightly.yml',
        'verify-pr.yml',
      ])
    );
  });
});

describe('render', () => {
  test('durations read as seconds, minutes or hours', () => {
    expect(duration(45)).toBe('45 s');
    expect(duration(300)).toBe('5.0 min');
    expect(duration(7200)).toBe('2.0 h');
  });

  test('an empty table says so instead of printing a bare header', () => {
    expect(table(['a'], [])).toBe('_none_');
  });

  test('the brief carries goals, key numbers, gaps and a summary, with and without history', () => {
    const workload = readWorkload(ROOT);
    const base = {
      generatedAt: '2026-10-28T00:00:00.000Z',
      repository: 'owner/repo',
      days: 14,
      budget: '$500 a month',
      goals: undefined,
      have: undefined,
      host: {
        platform: 'linux',
        arch: 'x64',
        cpuModel: 'test cpu',
        logicalCpus: 8,
        memoryGib: 16,
      },
      workload,
      variables: {},
      fleet: undefined,
      skippedRuns: 0,
    };
    const offline = renderStats({ ...base, history: undefined });
    expect(offline).toContain('# CI capacity brief: owner/repo');
    expect(offline).toContain('Budget: $500 a month');
    expect(offline).toContain('## Key numbers');
    expect(offline).toContain('Not collected');
    expect(offline).toContain('## What this data cannot tell you');
    const online = renderStats({
      ...base,
      history: buildHistory([run()], [job({ name: 'verify:shards (0)' })], {
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-02T00:00:00Z',
      }),
    });
    expect(online).toContain('### Where jobs ran');
    expect(online).toContain('### Concurrency');
    expect(online).toContain('"peakRunning": 1');
    expect(online).not.toContain('runs were left out');
    const partial = renderStats({
      ...base,
      history: undefined,
      skippedRuns: 3,
    });
    expect(partial).not.toContain('runs were left out');
    const skipped = renderStats({
      ...base,
      skippedRuns: 3,
      history: buildHistory([run()], [job({ name: 'a' })], {
        from: '2026-10-01T00:00:00Z',
        to: '2026-10-02T00:00:00Z',
      }),
    });
    expect(skipped).toContain('3 runs were left out');
  });
});
