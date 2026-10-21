import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { checkObjectiveSpec } from '@pkgs/openslo-shared-ts/check';
import { objectiveSpecStem } from '@pkgs/openslo-shared-ts/registry';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import type { GitHubSource } from './health-job-results';
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

/** Recorded Actions run pages and per-attempt job pages. */
function fakeGitHub(runs: ReadonlyMap<number, readonly FakeJob[]>) {
  const asked: URL[] = [];
  const ids = [...runs.keys()];
  const http: HttpClient = {
    fetch: async (input, init) => {
      const url = new URL(String(input));
      asked.push(url);
      if (new Headers(init?.headers).get('Authorization') !== 'Bearer token-1')
        return new Response('', { status: 401 });
      const page = Number(url.searchParams.get('page'));
      const start = (page - 1) * 100;
      if (url.pathname.endsWith('/runs'))
        return Response.json({
          workflow_runs: ids
            .slice(start, start + 100)
            .map((id) => ({ id, run_attempt: 1 })),
        });
      const id = Number(/runs\/(\d+)/.exec(url.pathname)?.[1]);
      return Response.json({
        jobs: (runs.get(id) ?? []).slice(start, start + 100).map((job) => ({
          name: job.name,
          status: job.status ?? 'completed',
          conclusion: job.conclusion,
          completed_at: new Date(job.at).toISOString(),
        })),
      });
    },
  };
  return { http, asked };
}

function source(http: HttpClient): GitHubSource {
  return {
    http,
    apiUrl: 'https://api.github.test',
    repository: 'team/app',
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

describe('the team checks of one environment, from GitHub Actions', () => {
  test('missing Actions history credentials fail instead of passing silently', () => {
    expect(() => healthHistoryToken({})).toThrow(
      'GH_TOKEN or GITHUB_TOKEN is missing'
    );
    expect(healthHistoryToken({ GITHUB_TOKEN: 'workflow-token' })).toBe(
      'workflow-token'
    );
  });

  test('uses the supplied CLI token before a fallback workflow token', () => {
    assertProperty(
      'explicit history credentials take precedence',
      fc.property(
        fc.string().filter((token) => token.trim().length > 0),
        fc.option(fc.string(), { nil: undefined }),
        (token, fallback) =>
          expect(
            healthHistoryToken({ GH_TOKEN: token, GITHUB_TOKEN: fallback })
          ).toBe(token.trim())
      )
    );
  });

  test('each finished check of the environment in the window is one event, good when it succeeded', async () => {
    const at = NOW_MS - DAY_MS;
    const { http } = fakeGitHub(
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

  // regression: ci-provider-native-health-history
  test('pages beyond 100 runs, targets only main Health, and reads every attempt', async () => {
    const { http, asked } = fakeGitHub(hourlyRuns(Array(150).fill('success')));
    const measured = await healthCheckEvents(source(http), {
      env: 'prd',
      ...WINDOW,
    });
    expect(measured.kind === 'events' && measured.events.length).toBe(150);
    const pages = asked.filter((url) => url.pathname.endsWith('/runs'));
    expect(pages.map((url) => url.searchParams.get('page'))).toEqual([
      '1',
      '2',
    ]);
    expect(
      pages.every(
        (url) =>
          url.pathname.endsWith(`/workflows/${HEALTH_WORKFLOW_FILE}/runs`) &&
          url.searchParams.get('branch') === 'main'
      )
    ).toBe(true);
    expect(
      asked.some((url) => url.pathname.endsWith('/runs/150/attempts/1/jobs'))
    ).toBe(true);
  });

  test('counts the failed original and successful rerun separately', async () => {
    const asked: string[] = [];
    const http: HttpClient = {
      fetch: async (input) => {
        const path = new URL(String(input)).pathname;
        asked.push(path);
        if (path.endsWith('/runs'))
          return Response.json({ workflow_runs: [{ id: 1, run_attempt: 2 }] });
        const original = path.includes('/attempts/1/');
        return Response.json({
          jobs: [
            {
              name: 'health:prd',
              status: 'completed',
              conclusion: original ? 'failure' : 'success',
              completed_at: new Date(
                original ? NOW_MS - 1 : NOW_MS
              ).toISOString(),
            },
          ],
        });
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
    expect(asked).toContain('/repos/team/app/actions/runs/1/attempts/2/jobs');
  });

  test('pages all jobs in each attempt and counts timeouts as failures', async () => {
    const jobs = Array.from({ length: 101 }, (_, index) => ({
      name: index === 100 ? 'health:prd' : 'unrelated',
      conclusion: 'timed_out',
      at: NOW_MS,
    }));
    const f = fakeGitHub(new Map([[1, jobs]]));
    expect(
      await healthCheckEvents(source(f.http), { env: 'prd', ...WINDOW })
    ).toEqual({ kind: 'events', events: [{ atMs: NOW_MS, good: false }] });
    expect(
      f.asked.some(
        (url) =>
          url.pathname.endsWith('/jobs') && url.searchParams.get('page') === '2'
      )
    ).toBe(true);
  });

  test('a refused request fails the measure', async () => {
    const { http } = fakeGitHub(hourlyRuns(['success']));
    const refused = healthCheckEvents(
      { ...source(http), token: 'wrong' },
      { env: 'prd', ...WINDOW }
    );
    await expect(refused).rejects.toThrow('answered 401');
  });
});

describe('the app answers people (availability objective)', () => {
  async function verdict(conclusions: readonly string[]) {
    const { http } = fakeGitHub(hourlyRuns(conclusions));
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
