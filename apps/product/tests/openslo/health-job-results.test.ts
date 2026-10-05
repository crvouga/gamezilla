import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import { checkObjectiveSpec } from '@pkgs/openslo-shared/check';
import { objectiveSpecStem } from '@pkgs/openslo-shared/registry';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import type { DepotSource } from './health-job-results';
import {
  HEALTH_WORKFLOW_FILE,
  healthCheckEvents,
  healthHistoryToken,
} from './health-job-results';

const SPEC_PATH = join(
  import.meta.dir,
  '../../../../specs/runtime/availability.openslo.yaml'
);
const SPEC = readFileSync(SPEC_PATH, 'utf8');
const NOW_MS = Date.UTC(2026, 8, 28, 12);
const DAY_MS = 86_400_000;
const WINDOW = { startMs: NOW_MS - 28 * DAY_MS, endMs: NOW_MS };

type FakeJob = {
  readonly name: string;
  readonly status?: string;
  readonly conclusion: string | null;
  readonly at: number;
};

/** Recorded native API pages, workflow details and every job attempt. */
function fakeDepot(runs: ReadonlyMap<number, readonly FakeJob[]>): {
  readonly http: HttpClient;
  readonly asked: { method: string; body: Record<string, unknown> }[];
} {
  const asked: { method: string; body: Record<string, unknown> }[] = [];
  const ids = [...runs.keys()];
  const answer = (method: string, body: Record<string, unknown>): unknown => {
    if (method === 'ListRuns') {
      const start = Number(body['pageToken'] || 0);
      const end = start + Number(body['pageSize']);
      return {
        runs: ids.slice(start, end).map((id) => ({
          runId: String(id),
          createdAt: new Date(NOW_MS).toISOString(),
        })),
        nextPageToken: end < ids.length ? String(end) : '',
      };
    }
    if (method === 'GetRunStatus')
      return {
        workflows: [
          {
            workflowId: body['runId'],
            workflowPath: `.depot/workflows/${HEALTH_WORKFLOW_FILE}`,
            name: 'Health',
          },
        ],
      };
    const jobs = (runs.get(Number(body['workflowId'])) ?? []).map((job) => ({
      jobDisplayName: job.name,
      attempts: [
        {
          status:
            job.status === 'in_progress'
              ? 'running'
              : job.conclusion === 'success'
                ? 'finished'
                : job.conclusion === 'failure'
                  ? 'failed'
                  : job.conclusion,
          finishedAt: new Date(job.at).toISOString(),
        },
      ],
    }));
    return { jobs };
  };
  const http: HttpClient = {
    fetch: async (input, init) => {
      const method = new URL(String(input)).pathname.split('/').at(-1) ?? '';
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      asked.push({ method, body });
      const headers = new Headers(init?.headers);
      if (
        headers.get('Authorization') !== 'Bearer token-1' ||
        headers.get('X-Depot-Org') !== 'org-1'
      )
        return new Response('', { status: 401 });
      return Response.json(answer(method, body));
    },
  };
  return { http, asked };
}

function source(http: HttpClient): DepotSource {
  return {
    http,
    apiUrl: 'https://api.depot.test',
    repository: 'team/app',
    orgId: 'org-1',
    token: 'token-1',
  };
}

/** One Health run per hour back from now, each with a prd check of `conclusion`. */
function hourlyRuns(conclusions: readonly string[]) {
  return new Map(
    conclusions.map((conclusion, i) => [
      i + 1,
      [
        {
          name: 'health:matrix',
          conclusion: 'success',
          at: NOW_MS - i * 3_600_000,
        },
        { name: 'health:prd', conclusion, at: NOW_MS - i * 3_600_000 },
      ],
    ])
  );
}

describe('the team checks of one environment, from Depot CI', () => {
  // regression: health-history-job-token-unauthorized
  test('a job-scoped token cannot substitute for organization history credentials', () => {
    expect(() =>
      healthHistoryToken({ DEPOT_TOKEN: 'job-attempt-token' })
    ).toThrow('DEPOT_ORG_TOKEN is missing');
    expect(
      healthHistoryToken({
        DEPOT_TOKEN: 'job-attempt-token',
        DEPOT_ORG_TOKEN: 'org-token',
      })
    ).toBe('org-token');
  });

  test('history always uses the supplied organization token regardless of the job token', () => {
    assertProperty(
      'history uses organization credentials regardless of the job token',
      fc.property(
        fc.string().filter((token) => token.trim().length > 0),
        fc.option(fc.string(), { nil: undefined }),
        (orgToken, jobToken) => {
          expect(
            healthHistoryToken({
              DEPOT_ORG_TOKEN: orgToken,
              DEPOT_TOKEN: jobToken,
            })
          ).toBe(orgToken.trim());
        }
      )
    );
  });

  test('each finished check of the environment in the window is one event, good when it succeeded', async () => {
    const at = NOW_MS - DAY_MS;
    const { http } = fakeDepot(
      new Map([
        [
          1,
          [
            { name: 'health:matrix', conclusion: 'success', at },
            { name: 'health:prd', conclusion: 'success', at },
            { name: 'health:dev', conclusion: 'failure', at },
          ],
        ],
        [
          2,
          [
            { name: 'health:prd', conclusion: 'failure', at: at + 1 },
            { name: 'health:prd', conclusion: 'cancelled', at: at + 2 },
            { name: 'health:prd', conclusion: 'skipped', at: at + 3 },
            {
              name: 'health:prd',
              status: 'in_progress',
              conclusion: null,
              at: at + 4,
            },
          ],
        ],
        [
          3,
          [
            {
              name: 'health:prd',
              conclusion: 'success',
              at: WINDOW.startMs - 1,
            },
          ],
        ],
      ])
    );
    const measured = await healthCheckEvents(source(http), {
      env: 'prd',
      ...WINDOW,
    });
    expect(measured).toEqual({
      kind: 'events',
      events: [
        { atMs: at, good: true },
        { atMs: at + 1, good: false },
      ],
    });
  });

  test('pages beyond 100 native runs and reads every workflow attempt', async () => {
    const { http, asked } = fakeDepot(hourlyRuns(Array(150).fill('success')));
    const measured = await healthCheckEvents(source(http), {
      env: 'prd',
      ...WINDOW,
    });
    expect(measured.kind === 'events' && measured.events.length).toBe(150);
    expect(
      asked
        .filter((request) => request.method === 'ListRuns')
        .map((request) => request.body['pageToken'])
    ).toEqual(['', '100']);
    expect(asked).toContainEqual({
      method: 'GetWorkflow',
      body: { workflowId: '150' },
    });
    expect(asked[0]?.body['status']).toContain('failed');
  });

  // regression: depot-native-health-history
  test('counts the failed original and successful rerun of the same native job', async () => {
    const f = fakeDepot(hourlyRuns(['success']));
    const http: HttpClient = {
      fetch: async (input, init) => {
        if (String(input).endsWith('/GetWorkflow'))
          return Response.json({
            jobs: [
              {
                jobDisplayName: 'health:prd',
                attempts: [
                  {
                    status: 'failed',
                    finishedAt: new Date(NOW_MS - 1).toISOString(),
                  },
                  {
                    status: 'finished',
                    finishedAt: new Date(NOW_MS).toISOString(),
                  },
                ],
              },
            ],
          });
        return f.http.fetch(input, init);
      },
    };
    expect(
      await healthCheckEvents(source(http), { env: 'prd', ...WINDOW })
    ).toEqual({
      kind: 'events',
      events: [
        { atMs: NOW_MS - 1, good: false },
        { atMs: NOW_MS, good: true },
      ],
    });
  });

  test('a refused request fails the measure', async () => {
    const { http } = fakeDepot(hourlyRuns(['success']));
    const refused = healthCheckEvents(
      { ...source(http), token: 'wrong' },
      { env: 'prd', ...WINDOW }
    );
    await expect(refused).rejects.toThrow('answered 401');
  });
});

describe('the app answers people (availability objective)', () => {
  async function verdict(conclusions: readonly string[]) {
    const { http } = fakeDepot(hourlyRuns(conclusions));
    const { issues, results } = await checkObjectiveSpec({
      text: SPEC,
      binding: {
        spec: objectiveSpecStem(SPEC_PATH),
        measure: {
          'team-checks-passing': ({ startMs, endMs }) =>
            healthCheckEvents(source(http), { env: 'prd', startMs, endMs }),
        },
        nowMs: () => NOW_MS,
      },
    });
    expect(issues).toEqual([]);
    return results.map((r) => [r.evaluation.met, r.evaluation.observed]);
  }

  test('99 in 100 passing checks meet it', async () => {
    const conclusions = [...Array(99).fill('success'), 'failure'];
    expect(await verdict(conclusions)).toEqual([[true, 0.99]]);
  });

  test('98 in 100 passing checks do not', async () => {
    const conclusions = [...Array(98).fill('success'), 'failure', 'failure'];
    expect(await verdict(conclusions)).toEqual([[false, 0.98]]);
  });

  test('no checks at all is no evidence', async () => {
    expect(await verdict([])).toEqual([[false, null]]);
  });
});
