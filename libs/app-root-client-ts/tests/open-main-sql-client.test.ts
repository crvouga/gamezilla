import { afterAll, beforeAll, expect, test } from 'bun:test';
import { openMainSqlClient } from '@libs/app-root-client-ts/open-main-sql-client';
import { SpanStatusCode, trace } from '@opentelemetry/api';
import type { BrowserTelemetry } from '@pkgs/observability-root-client-ts/browser';
import { createBrowserTelemetry } from '@pkgs/observability-root-client-ts/browser';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import sql from '@pkgs/sql-root-shared-ts/sql';

type FinishedSpan = {
  readonly name: string;
  readonly attributes: Readonly<Record<string, unknown>>;
  readonly status: { readonly code: number; readonly message?: string };
  readonly events: readonly { readonly name: string }[];
};

const finished: FinishedSpan[] = [];
const exporter = {
  export(
    spans: readonly FinishedSpan[],
    done: (result: { code: number }) => void
  ) {
    finished.push(...spans);
    done({ code: 0 });
  },
  shutdown: () => Promise.resolve(),
  forceFlush: () => Promise.resolve(),
};
let runtime: BrowserTelemetry;

beforeAll(() => {
  runtime = createBrowserTelemetry({
    serviceName: 'open-main-sql-client',
    serviceVersion: '1',
    environment: 'test',
    buildSha: 'abc',
    registerGlobal: true,
    exporter,
    instrumentFetch: false,
  });
});

afterAll(async () => {
  await runtime.shutdown();
  trace.disable();
});

const TIMERS = {
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
};

// regression: dev-sqlite-workers-served-as-html
test('landing on the in-memory stand-in is a failed db.open that names its cause', async () => {
  // This runtime has no worker to host SQLite, as in a page whose worker
  // script could not load.
  const warnings: string[] = [];
  const logger = {
    debug: () => undefined,
    info: () => undefined,
    warn: (message: string) => warnings.push(message),
    error: () => undefined,
    child: () => logger,
  };

  const client = await openMainSqlClient('user-1', TIMERS, logger);

  expect(await client.query(sql<{ one: number }>`SELECT 1 AS one`)).toEqual([
    { one: 1 },
  ]);
  await runtime.forceFlush();
  const opens = finished.filter((span) => span.name === 'db.open');
  expect(opens).toHaveLength(1);
  expect(opens[0]?.attributes[ATTR.DB_SYSTEM_NAME]).toBe('sqlite.memory');
  expect(opens[0]?.status.code).toBe(SpanStatusCode.ERROR);
  expect(opens[0]?.status.message).toContain('local SQLite unavailable');
  expect(opens[0]?.events.map((event) => event.name)).toContain('exception');
  expect(warnings).toHaveLength(1);
  await client.disconnect();
});
