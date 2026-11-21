import { expect, test } from 'bun:test';
import { createRuntime } from '@crvouga/mockingbird-service-github';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import {
  BUG_REPORT_PATH,
  createBugReportHttpApp,
} from '@pkgs/feedback-server-ts/bug-report-http-app';
import {
  fileBugReportIssues,
  retryDelayMs,
} from '@pkgs/feedback-server-ts/file-bug-report-issues';
import { GitHubIssueReporter } from '@pkgs/feedback-server-ts/github-issue-reporter';
import type { IssueReporter } from '@pkgs/feedback-shared-ts/types';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { openQueue } from './queue';

const ORIGIN = 'https://app.example';
const GITHUB = 'http://github.mock';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type Issue = {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly labels: readonly { readonly name: string }[];
};

function reportId(index: number): string {
  return `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
}

/** Service time is the test's clock; the test moves it, never the service. */
function serviceClock(clock: Clock) {
  return {
    now: () => clock.now(),
    set: () => undefined,
    advance: () => undefined,
    freeze: () => undefined,
    unfreeze: () => undefined,
    reset: () => undefined,
    state: () => ({ now: clock.now(), frozen: false, offsetMs: 0 }),
  };
}

/** The intake, the queue and the filing job in front of a simulated GitHub holding `team/app`. */
async function backend(repository = 'team/app') {
  const { clock } = createHarnessClock({
    startMs: Date.parse('2026-03-02T10:00:00.000Z'),
  });
  const gitHub = createRuntime({ clock: serviceClock(clock), seed: 1 });
  const http = {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      gitHub.fetch(new Request(input, init)),
  };
  await http.fetch(`${GITHUB}/__admin/github/repositories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner: 'team', name: 'app' }),
  });
  const db = await openQueue(clock);
  const store = new ObjectStoreImplInMemory();
  const app = createBugReportHttpApp({
    db,
    store,
    clock,
    allowedOrigins: [ORIGIN],
  });
  const reporter = new GitHubIssueReporter({
    http,
    token: 'secret-token',
    repository,
    apiOrigin: GITHUB,
    reportBaseUrl: `${ORIGIN}${BUG_REPORT_PATH}/reports`,
    environment: 'prd',
  });
  return {
    app,
    clock,
    db,
    gitHub,
    reporter,
    file: (using: IssueReporter = reporter) =>
      fileBugReportIssues({ db, store, reporter: using, clock, limit: 10 }),
    send(index = 1): Promise<Response> {
      const form = new FormData();
      form.set(
        'report',
        JSON.stringify({
          schema: 'bug-report/v1',
          id: reportId(index),
          reporterId: '22222222-2222-4222-8222-222222222222',
          description: `The board froze ${index}`,
          createdAt: '2026-03-02T10:00:00.000Z',
          debugInfo: { events: [], details: [] },
        })
      );
      form.append(
        'screenshot',
        new Blob([PNG], { type: 'image/png' }),
        'screenshot'
      );
      return app(
        new Request(`${ORIGIN}${BUG_REPORT_PATH}`, {
          method: 'POST',
          body: form,
          headers: { Origin: ORIGIN },
        })
      );
    },
    /** Every bug report issue, found the way an agent picking one up finds them. */
    async bugReports(): Promise<readonly Issue[]> {
      const response = await http.fetch(
        `${GITHUB}/repos/team/app/issues?labels=bug-report&state=all`,
        { headers: { Authorization: 'Bearer secret-token' } }
      );
      return (await response.json()) as readonly Issue[];
    },
    health: () => app(new Request(`${ORIGIN}${BUG_REPORT_PATH}/health`)),
  };
}

test('a received bug report is filed as an open issue labelled with its environment', async () => {
  const { app, file, send, bugReports } = await backend();
  expect((await send()).status).toBe(201);
  expect(await bugReports()).toHaveLength(0);
  expect(await file()).toEqual({ filed: [reportId(1)], failed: [] });
  const [issue, ...others] = await bugReports();
  expect(others).toHaveLength(0);
  expect(issue?.title).toBe('Bug report: The board froze 1');
  expect(issue?.state).toBe('open');
  expect(issue?.labels.map((label) => label.name).sort()).toEqual([
    'bug',
    'bug-report',
    'env:prd',
  ]);
  expect(issue?.body).toContain('The board froze 1');
  expect(issue?.body).not.toContain('secret-token');
  const screenshot = /!\[Screenshot 1\]\(([^)]+)\)/.exec(issue?.body ?? '');
  const read = await app(new Request(screenshot?.[1] ?? ''));
  expect(new Uint8Array(await read.arrayBuffer())).toEqual(PNG);
  const full = /nothing cut short: (\S+)/.exec(issue?.body ?? '');
  expect((await app(new Request(full?.[1] ?? ''))).status).toBe(200);
});

test('a bug report sent again, and filed again, is still one issue', async () => {
  const { file, send, bugReports } = await backend();
  await send();
  await file();
  expect((await send()).status).toBe(200);
  expect(await file()).toEqual({ filed: [], failed: [] });
  expect(await bugReports()).toHaveLength(1);
});

test('while GitHub is down bug reports are still received, and filed once it is back', async () => {
  const { clock, db, file, gitHub, health, send, bugReports } = await backend();
  gitHub.faults.add({ id: 'outage', method: 'POST', status: 503 });
  expect((await send(1)).status).toBe(201);
  expect(await (await health()).json()).toEqual({ receiving: true });
  const failed = await file();
  expect(failed.failed).toEqual([
    { id: reportId(1), error: 'GitHub refused the issue: 503' },
  ]);
  gitHub.faults.remove('outage');
  expect((await send(2)).status).toBe(201);
  // The failed one waits out its retry; the next one is not held up by it.
  expect(await file()).toEqual({ filed: [reportId(2)], failed: [] });
  const [row] = await db.query(sql<{ attempts: unknown; last_error: unknown }>`
    SELECT attempts, last_error FROM feedback_bug_reports WHERE id = ${reportId(1)}
  `);
  expect({ attempts: Number(row?.attempts), error: row?.last_error }).toEqual({
    attempts: 1,
    error: 'GitHub refused the issue: 503',
  });
  clock.advance(retryDelayMs(1));
  expect(await file()).toEqual({ filed: [reportId(1)], failed: [] });
  expect(await bugReports()).toHaveLength(2);
});

test('filing again after a crash between making the issue and noting it makes no second issue', async () => {
  const { clock, db, file, reporter, send, bugReports } = await backend();
  await send();
  const crashing: IssueReporter = {
    async create(report, receivedAt) {
      await reporter.create(report, receivedAt);
      throw new Error('crashed before noting the issue');
    },
  };
  expect((await file(crashing)).filed).toEqual([]);
  clock.advance(retryDelayMs(1));
  expect(await file()).toEqual({ filed: [reportId(1)], failed: [] });
  const issues = await bugReports();
  expect(issues).toHaveLength(1);
  const [row] = await db.query(sql<{ issue_url: unknown }>`
    SELECT issue_url FROM feedback_bug_reports WHERE id = ${reportId(1)}
  `);
  expect(String(row?.issue_url)).toEndWith(`/issues/${issues[0]?.number}`);
});

test('retries wait longer each time, up to six hours', () => {
  expect([1, 2, 3, 10].map(retryDelayMs)).toEqual([
    5 * 60_000,
    10 * 60_000,
    20 * 60_000,
    6 * 60 * 60_000,
  ]);
});

test('a repository GitHub does not have fails filing, never receiving', async () => {
  const { file, send, health } = await backend('team/elsewhere');
  expect((await send()).status).toBe(201);
  expect((await health()).status).toBe(200);
  expect((await file()).failed).toHaveLength(1);
});

test('a repository or environment that could reach elsewhere is refused before anything is sent', () => {
  const http = { fetch: () => Promise.reject(new Error('unused')) };
  expect(
    () =>
      new GitHubIssueReporter({
        http,
        token: 't',
        repository: 'team/app/../../user',
      })
  ).toThrow();
  expect(
    () =>
      new GitHubIssueReporter({
        http,
        token: 't',
        repository: 'team/app',
        environment: 'prd,admin',
      })
  ).toThrow();
});
