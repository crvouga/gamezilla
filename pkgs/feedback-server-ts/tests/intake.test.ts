import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  BUG_REPORT_PATH,
  createBugReportHttpApp,
} from '@pkgs/feedback-server-ts/bug-report-http-app';
import { fileBugReportIssues } from '@pkgs/feedback-server-ts/file-bug-report-issues';
import type { BugReport } from '@pkgs/feedback-shared-ts/types';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { openQueue } from './queue';

const ORIGIN = 'https://app.example';
const ALICE = '22222222-2222-4222-8222-222222222222';
const BOB = '33333333-3333-4333-8333-333333333333';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DAY_MS = 24 * 60 * 60_000;

function reportId(index: number): string {
  return `11111111-1111-4111-8111-${String(index).padStart(12, '0')}`;
}

async function backend() {
  const { clock } = createHarnessClock({
    startMs: Date.parse('2026-03-02T10:00:00.000Z'),
  });
  const db = await openQueue(clock);
  const store = new ObjectStoreImplInMemory();
  const app = createBugReportHttpApp({
    db,
    store,
    clock,
    allowedOrigins: [ORIGIN],
  });
  /** Every received bug report, read back as the filing job reads it. */
  const received = async (): Promise<BugReport[]> => {
    const filed: BugReport[] = [];
    await fileBugReportIssues({
      db,
      store,
      clock,
      limit: 100,
      reporter: {
        create(report) {
          filed.push(report);
          return Promise.resolve({ id: report.id });
        },
      },
    });
    return filed;
  };
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
  return { app, clock, db, store, received, send };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
const picture = (bytes: Uint8Array<ArrayBuffer> | string = PNG): Blob =>
  new Blob([bytes], { type: 'image/png' });

// regression: feedback-reload-repeats-submission
test('a bug report sent again, or twice at once, is still one bug report', async () => {
  const { received, send } = await backend();
  const [first, second] = await Promise.all([send(1), send(1)]);
  expect([first.status, second.status]).toEqual([201, 201]);
  expect((await send(1)).status).toBe(200);
  expect(await received()).toHaveLength(1);
});

test('a bug report storage could not keep is taken again later, once', async () => {
  const { received, send, store } = await backend();
  const put = store.put.bind(store);
  store.put = () => Promise.reject(new Error('down'));
  expect((await send(1)).status).toBe(503);
  store.put = put;
  expect((await send(1)).status).toBe(201);
  expect(await received()).toHaveLength(1);
});

test("another device cannot send under a bug report's id", async () => {
  const { received, send } = await backend();
  await send(1);
  expect((await send(1, { reporterId: BOB })).status).toBe(409);
  expect(await received()).toHaveLength(1);
});

test('a device sends ten bug reports a day, and again the next day', async () => {
  const { clock, received, send } = await backend();
  for (let index = 1; index <= 10; index++)
    expect((await send(index)).status).toBe(201);
  expect((await send(11)).status).toBe(429);
  expect((await send(12, { reporterId: BOB })).status).toBe(201);
  expect((await send(3)).status).toBe(200);
  clock.advance(DAY_MS);
  expect((await send(11)).status).toBe(201);
  expect(await received()).toHaveLength(12);
});

test('pictures are kept and read back at the address the issue shows', async () => {
  const { app, received, send } = await backend();
  expect((await send(1, { pictures: [picture(), picture(JPEG)] })).status).toBe(
    201
  );
  const [first, second] = (await received())[0]?.screenshots ?? [];
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
  const { received, send } = await backend();
  expect((await send(1, { pictures })).status).toBe(400);
  expect(await received()).toHaveLength(0);
});

test('only the app itself may send, and only what the archive holds is read', async () => {
  const { app, received, send } = await backend();
  expect((await send(1, { origin: 'https://evil.example' })).status).toBe(403);
  expect(await received()).toHaveLength(0);
  const paths = [
    `/reports/${reportId(9)}`,
    '/reports/..%2F..%2Flimits',
    `/reports/${reportId(1)}/screenshots/0`,
    `/reports/${reportId(1)}/report.md`,
  ];
  for (const path of paths) {
    const read = await app(new Request(`${ORIGIN}${BUG_REPORT_PATH}${path}`));
    expect(read.status).toBe(404);
  }
});

test('the health address says whether a bug report sent now would be received', async () => {
  const { app, db, store } = await backend();
  const health = async () => {
    const response = await app(
      new Request(`${ORIGIN}${BUG_REPORT_PATH}/health`)
    );
    return { status: response.status, body: await response.json() };
  };
  expect(await health()).toEqual({ status: 200, body: { receiving: true } });
  const head = store.head.bind(store);
  store.head = () => Promise.reject(new Error('down'));
  expect(await health()).toEqual({
    status: 503,
    body: { receiving: false, reason: 'storage did not answer' },
  });
  store.head = head;
  await db.disconnect();
  expect(await health()).toEqual({
    status: 503,
    body: { receiving: false, reason: 'the database did not answer' },
  });
});
