import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  BUG_REPORT_PATH,
  createBugReportHttpApp,
} from '@pkgs/feedback-server-ts/bug-report-http-app';
import { GitHubIssueReporter } from '@pkgs/feedback-server-ts/github-issue-reporter';
import type { BugReport } from '@pkgs/feedback-shared-ts/types';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';

const ORIGIN = 'https://app.example';
const ALICE = '22222222-2222-4222-8222-222222222222';
const BOB = '33333333-3333-4333-8333-333333333333';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DAY_MS = 24 * 60 * 60_000;

function reportId(index: number): string {
  return `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
}

function backend() {
  const { clock } = createHarnessClock({
    startMs: Date.parse('2026-03-02T10:00:00.000Z'),
  });
  const issues: BugReport[] = [];
  let failing = false;
  const app = createBugReportHttpApp({
    reporter: {
      create(report) {
        if (failing) return Promise.reject(new Error('down'));
        issues.push(report);
        return Promise.resolve({ id: String(issues.length) });
      },
    },
    store: new ObjectStoreImplInMemory(),
    clock,
    allowedOrigin: ORIGIN,
  });
  const send = (
    index: number,
    options: {
      reporterId?: string;
      pictures?: readonly Blob[];
      origin?: string;
    } = {}
  ): Promise<Response> => {
    const form = new FormData();
    form.set(
      'report',
      JSON.stringify({
        schema: 'bug-report/v1',
        id: reportId(index),
        reporterId: options.reporterId ?? ALICE,
        description: `Bug number ${index}`,
        createdAt: new Date(clock.now()).toISOString(),
        debugInfo: { events: [], details: [] },
      })
    );
    for (const picture of options.pictures ?? [])
      form.append('screenshot', picture, 'screenshot');
    return app(
      new Request(`${ORIGIN}${BUG_REPORT_PATH}`, {
        method: 'POST',
        body: form,
        headers: { Origin: options.origin ?? ORIGIN },
      })
    );
  };
  return {
    app,
    clock,
    issues,
    send,
    fail(next: boolean): void {
      failing = next;
    },
  };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const picture = (bytes: Uint8Array<ArrayBuffer> | string = PNG): Blob =>
  new Blob([bytes], { type: 'image/png' });

// regression: feedback-reload-repeats-submission
test('a bug report sent again, or twice at once, is still one issue', async () => {
  const { issues, send } = backend();
  const [first, second] = await Promise.all([send(1), send(1)]);
  expect([first.status, second.status]).toEqual([201, 201]);
  expect((await send(1)).status).toBe(200);
  expect(issues).toHaveLength(1);
});

test('a bug report the issue tracker refused is taken again later, once', async () => {
  const { issues, send, fail } = backend();
  fail(true);
  expect((await send(1)).status).toBe(503);
  fail(false);
  expect((await send(1)).status).toBe(201);
  expect(issues).toHaveLength(1);
});

test("another device cannot send under a bug report's id", async () => {
  const { issues, send } = backend();
  await send(1);
  expect((await send(1, { reporterId: BOB })).status).toBe(409);
  expect(issues).toHaveLength(1);
});

test('a device sends ten bug reports a day, and again the next day', async () => {
  const { clock, issues, send } = backend();
  for (let index = 1; index <= 10; index++)
    expect((await send(index)).status).toBe(201);
  expect((await send(11)).status).toBe(429);
  expect((await send(12, { reporterId: BOB })).status).toBe(201);
  expect((await send(3)).status).toBe(200);
  clock.advance(DAY_MS);
  expect((await send(11)).status).toBe(201);
  expect(issues).toHaveLength(12);
});

test('pictures are kept and read back at the address the issue shows', async () => {
  const { app, issues, send } = backend();
  expect((await send(1, { pictures: [picture(), picture(JPEG)] })).status).toBe(
    201
  );
  const [first, second] = issues[0]?.screenshots ?? [];
  expect(first?.url).toBe(
    `${ORIGIN}${BUG_REPORT_PATH}/reports/${reportId(1)}/screenshots/1`
  );
  expect(second?.contentType).toBe('image/jpeg');
  const read = await app(new Request(first?.url ?? ''));
  expect(read.headers.get('Content-Type')).toBe('image/png');
  expect(read.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(new Uint8Array(await read.arrayBuffer())).toEqual(PNG);
  const report = await app(
    new Request(`${ORIGIN}${BUG_REPORT_PATH}/reports/${reportId(1)}`)
  );
  expect(((await report.json()) as BugReport).description).toBe('Bug number 1');
});

test.each([
  ['a drawing that can run scripts', [picture('<svg xmlns="x"></svg>')]],
  ['a page dressed as a picture', [picture('<html><script>')]],
  ['an empty picture', [picture('')]],
  ['more than four pictures', Array.from({ length: 5 }, () => picture())],
])('a bug report with %s is refused whole', async (_name, pictures) => {
  const { issues, send } = backend();
  expect((await send(1, { pictures })).status).toBe(400);
  expect(issues).toHaveLength(0);
});

test('only the app itself may send, and only what the archive holds is read', async () => {
  const { app, issues, send } = backend();
  expect((await send(1, { origin: 'https://evil.example' })).status).toBe(403);
  expect(issues).toHaveLength(0);
  const paths = [
    `/reports/${reportId(9)}`,
    '/reports/..%2F..%2Flimits',
    `/reports/${reportId(1)}/screenshots/0`,
    `/reports/${reportId(1)}/receipt.json`,
  ];
  for (const path of paths) {
    const read = await app(new Request(`${ORIGIN}${BUG_REPORT_PATH}${path}`));
    expect(read.status).toBe(404);
  }
});

test('the GitHub issue is written with the token kept out of its text', async () => {
  const requests: { url: string; init: RequestInit }[] = [];
  const reporter = new GitHubIssueReporter({
    http: {
      fetch(input, init) {
        requests.push({ url: String(input), init: init ?? {} });
        return Promise.resolve(
          Response.json(
            { number: 7, html_url: 'https://github.com/team/app/issues/7' },
            { status: 201 }
          )
        );
      },
    },
    token: 'secret-token',
    repository: 'team/app',
    reportBaseUrl: `${ORIGIN}${BUG_REPORT_PATH}/reports`,
  });
  const created = await reporter.create({
    schema: 'bug-report/v1',
    id: reportId(1),
    reporterId: ALICE,
    description: 'The board froze',
    createdAt: '2026-03-02T10:00:00.000Z',
    debugInfo: { events: [], details: [] },
    screenshots: [],
  });
  expect(created).toEqual({
    id: '7',
    url: 'https://github.com/team/app/issues/7',
  });
  const [request] = requests;
  expect(request?.url).toBe('https://api.github.com/repos/team/app/issues');
  expect(new Headers(request?.init.headers).get('Authorization')).toBe(
    'Bearer secret-token'
  );
  const body = String(request?.init.body);
  expect(body).not.toContain('secret-token');
  expect(JSON.parse(body)).toMatchObject({
    title: 'Bug report: The board froze',
  });
  expect(body).toContain(`${BUG_REPORT_PATH}/reports/${reportId(1)}`);
});

test('a repository that is not owner/name is refused before anything is sent', () => {
  expect(
    () =>
      new GitHubIssueReporter({
        http: { fetch: () => Promise.reject(new Error('unused')) },
        token: 't',
        repository: 'team/app/../../user',
      })
  ).toThrow();
});
