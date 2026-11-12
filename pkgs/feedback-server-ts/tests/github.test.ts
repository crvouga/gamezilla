import { expect, test } from 'bun:test';
import { createRuntime } from '@crvouga/mockingbird-service-github';
import {
  BUG_REPORT_PATH,
  createBugReportHttpApp,
} from '@pkgs/feedback-server-ts/bug-report-http-app';
import { GitHubIssueReporter } from '@pkgs/feedback-server-ts/github-issue-reporter';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

const ORIGIN = 'https://app.example';
const GITHUB = 'http://github.mock';
const REPORT_ID = '11111111-1111-4111-8111-000000000001';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type Issue = {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly labels: readonly { readonly name: string }[];
};

/** The intake and the issue writer in front of a simulated GitHub holding `team/app`. */
async function backend(repository = 'team/app') {
  const gitHub = createRuntime({ seed: 1 });
  const http = {
    fetch: (input: RequestInfo | URL, init?: RequestInit) =>
      gitHub.fetch(new Request(input, init)),
  };
  await http.fetch(`${GITHUB}/__admin/github/repositories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner: 'team', name: 'app' }),
  });
  const app = createBugReportHttpApp({
    reporter: new GitHubIssueReporter({
      http,
      token: 'secret-token',
      repository,
      apiOrigin: GITHUB,
      reportBaseUrl: `${ORIGIN}${BUG_REPORT_PATH}/reports`,
    }),
    store: new ObjectStoreImplInMemory(),
    clock: { now: () => Date.parse('2026-03-02T10:00:00.000Z') },
    allowedOrigins: [ORIGIN],
  });
  return {
    app,
    gitHub,
    send(): Promise<Response> {
      const form = new FormData();
      form.set(
        'report',
        JSON.stringify({
          schema: 'bug-report/v1',
          id: REPORT_ID,
          reporterId: '22222222-2222-4222-8222-222222222222',
          description: 'The board froze',
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
    /** The open bug reports, found the way an agent picking one up finds them. */
    async openBugReports(): Promise<readonly Issue[]> {
      const response = await http.fetch(
        `${GITHUB}/repos/team/app/issues?labels=bug-report&state=open`,
        { headers: { Authorization: 'Bearer secret-token' } }
      );
      return (await response.json()) as readonly Issue[];
    },
    health: () => app(new Request(`${ORIGIN}${BUG_REPORT_PATH}/health`)),
  };
}

test('a bug report sent to the intake is an open, labelled issue on GitHub', async () => {
  const { app, send, openBugReports } = await backend();
  expect((await send()).status).toBe(201);
  const [issue, ...others] = await openBugReports();
  expect(others).toHaveLength(0);
  expect(issue?.title).toBe('Bug report: The board froze');
  expect(issue?.labels.map((label) => label.name).sort()).toEqual([
    'bug',
    'bug-report',
  ]);
  expect(issue?.body).toContain('The board froze');
  expect(issue?.body).not.toContain('secret-token');
  const screenshot = /!\[Screenshot 1\]\(([^)]+)\)/.exec(issue?.body ?? '');
  const read = await app(new Request(screenshot?.[1] ?? ''));
  expect(new Uint8Array(await read.arrayBuffer())).toEqual(PNG);
  const full = /nothing cut short: (\S+)/.exec(issue?.body ?? '');
  expect((await app(new Request(full?.[1] ?? ''))).status).toBe(200);
});

test('a bug report sent again is still one issue on GitHub', async () => {
  const { send, openBugReports } = await backend();
  await send();
  expect((await send()).status).toBe(200);
  expect(await openBugReports()).toHaveLength(1);
});

test('a bug report GitHub would not take is taken once GitHub is back', async () => {
  const { gitHub, send, health, openBugReports } = await backend();
  gitHub.faults.add({ id: 'outage', method: 'POST', status: 503 });
  expect((await send()).status).toBe(503);
  expect((await health()).status).toBe(503);
  gitHub.faults.remove('outage');
  expect(await (await health()).json()).toEqual({ receiving: true });
  expect((await send()).status).toBe(201);
  expect(await openBugReports()).toHaveLength(1);
});

test('asking whether bug reports are received opens no issue', async () => {
  const { health, openBugReports } = await backend();
  expect(await (await health()).json()).toEqual({ receiving: true });
  expect(await openBugReports()).toHaveLength(0);
});

test('a repository GitHub does not have is not receiving', async () => {
  const { send, health } = await backend('team/elsewhere');
  expect((await health()).status).toBe(503);
  expect((await send()).status).toBe(503);
});
