import type { ObjectStore, StoredObject } from '@pkgs/object-store/interface';
import {
  ATTR,
  type Attributes,
  addEvent,
  EVENT,
} from '@pkgs/observability/core';
import {
  createNodeTelemetry,
  NdjsonSpanExporter,
  type NodeTelemetry,
} from '@pkgs/observability/node';

const START_MS = Date.parse('2026-09-22T12:00:00.000Z');

export const GYM_NOW_MS = START_MS + 60_000;

export const GYM_IDS = {
  constraint: '10000000000000000000000000000001',
  conflict: '20000000000000000000000000000002',
  offlineOrigin: '22222222222222222222222222222222',
  wrongAnswer: '30000000000000000000000000000003',
  slowQuery: '40000000000000000000000000000004',
  clientError: '50000000000000000000000000000005',
  noOp: '60000000000000000000000000000006',
  failingTest: '70000000000000000000000000000007',
} as const;

export const GYM_MUTATION_ID = 'mutation-offline-001';
export const GYM_TEST_ID = 'offline edits converge';

type OtelTracer = ReturnType<NodeTelemetry['provider']['getTracer']>;
type OtelSpan = Parameters<typeof addEvent>[0];
type SpanOptions = NonNullable<Parameters<OtelTracer['startSpan']>[1]>;

type SpanFixture = {
  readonly attributes?: Attributes;
  readonly durationMs: number;
  readonly name: string;
  readonly options?: Omit<SpanOptions, 'attributes' | 'startTime'>;
  readonly startTimeMs: number;
  readonly status?: 'error';
};

function memoryStore(): {
  readonly objectStore: ObjectStore;
  readonly text: (key: string) => string;
} {
  const values = new Map<string, Uint8Array>();
  return {
    objectStore: {
      async get(key): Promise<StoredObject | null> {
        const bytes = values.get(key);
        return bytes === undefined
          ? null
          : {
              body: new Blob([Uint8Array.from(bytes)]).stream(),
              contentType: 'application/x-ndjson',
              size: bytes.byteLength,
            };
      },
      async put(key, bytes) {
        values.set(key, bytes);
      },
      async head(key) {
        return values.has(key);
      },
      async delete(key) {
        values.delete(key);
      },
      async getUri() {
        return null;
      },
      async listKeys() {
        return [...values.keys()].sort();
      },
      withPrefix() {
        return this;
      },
    },
    text(key) {
      return new TextDecoder().decode(values.get(key));
    },
  };
}

function emitSpan(
  tracer: OtelTracer,
  fixture: SpanFixture,
  configure?: (span: OtelSpan) => void
): OtelSpan {
  const span = tracer.startSpan(fixture.name, {
    ...fixture.options,
    ...(fixture.attributes === undefined
      ? {}
      : { attributes: fixture.attributes }),
    startTime: fixture.startTimeMs,
  });
  configure?.(span);
  span.setStatus({ code: fixture.status === 'error' ? 2 : 1 });
  span.end(fixture.startTimeMs + fixture.durationMs);
  return span;
}

async function exportFixture(options: {
  readonly key: string;
  readonly objectStore: ObjectStore;
  readonly record: (tracer: OtelTracer) => void;
  readonly spanIds: readonly string[];
  readonly traceId: string;
}): Promise<void> {
  let spanIndex = 0;
  const runtime = createNodeTelemetry({
    serviceName: 'debugging-gym',
    serviceVersion: 'gym-build',
    environment: 'test',
    buildSha: 'gym-build',
    exporter: new NdjsonSpanExporter({
      store: options.objectStore,
      key: options.key,
    }),
    idGenerator: {
      generateTraceId: () => options.traceId,
      generateSpanId: () => {
        const spanId = options.spanIds[spanIndex];
        spanIndex += 1;
        if (spanId === undefined)
          throw new Error(`missing deterministic span ID for ${options.key}`);
        return spanId;
      },
    },
    registerGlobal: false,
  });
  options.record(runtime.provider.getTracer('debugging-gym'));
  await runtime.forceFlush();
  await runtime.shutdown();
}

function recordConstraintViolation(tracer: OtelTracer): void {
  emitSpan(tracer, {
    name: 'http.request',
    status: 'error',
    startTimeMs: START_MS,
    durationMs: 34,
    attributes: {
      [ATTR.HTTP_RESPONSE_STATUS_CODE]: 500,
      [ATTR.HTTP_ROUTE]: '/api/mutations',
    },
  });
  emitSpan(
    tracer,
    {
      name: 'db.insert',
      status: 'error',
      startTimeMs: START_MS + 4,
      durationMs: 8,
      attributes: {
        [ATTR.DB_SYSTEM_NAME]: 'postgresql',
        [ATTR.DB_OPERATION_NAME]: 'INSERT',
      },
    },
    (span) => {
      span.recordException(
        {
          code: '23505',
          message: 'duplicate key violates users_username_key',
          name: 'PostgresError',
        },
        START_MS + 5
      );
    }
  );
}

function recordOfflineConflict(tracer: OtelTracer): void {
  emitSpan(
    tracer,
    {
      name: 'mutation.replay',
      status: 'error',
      startTimeMs: START_MS + 300_000,
      durationMs: 46,
      attributes: { [ATTR.APP_MUTATION_ID]: GYM_MUTATION_ID },
      options: {
        links: [
          {
            context: {
              traceId: GYM_IDS.offlineOrigin,
              spanId: '2222222222222222',
              traceFlags: 1,
            },
            attributes: {
              [ATTR.APP_MUTATION_ID]: GYM_MUTATION_ID,
              [ATTR.APP_MUTATION_ORIGIN_TIME_MS]: START_MS,
            },
          },
        ],
      },
    },
    (span) => {
      addEvent(
        span,
        EVENT.MUTATION_CONFLICT,
        { [ATTR.APP_MUTATION_ID]: GYM_MUTATION_ID },
        START_MS + 300_020
      );
    }
  );
}

function recordOfflineOrigin(tracer: OtelTracer): void {
  emitSpan(tracer, {
    name: 'ui.interaction',
    startTimeMs: START_MS,
    durationMs: 40,
    attributes: {
      [ATTR.APP_MUTATION_ID]: GYM_MUTATION_ID,
      [ATTR.APP_INTERACTION_TYPE]: 'click',
      [ATTR.APP_INTERACTION_TARGET]: 'PuzzleMoveButton',
      [ATTR.APP_INTERACTION_OUTCOME]: 'mutation',
    },
  });
}

function recordWrongAnswer(tracer: OtelTracer): void {
  emitSpan(
    tracer,
    {
      name: 'puzzle.answer',
      startTimeMs: START_MS,
      durationMs: 19,
    },
    (span) => {
      addEvent(
        span,
        EVENT.LOG_EMITTED,
        {
          [ATTR.APP_LOG_SEVERITY]: 'warn',
          [ATTR.APP_LOG_NAME]: 'puzzle.answer',
          [ATTR.APP_LOG_MESSAGE]: 'expected move=e2e4 actual move=e2e3',
        },
        START_MS + 10
      );
    }
  );
}

function recordSlowQuery(tracer: OtelTracer): void {
  emitSpan(tracer, {
    name: 'db.query',
    startTimeMs: START_MS,
    durationMs: 2_750,
    attributes: {
      [ATTR.DB_SYSTEM_NAME]: 'postgresql',
      [ATTR.DB_OPERATION_NAME]: 'SELECT',
      [ATTR.DB_QUERY_TEXT]:
        'SELECT id FROM puzzles /*traceparent=00-40000000000000000000000000000004-4000000000000001-01*/',
    },
  });
}

function recordClientError(tracer: OtelTracer): void {
  emitSpan(
    tracer,
    {
      name: 'client.interaction',
      status: 'error',
      startTimeMs: START_MS,
      durationMs: 12,
      attributes: {
        [ATTR.CODE_FILE_PATH]:
          'libs/chess/src/root/client/puzzle-screen.tsx:87',
        [ATTR.CODE_FUNCTION_NAME]: 'submitMove',
      },
    },
    (span) => {
      span.recordException(
        {
          message: 'Cannot read properties of undefined',
          name: 'TypeError',
        },
        START_MS + 2
      );
    }
  );
}

function recordNoOp(tracer: OtelTracer): void {
  emitSpan(tracer, {
    name: 'ui.interaction',
    startTimeMs: START_MS,
    durationMs: 3,
    attributes: {
      [ATTR.APP_INTERACTION_TYPE]: 'click',
      [ATTR.APP_INTERACTION_TARGET]: 'PuzzleSubmitButton',
      [ATTR.APP_INTERACTION_OUTCOME]: 'no_op',
    },
  });
}

function recordFailingTest(tracer: OtelTracer): void {
  emitSpan(
    tracer,
    {
      name: 'test.run',
      status: 'error',
      startTimeMs: START_MS,
      durationMs: 1_120,
      attributes: {
        [ATTR.APP_TEST_ID]: GYM_TEST_ID,
        [ATTR.CODE_FILE_PATH]:
          'libs/spaces/tests/harness/offline-edits.test.tsx:144',
      },
    },
    (span) => {
      span.recordException(
        {
          message: 'expected synced title, received stale title',
          name: 'AssertionError',
        },
        START_MS + 1_100
      );
    }
  );
}

export async function createGymFixtures(): Promise<
  Readonly<Record<string, string>>
> {
  const storage = memoryStore();
  const definitions = [
    [
      'db-constraint.ndjson',
      GYM_IDS.constraint,
      ['1000000000000001', '1000000000000002'],
      recordConstraintViolation,
    ],
    [
      'offline-conflict.ndjson',
      GYM_IDS.conflict,
      ['2000000000000001'],
      recordOfflineConflict,
    ],
    [
      'offline-origin.ndjson',
      GYM_IDS.offlineOrigin,
      ['2222222222222222'],
      recordOfflineOrigin,
    ],
    [
      'wrong-answer.ndjson',
      GYM_IDS.wrongAnswer,
      ['3000000000000001'],
      recordWrongAnswer,
    ],
    [
      'slow-query.ndjson',
      GYM_IDS.slowQuery,
      ['4000000000000001'],
      recordSlowQuery,
    ],
    [
      'client-error.ndjson',
      GYM_IDS.clientError,
      ['5000000000000001'],
      recordClientError,
    ],
    ['no-op.ndjson', GYM_IDS.noOp, ['6000000000000001'], recordNoOp],
    [
      'failing-spec.ndjson',
      GYM_IDS.failingTest,
      ['7000000000000001'],
      recordFailingTest,
    ],
  ] as const;
  for (const [key, traceId, spanIds, record] of definitions) {
    await exportFixture({
      key,
      objectStore: storage.objectStore,
      record,
      spanIds,
      traceId,
    });
  }
  return Object.fromEntries(
    definitions.map(([key]) => [key, storage.text(key)])
  );
}
