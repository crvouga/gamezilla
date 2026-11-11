import { describe, expect, test } from 'bun:test';
import type { WorkItemsDocument } from '@libs/observability-server-ts/alert-work-items';
import { encodeLogBlock } from '@libs/observability-server-ts/alert-work-items-render';
import type {
  GhPort,
  HealthRun,
} from '@libs/observability-server-ts/open-alerts';
import {
  failingScenarios,
  findOpenAlerts,
  forEnvironment,
  formatAge,
  openAlertsJson,
  renderOpenAlerts,
} from '@libs/observability-server-ts/open-alerts';

const NOW = Date.parse('2026-11-09T12:00:00Z');

function run(id: number, createdAt: string): HealthRun {
  return {
    databaseId: id,
    createdAt,
    url: `https://github.com/o/r/actions/runs/${String(id)}`,
    headSha: `${String(id)}abcdef0`,
    conclusion: 'failure',
    event: 'schedule',
  };
}

function item(environment: string) {
  return {
    id: `${environment}:the-app-serves-people`,
    environment,
    slo: 'the-app-serves-people',
    title: 'The app serves people',
    specUri: 'specs/runtime/request-success.openslo.yaml',
    whatIsBroken: `In ${environment}, it is broken.`,
    owner: 'runtime',
    runbook: 'https://example.test/runbook',
    investigate: `bun obs errors --since 1d --source prod --env ${environment}`,
    checks: [],
    numbers: {
      window: '28d',
      target: 0.9999,
      observed: 0.99,
      considered: 10,
      budgetRemaining: null,
      burnRates: [],
    },
    evidence: {
      command: null,
      status: 'skipped' as const,
      note: 'none',
      routes: [],
      messages: [],
      traces: [],
      truncated: [],
    },
    inspect: [],
    provesFixed: [],
  };
}

const DOC: WorkItemsDocument = {
  version: 1,
  generatedAt: '2026-11-09T09:30:00.000Z',
  environments: ['dev', 'prd'],
  items: [item('dev'), item('prd')],
};

type FakeRun = {
  readonly run: HealthRun;
  readonly jobs: readonly {
    readonly databaseId: number;
    readonly name: string;
    readonly conclusion: string;
    readonly url: string;
    readonly log?: string;
  }[];
};

/** A fake `gh` over a list of runs, recording what was asked. */
function fakeGh(runs: readonly FakeRun[], asked: string[][]): GhPort {
  const jobs = runs.flatMap((r) => r.jobs);
  return (args) => {
    asked.push([...args]);
    if (args[0] === 'run' && args[1] === 'list')
      return JSON.stringify(runs.map((r) => r.run));
    if (args[0] === 'run' && args[1] === 'view' && args[3] === '--json') {
      const found = runs.find((r) => String(r.run.databaseId) === args[2]);
      return JSON.stringify({ jobs: found?.jobs ?? [] });
    }
    if (args[2] === '--job') {
      const job = jobs.find((j) => String(j.databaseId) === args[3]);
      if (job?.log === undefined) throw new Error('log expired');
      return job.log;
    }
    throw new Error(`unexpected gh ${args.join(' ')}`);
  };
}

const objectivesWithItems = (id: number) => ({
  databaseId: id,
  name: 'health:objectives',
  conclusion: 'failure',
  url: `https://github.com/o/r/actions/runs/2/job/${String(id)}`,
  log: `health:objectives\tCollect alert evidence\t2026-11-09T09:30:00Z ${encodeLogBlock(DOC)}`,
});

const RUNS: readonly FakeRun[] = [
  // Newest: yielded to a deploy, so no objectives result.
  {
    run: { ...run(3, '2026-11-09T11:17:00Z'), conclusion: 'success' },
    jobs: [
      {
        databaseId: 31,
        name: 'health:matrix',
        conclusion: 'success',
        url: 'u31',
      },
      {
        databaseId: 32,
        name: 'health:objectives',
        conclusion: 'cancelled',
        url: 'u32',
      },
    ],
  },
  {
    run: run(2, '2026-11-09T09:17:00Z'),
    jobs: [
      {
        databaseId: 21,
        name: 'health:matrix',
        conclusion: 'success',
        url: 'u21',
      },
      {
        databaseId: 22,
        name: 'health:prd',
        conclusion: 'failure',
        url: 'https://github.com/o/r/actions/runs/2/job/22',
        log: [
          'health:prd\thealth:prd\t2026-11-09T09:20:00Z (pass) specs/runtime/reaching-the-app.feature > People reach the app [12.00ms]',
          'health:prd\thealth:prd\t2026-11-09T09:20:01Z (fail) specs/journeys/critical-journeys.feature > A person plays a game [5003.12ms]',
          'health:prd\thealth:prd\t2026-11-09T09:20:02Z (fail) specs/spaces/live-updates.feature > Changes reach everyone',
        ].join('\n'),
      },
      { databaseId: 23, name: 'health:dev', conclusion: 'success', url: 'u23' },
      objectivesWithItems(24),
    ],
  },
  { run: run(1, '2026-11-09T08:17:00Z'), jobs: [objectivesWithItems(14)] },
];

describe('bun alerts', () => {
  test('walks past a newer run that left no work items, and says which run it reads and how old it is', () => {
    const asked: string[][] = [];
    const found = findOpenAlerts(fakeGh(RUNS, asked), NOW);
    if ('error' in found) throw new Error(found.error);
    expect(found.run.databaseId).toBe(2);
    expect(found.ageMs).toBe(2 * 3_600_000 + 43 * 60_000);
    expect(found.skipped.map((s) => [s.run.databaseId, s.why])).toEqual([
      [
        3,
        'its health:objectives job ended cancelled (it yielded to a deploy or was cancelled)',
      ],
    ]);
    expect(found.document.items.map((i) => i.id)).toEqual([
      'dev:the-app-serves-people',
      'prd:the-app-serves-people',
    ]);
    // Only completed main runs are asked for, and run 1 is never read.
    expect(asked[0]).toEqual([
      'run',
      'list',
      '--workflow',
      'health.yml',
      '--branch',
      'main',
      '--status',
      'completed',
      '--limit',
      '20',
      '--json',
      'databaseId,createdAt,url,headSha,conclusion,event',
    ]);
    expect(asked.some((a) => a.includes('1') && a[1] === 'view')).toBe(false);
    const text = renderOpenAlerts(found);
    expect(text).toContain(
      'Health run 2 on main @2abcdef, 2h 43m ago (failure): https://github.com/o/r/actions/runs/2'
    );
    expect(text).toContain('Walked past newer run 3');
  });

  test('lists failing check jobs with their failing scenarios and log', () => {
    const found = findOpenAlerts(fakeGh(RUNS, []), NOW);
    if ('error' in found) throw new Error(found.error);
    expect(found.failingChecks).toEqual([
      {
        job: 'health:prd',
        environment: 'prd',
        conclusion: 'failure',
        url: 'https://github.com/o/r/actions/runs/2/job/22',
        scenarios: [
          'specs/journeys/critical-journeys.feature > A person plays a game',
          'specs/spaces/live-updates.feature > Changes reach everyone',
        ],
      },
    ]);
  });

  test("--env keeps one environment's items and checks", () => {
    const found = findOpenAlerts(fakeGh(RUNS, []), NOW);
    if ('error' in found) throw new Error(found.error);
    const dev = forEnvironment(found, 'dev');
    expect(dev.document.items.map((i) => i.id)).toEqual([
      'dev:the-app-serves-people',
    ]);
    expect(dev.failingChecks).toEqual([]);
    const json = JSON.parse(openAlertsJson(forEnvironment(found, 'prd'))) as {
      items: { id: string }[];
      failingChecks: { job: string }[];
      run: { databaseId: number };
    };
    expect(json.run.databaseId).toBe(2);
    expect(json.items.map((i) => i.id)).toEqual(['prd:the-app-serves-people']);
    expect(json.failingChecks.map((c) => c.job)).toEqual(['health:prd']);
  });

  test('a failed objectives job with no work items is itself a failing check', () => {
    const empty = { ...DOC, items: [] };
    const runs: FakeRun[] = [
      {
        run: run(5, '2026-11-09T11:00:00Z'),
        jobs: [
          {
            databaseId: 51,
            name: 'health:objectives',
            conclusion: 'failure',
            url: 'u51',
            log: `x ${encodeLogBlock(empty)}\nx (fail) specs/runtime/availability.openslo.yaml > measures every indicator its objectives use`,
          },
        ],
      },
    ];
    const found = findOpenAlerts(fakeGh(runs, []), NOW);
    if ('error' in found) throw new Error(found.error);
    expect(found.failingChecks.map((c) => [c.job, c.scenarios])).toEqual([
      [
        'health:objectives',
        [
          'specs/runtime/availability.openslo.yaml > measures every indicator its objectives use',
        ],
      ],
    ]);
  });

  test('no run with work items is an error that says what to do', () => {
    const found = findOpenAlerts(fakeGh([RUNS[0]!], []), NOW);
    expect(found).toEqual({
      error:
        'none of the last 20 completed Health runs on main left work items (1 looked at); dispatch one with: gh workflow run health.yml --ref main',
    });
  });

  test('scenario names and ages read plainly', () => {
    expect(failingScenarios('(fail) a > b [1.50s]\n(pass) c > d')).toEqual([
      'a > b',
    ]);
    expect(formatAge(59_000)).toBe('0m');
    expect(formatAge(26 * 3_600_000)).toBe('1d 2h');
  });
});
