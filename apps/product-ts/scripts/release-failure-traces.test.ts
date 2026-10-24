import { expect, test } from 'bun:test';
import { RunReporter } from '@pkgs/harness-root-shared-ts/reporter';
import { writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared-ts/impl-in-memory';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import type { NarrateSpan } from '@pkgs/observability-root-shared-ts/narrate';
import { releaseFailureTraces } from './release-failure-traces';

const START = Date.parse('2026-10-24T08:19:27.140Z');
const FAILED_CASE =
  'multiplayer-game.two-accounts-are-matched-and-can-finish-their-multiplayer-game';
const RUN = { startMs: START - 10_000, endMs: START + 100_000 };

async function reportsForFailure() {
  const reports = new ObjectStoreImplInMemory();
  let now = START;
  const reporter = new RunReporter({
    system: '@apps/product-ts',
    runtime: 'gherkin',
    seed: FAILED_CASE,
    options: {
      store: reports,
      now: () => now,
      testId: FAILED_CASE,
      runId: 'latest',
      sourceFile: 'specs/journeys/multiplayer-game.feature',
      frames: false,
    },
    snapshots: [],
    surface: null,
    sessionNow: () => now,
  });
  await expect(
    reporter.record(
      { kind: 'Then', title: 'both see the same game' },
      async () => {
        now = START + 23_775;
        throw new Error('Timed out after 5000ms waiting for visible');
      }
    )
  ).rejects.toThrow('Timed out after 5000ms');
  // Evidence capture and cleanup happen after the failed observation.
  now = START + 40_000;
  await reporter.flush();
  return reports;
}

function span(
  trace: number,
  offsetMs: number,
  patch: Partial<NarrateSpan> = {}
): NarrateSpan {
  return {
    traceId: trace.toString(16).padStart(32, '0'),
    spanId: (trace * 100_000 + offsetMs + 10_000)
      .toString(16)
      .padStart(16, '0'),
    name: 'db.query',
    startTimeMs: START + offsetMs,
    durationMs: 10,
    status: 'ok',
    attributes: {},
    ...patch,
  };
}

async function telemetryOf(spans: readonly NarrateSpan[]) {
  const telemetry = new ObjectStoreImplInMemory();
  const document = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: ATTR.SERVICE_NAME, value: { stringValue: 'api' } },
          ],
        },
        scopeSpans: [
          {
            spans: spans.map((item) => ({
              traceId: item.traceId,
              spanId: item.spanId,
              ...(item.parentSpanId ? { parentSpanId: item.parentSpanId } : {}),
              name: item.name,
              startTimeUnixNano: String(BigInt(item.startTimeMs) * 1_000_000n),
              endTimeUnixNano: String(
                BigInt(item.startTimeMs + item.durationMs) * 1_000_000n
              ),
              status: { code: item.status === 'error' ? 2 : 1 },
              attributes: Object.entries(item.attributes).map(
                ([key, value]) => ({
                  key,
                  value: { stringValue: String(value) },
                })
              ),
            })),
          },
        ],
      },
    ],
  };
  await writeUtf8(telemetry, 'spans.ndjson', `${JSON.stringify(document)}\n`);
  return telemetry;
}

const findAttributes = { [ATTR.APP_MUTATION_NAME]: 'findChessOpponent' };

// regression: release-journey-erases-server-trace-evidence
test('failed-case timing keeps a queued Find and its late children, excluding later successful Finds', async () => {
  // CI 40076550953 / 120822099682 retained pending findChessOpponent and
  // chessMultiplayerSession requests, then erased the OTLP journal. These
  // controlled server spans exercise that diagnostic gap, not recovered CI spans.
  const request = span(1, 500, {
    name: 'http.server.request',
    durationMs: 45_000,
  });
  const queued = span(1, 30_000, {
    name: 'mutation.replay',
    attributes: findAttributes,
    parentSpanId: request.spanId,
  });
  const late = span(1, 35_000, {
    parentSpanId: queued.spanId,
    attributes: { [ATTR.DB_QUERY_TEXT]: 'SELECT late_completed_query' },
  });
  const telemetry = await telemetryOf([
    request,
    queued,
    late,
    span(2, 50_000, { name: 'mutation.replay', attributes: findAttributes }),
    span(3, -5_000, { name: 'http.server.request', durationMs: 45_000 }),
    span(3, 1_000, { name: 'mutation.replay', attributes: findAttributes }),
    span(4, 25_000, { name: 'mutation.replay', attributes: findAttributes }),
  ]);
  const text = await releaseFailureTraces({
    reports: await reportsForFailure(),
    telemetry,
    run: RUN,
    mutationNames: ['findChessOpponent'],
  });
  expect(text).toContain(FAILED_CASE);
  expect(text).toContain('2026-10-24T08:19:50.915Z');
  expect(text).toContain(`request trace ${request.traceId}`);
  expect(text).toContain('SELECT late_completed_query');
  for (const trace of [2, 3, 4])
    expect(text).not.toContain(`request trace ${span(trace, 0).traceId}`);
});

test('child-only traces report missing request roots and bound redacted critical work', async () => {
  const children = Array.from({ length: 100 }, (_, index) =>
    span(5, index + 1_000, {
      attributes: { [ATTR.DB_QUERY_TEXT]: `SELECT completed_${index}` },
      durationMs: index === 3 ? 3_858 : 10,
    })
  );
  const telemetry = await telemetryOf([
    span(5, 500, {
      name: 'mutation.replay',
      attributes: {
        ...findAttributes,
        authorization: 'Bearer hidden-auth-value',
        [ATTR.APP_LOG_MESSAGE]: 'callback?token=hidden-token-value',
      },
    }),
    ...children,
  ]);
  const text = await releaseFailureTraces({
    reports: await reportsForFailure(),
    telemetry,
    run: RUN,
    mutationNames: ['findChessOpponent'],
  });
  expect(text).toContain(
    'Incomplete request trace: no collected worker.fetch, http.server.request'
  );
  expect(text).toContain('no unfinished duration is inferred');
  expect(text).toContain('SELECT completed_3');
  expect(text).toContain('SELECT completed_99');
  expect(text).toContain('omitted from critical work summary');
  expect(text).not.toContain('hidden-auth-value');
  expect(text).not.toContain('hidden-token-value');
  expect(text.length).toBeLessThan(11_000);
});

// regression: release-trace-context-hides-terminal-work
test('repeated request context leaves room for terminal database work', async () => {
  const context = {
    [ATTR.SERVICE_NAME]: 'gamezilla-server',
    [ATTR.SERVICE_INSTANCE_ID]: 'release-instance',
    [ATTR.SERVICE_VERSION]: 'development',
    [ATTR.DEPLOYMENT_ENVIRONMENT_NAME]: 'dev',
    [ATTR.APP_BUILD_SHA]: 'recorded-build',
    [ATTR.APP_DEVICE_ID]: 'alice-device',
    [ATTR.USER_ID]: 'alice',
    [ATTR.CODE_FILE_PATH]: 'libs/app-root-shared-ts/src/wrap-sql-client.ts',
    [ATTR.CODE_FUNCTION_NAME]: 'runObservedSql',
  };
  const request = span(7, 500, {
    name: 'http.server.request',
    durationMs: 45_000,
    attributes: context,
  });
  const replay = span(7, 1_000, {
    name: 'mutation.replay',
    parentSpanId: request.spanId,
    attributes: { ...context, ...findAttributes },
  });
  const deliveries = Array.from({ length: 6 }, (_, index) =>
    span(7, index + 1_250, {
      name: 'outbox.deliver',
      parentSpanId: replay.spanId,
      durationMs: 15_000 + index,
      attributes: context,
    })
  );
  const children = Array.from({ length: 100 }, (_, index) =>
    span(7, index + 2_000, {
      parentSpanId: replay.spanId,
      attributes: {
        ...context,
        [ATTR.USER_ID]: index === 99 ? 'bob' : 'alice',
        [ATTR.DB_QUERY_TEXT]: `SELECT completed_${index}`,
      },
    })
  );
  const text = await releaseFailureTraces({
    reports: await reportsForFailure(),
    telemetry: await telemetryOf([request, replay, ...deliveries, ...children]),
    run: RUN,
    mutationNames: ['findChessOpponent'],
  });
  expect(text).toContain('SELECT completed_99');
  expect(text).toContain('user.id=bob');
  expect(text.match(/service.instance.id=release-instance/g)).toHaveLength(1);
  expect(text.length).toBeLessThan(11_000);
});

test('no failed timeline produces no broad fallback to a successful Find', async () => {
  const text = await releaseFailureTraces({
    reports: new ObjectStoreImplInMemory(),
    telemetry: await telemetryOf([
      span(6, 60_000, {
        name: 'mutation.replay',
        attributes: findAttributes,
      }),
    ]),
    run: RUN,
    mutationNames: ['findChessOpponent'],
  });
  expect(text).toContain('request time anchor unavailable');
  expect(text).not.toContain('request trace');
});

test('missing collector data is explicit and never invents pending spans', async () => {
  const text = await releaseFailureTraces({
    reports: await reportsForFailure(),
    telemetry: new ObjectStoreImplInMemory(),
    run: RUN,
    mutationNames: ['findChessOpponent'],
  });
  expect(text).toBe(
    'release trace evidence: native collector spans.ndjson is unavailable.'
  );
});
