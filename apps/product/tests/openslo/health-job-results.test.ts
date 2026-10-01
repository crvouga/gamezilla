import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HttpClient } from '@pkgs/http-client';
import { checkObjectiveSpec } from '@pkgs/openslo/check';
import { objectiveSpecStem } from '@pkgs/openslo/registry';
import {
  type GitHubSource,
  HEALTH_WORKFLOW_FILE,
  healthCheckEvents,
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

/** A GitHub that knows these runs (id → jobs) and records what was asked. */
function fakeGitHub(runs: ReadonlyMap<number, readonly FakeJob[]>): {
  readonly http: HttpClient;
  readonly asked: string[];
} {
  const asked: string[] = [];
  const ids = [...runs.keys()];
  const page = <T>(items: readonly T[], url: URL) => {
    const n = Number(url.searchParams.get('page'));
    const per = Number(url.searchParams.get('per_page'));
    return items.slice((n - 1) * per, n * per);
  };
  const answer = (url: URL): unknown => {
    const jobsOf = /\/actions\/runs\/(\d+)\/jobs$/.exec(url.pathname);
    if (jobsOf === null) {
      const found = page(ids, url).map((id) => ({ id }));
      return { total_count: ids.length, workflow_runs: found };
    }
    const jobs = (runs.get(Number(jobsOf[1])) ?? []).map((job) => ({
      name: job.name,
      status: job.status ?? 'completed',
      conclusion: job.conclusion,
      completed_at: new Date(job.at).toISOString(),
    }));
    return { total_count: jobs.length, jobs: page(jobs, url) };
  };
  const http: HttpClient = {
    fetch: async (input, init) => {
      const url = new URL(String(input));
      asked.push(`${url.pathname}${url.search}`);
      const auth = new Headers(init?.headers).get('Authorization');
      if (auth !== 'Bearer token-1') return new Response('', { status: 401 });
      return Response.json(answer(url));
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

  test('asks for the Health runs since a day before the window, page after page', async () => {
    const { http, asked } = fakeGitHub(hourlyRuns(Array(150).fill('success')));
    const measured = await healthCheckEvents(source(http), {
      env: 'prd',
      ...WINDOW,
    });
    expect(measured.kind === 'events' && measured.events.length).toBe(150);
    const since = new Date(WINDOW.startMs - DAY_MS).toISOString();
    const runs = `/repos/team/app/actions/workflows/${HEALTH_WORKFLOW_FILE}/runs?created=${encodeURIComponent(`>=${since}`)}&per_page=100`;
    expect(asked.slice(0, 2)).toEqual([`${runs}&page=1`, `${runs}&page=2`]);
    expect(asked).toContain(
      '/repos/team/app/actions/runs/150/jobs?filter=all&per_page=100&page=1'
    );
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
