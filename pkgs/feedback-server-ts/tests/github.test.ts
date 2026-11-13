import { expect, test } from 'bun:test';
import { createRuntime } from '@crvouga/mockingbird-service-github';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import {
  BUG_REPORT_PATH,
  createBugReportHttpApp,
} from '@pkgs/feedback-server-ts/bug-report-http-app';
import { GitHubBugReportRecords } from '@pkgs/feedback-server-ts/github-bug-report-records';
import { objectStoreBugReportAttachments } from '@pkgs/feedback-server-ts/object-store-bug-reports';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

const ORIGIN = 'https://app.example';
const GITHUB = 'http://github.mock';
const ALICE = '22222222-2222-4222-8222-222222222222';
const BOB = '33333333-3333-4333-8333-333333333333';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DAY_MS = 24 * 60 * 60_000;

function reportId(index: number): string {
  return `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
}

type Issue = {
  readonly number: number;
  readonly title: string;
  readonly body: string;
  readonly state: string;
  readonly labels: readonly { readonly name: string }[];
};

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

/** One intake over GitHub: a Worker that remembers nothing of the last. */
function intake(
  http: HttpClient,
  clock: Clock,
  options: { readonly repository?: string; readonly environment?: string } = {}
) {
  return createBugReportHttpApp({
    store: {
      records: new GitHubBugReportRecords({
        http,
        token: 'secret-token',
        repository: options.repository ?? 'team/app',
        environment: options.environment ?? 'prd',
        apiOrigin: GITHUB,
        reportBaseUrl: `${ORIGIN}${BUG_REPORT_PATH}/reports`,
      }),
      attachments: objectStoreBugReportAttachments(
        new ObjectStoreImplInMemory()
      ),
    },
    clock,
    allowedOrigins: [ORIGIN],
  });
}

/** The intake and the issue writer in front of a simulated GitHub holding `team/app`. */
async function backend(repository = 'team/app') {
  const { clock } = createHarnessClock({
    startMs: Date.parse('2026-03-02T10:00:00.000Z'),
  });
  const gitHub = createRuntime({ clock: serviceClock(clock), seed: 1 });
  const http: HttpClient = {
    fetch: (input, init) => gitHub.fetch(new Request(input, init)),
  };
  await http.fetch(`${GITHUB}/__admin/github/repositories`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ owner: 'team', name: 'app' }),
  });
  const app = intake(http, clock, { repository });
  const send = (
    index = 1,
    options: {
      readonly reporterId?: string;
      readonly to?: (request: Request) => Promise<Response>;
    } = {}
  ): Promise<Response> => {
    const form = new FormData();
    form.set(
      'report',
      JSON.stringify({
        schema: 'bug-report/v1',
        id: reportId(index),
        reporterId: options.reporterId ?? ALICE,
        description: 'The board froze',
        createdAt: new Date(clock.now()).toISOString(),
        debugInfo: { events: [], details: [] },
      })
    );
    form.append(
      'screenshot',
      new Blob([PNG], { type: 'image/png' }),
      'screenshot'
    );
    return (options.to ?? app)(
      new Request(`${ORIGIN}${BUG_REPORT_PATH}`, {
        method: 'POST',
        body: form,
        headers: { Origin: ORIGIN },
      })
    );
  };
  return {
    app,
    clock,
    gitHub,
    http,
    send,
    /** The bug reports, found the way an agent picking one up finds them. */
    async openBugReports(): Promise<readonly Issue[]> {
      const response = await http.fetch(
        `${GITHUB}/repos/team/app/issues?labels=bug-report&state=open&per_page=100`,
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
    'env:prd',
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

test('a bug report sent again to a Worker that remembers nothing is still one issue', async () => {
  const { clock, http, send, openBugReports } = await backend();
  expect((await send()).status).toBe(201);
  const fresh = intake(http, clock);
  expect((await send(1, { to: fresh })).status).toBe(200);
  expect((await send(1, { reporterId: BOB, to: fresh })).status).toBe(409);
  expect(await openBugReports()).toHaveLength(1);
});

test("a device's daily limit is counted from GitHub, per environment", async () => {
  const { clock, http, send, openBugReports } = await backend();
  for (let index = 1; index <= 10; index++)
    expect((await send(index)).status).toBe(201);
  expect((await send(11, { to: intake(http, clock) })).status).toBe(429);
  expect((await send(12, { reporterId: BOB })).status).toBe(201);
  const dev = intake(http, clock, { environment: 'dev' });
  expect((await send(13, { to: dev })).status).toBe(201);
  clock.advance(DAY_MS);
  expect((await send(11, { to: intake(http, clock) })).status).toBe(201);
  expect(await openBugReports()).toHaveLength(13);
}, 30_000);

test('the health address names what is not ready', async () => {
  const { clock, http } = await backend();
  const app = createBugReportHttpApp({
    store: {
      records: new GitHubBugReportRecords({
        http,
        token: 'secret-token',
        repository: 'team/app',
        environment: 'prd',
        apiOrigin: GITHUB,
      }),
      attachments: {
        put: () => Promise.reject(new Error('unreachable')),
        get: () => Promise.reject(new Error('unreachable')),
        check: () => Promise.reject(new Error('unreachable')),
      },
    },
    clock,
    allowedOrigins: [ORIGIN],
  });
  const health = await app(new Request(`${ORIGIN}${BUG_REPORT_PATH}/health`));
  expect(health.status).toBe(503);
  expect(await health.json()).toEqual({
    receiving: false,
    reason: 'the attachment store is unreachable',
  });
});
