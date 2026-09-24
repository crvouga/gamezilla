import { describe, expect, test } from 'bun:test';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { NdjsonTraceStore } from '@pkgs/observability/query';
import {
  discoverLatestLocalTraceSource,
  parseArgs,
  resolveRange,
  runCommand,
} from '@pkgs/observability-cli';

function storeWith(line?: string): NdjsonTraceStore {
  const bytes = line === undefined ? undefined : new TextEncoder().encode(line);
  return new NdjsonTraceStore(
    {
      async get() {
        return bytes === undefined
          ? null
          : {
              body: new Blob([bytes]).stream(),
              contentType: 'application/x-ndjson',
              size: bytes.byteLength,
            };
      },
      async put() {},
      async head() {
        return bytes !== undefined;
      },
      async delete() {},
      async getUri() {
        return null;
      },
      async listKeys() {
        return bytes === undefined ? [] : ['trace.ndjson'];
      },
      withPrefix() {
        return this;
      },
    },
    'fixture'
  );
}

const LINE = JSON.stringify({
  timestamp: '2026-09-22T12:00:00.000Z',
  traceId: '11111111111111111111111111111111',
  spanId: '2222222222222222',
  name: 'request.handle',
  durationMs: 10,
  status: 'error',
  statusMessage: 'boom',
  attributes: { 'app.test.id': 'suite fails' },
  events: [],
});

function lineWith(attributes: Readonly<Record<string, string>>): string {
  return JSON.stringify({
    timestamp: '2026-09-22T12:00:00.000Z',
    traceId: '11111111111111111111111111111111',
    spanId: '2222222222222222',
    name: 'request.handle',
    durationMs: 10,
    status: 'error',
    statusMessage: 'boom',
    attributes,
    events: [],
  });
}

function manifestStore(files: Readonly<Record<string, string>>): ObjectStore {
  return {
    async get(key) {
      const value = files[key];
      if (value === undefined) return null;
      const bytes = new TextEncoder().encode(value);
      return {
        body: new Blob([bytes]).stream(),
        contentType: 'application/json',
        size: bytes.byteLength,
      };
    },
    async put() {},
    async head(key) {
      return files[key] !== undefined;
    },
    async delete() {},
    async getUri() {
      return null;
    },
    async listKeys() {
      return Object.keys(files).sort();
    },
    withPrefix() {
      return this;
    },
  };
}

describe('obs output contract', () => {
  test('last is versioned, error-first, and ends in a drill-down command', async () => {
    const result = await runCommand(
      { store: storeWith(LINE), nowMs: Date.parse('2026-09-22T12:01:00Z') },
      parseArgs(['last', '--window', '10m'])
    );
    expect(result.code).toBe(0);
    expect(result.text).toStartWith('obs/v1\nsource: fixture\nutc-range:');
    expect(result.text).toContain('ERROR(1)');
    expect(result.text).toContain('next: bun obs span');
  });

  test('empty lookup exits 1 with widening breadcrumbs', async () => {
    const result = await runCommand(
      { store: storeWith(), nowMs: 1_790_078_400_000 },
      parseArgs(['find', 'missing'])
    );
    expect(result.code).toBe(1);
    expect(result.text).toContain('No traces matched');
    expect(result.text).toContain('next: bun obs find');
    expect(result.text).toContain('next: bun obs last');
  });

  test('empty lookup reports real nearby activity and its session', async () => {
    const result = await runCommand(
      {
        store: storeWith(
          lineWith({
            'session.id': 'nearby-session',
            'user.id': 'someone-else',
          })
        ),
        nowMs: Date.parse('2026-09-22T12:01:00Z'),
      },
      parseArgs(['find', 'missing'])
    );
    expect(result.code).toBe(1);
    expect(result.text).toContain('nearest-nearby:');
    expect(result.text).toContain('sessions nearby-session');
    expect(result.text).toContain('next: bun obs trace');
  });

  test('tail performs a bounded snapshot and gives a follow breadcrumb', async () => {
    const result = await runCommand(
      { store: storeWith(), nowMs: 1_790_078_400_000 },
      parseArgs(['tail'])
    );
    expect(result.code).toBe(1);
    expect(result.text).toContain('tail-mode: bounded snapshot');
    expect(result.text).toContain('bun obs tail');
  });

  test('resolves email to user.id before querying telemetry', async () => {
    const withUser = lineWith({ 'user.id': 'durable-user' });
    const result = await runCommand(
      {
        store: storeWith(withUser),
        nowMs: Date.parse('2026-09-22T12:01:00Z'),
        identityResolver: {
          async resolve(value) {
            expect(value).toBe('person@example.com');
            return { userId: 'durable-user', matchedAs: 'email' };
          },
        },
      },
      parseArgs(['user', 'person@example.com'])
    );
    expect(result.code).toBe(0);
    expect(result.text).toContain('matched-as: email -> user.id durable-user');
    expect(result.text).not.toContain('person@example.com');
  });

  test('does not query telemetry when an email has no durable identity', async () => {
    const store = storeWith(LINE);
    store.findByUser = () => {
      throw new Error('raw email reached telemetry');
    };
    const result = await runCommand(
      {
        store,
        nowMs: Date.parse('2026-09-22T12:01:00Z'),
        identityResolver: { resolve: () => Promise.resolve(null) },
      },
      parseArgs(['user', 'missing@example.com'])
    );
    expect(result.code).toBe(1);
    expect(result.text).not.toContain('missing@example.com');
  });

  test('tail resolves its user filter before the bounded trace lookup', async () => {
    const result = await runCommand(
      {
        store: storeWith(lineWith({ 'user.id': 'durable-user' })),
        nowMs: Date.parse('2026-09-22T12:01:00Z'),
        identityResolver: {
          async resolve() {
            return { userId: 'durable-user', matchedAs: 'username' };
          },
        },
      },
      parseArgs(['tail', '--user', 'Alice'])
    );
    expect(result.code).toBe(0);
    expect(result.text).toContain('bun obs tail --user durable-user');
  });

  test('errors resolves and filters its user before selecting failures', async () => {
    const result = await runCommand(
      {
        store: storeWith(lineWith({ 'user.id': 'durable-user' })),
        nowMs: Date.parse('2026-09-22T12:01:00Z'),
        identityResolver: {
          async resolve(value) {
            expect(value).toBe('Alice');
            return { userId: 'durable-user', matchedAs: 'username' };
          },
        },
      },
      parseArgs(['errors', '--user', 'Alice'])
    );
    expect(result.code).toBe(0);
    expect(result.text).toContain('11111111111111111111111111111111');
    expect(result.text).not.toContain('Alice');
  });

  test('db slow explains unavailable stats and retains span fallback', async () => {
    const database = lineWith({ 'db.system.name': 'postgresql' });
    const result = await runCommand(
      {
        store: storeWith(database),
        nowMs: Date.parse('2026-09-22T12:01:00Z'),
        pgStats: {
          async slowest() {
            return { available: false, note: 'extension unavailable' };
          },
        },
      },
      parseArgs(['slow', '--layer', 'db'])
    );
    expect(result.code).toBe(0);
    expect(result.text).toContain('pg-stat-statements: extension unavailable');
    expect(result.text).toContain('trace-span fallback');
  });

  test('slow layer ranks the selected spans instead of whole traces', async () => {
    const firstTrace = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const secondTrace = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    const span = (options: {
      readonly attributes?: Readonly<Record<string, string>>;
      readonly durationMs: number;
      readonly name: string;
      readonly spanId: string;
      readonly traceId: string;
    }) =>
      JSON.stringify({
        timestamp: '2026-09-22T12:00:00.000Z',
        traceId: options.traceId,
        spanId: options.spanId,
        name: options.name,
        durationMs: options.durationMs,
        status: 'ok',
        attributes: options.attributes ?? {},
        events: [],
      });
    const records = [
      span({
        traceId: firstTrace,
        spanId: '1000000000000001',
        name: 'request.handle',
        durationMs: 1_000,
      }),
      span({
        traceId: firstTrace,
        spanId: '1000000000000002',
        name: 'db.query',
        durationMs: 10,
        attributes: { 'db.system.name': 'postgresql' },
      }),
      span({
        traceId: secondTrace,
        spanId: '2000000000000001',
        name: 'request.handle',
        durationMs: 100,
      }),
      span({
        traceId: secondTrace,
        spanId: '2000000000000002',
        name: 'db.query',
        durationMs: 50,
        attributes: { 'db.system.name': 'postgresql' },
      }),
    ].join('\n');
    const result = await runCommand(
      { store: storeWith(records), nowMs: Date.parse('2026-09-22T12:01:00Z') },
      parseArgs(['slow', '--layer', 'db', '--p', '95'])
    );
    expect(result.code).toBe(0);
    expect(result.text).toContain(secondTrace);
    expect(result.text).toContain('db.query 50.0ms');
    expect(result.text).not.toContain(firstTrace);
  });
});

test('fuzzy calendar times use injected UTC now and echo UTC explicitly', () => {
  const range = resolveRange(
    Date.parse('2026-09-22T19:15:00Z'),
    '15m',
    'yesterday 14:30'
  );
  expect(range).toEqual({
    startMs: Date.parse('2026-09-21T14:15:00Z'),
    endMs: Date.parse('2026-09-21T14:30:00Z'),
  });
});

test('fuzzy calendar command output includes its resolved UTC range', async () => {
  const record = JSON.stringify({
    timestamp: '2026-09-21T14:25:00.000Z',
    traceId: '11111111111111111111111111111111',
    spanId: '2222222222222222',
    name: 'request.handle',
    durationMs: 10,
    status: 'ok',
    attributes: { 'user.id': 'durable-user' },
    events: [],
  });
  const result = await runCommand(
    {
      store: storeWith(record),
      nowMs: Date.parse('2026-09-22T19:15:00Z'),
    },
    parseArgs([
      'user',
      'durable-user',
      '--at',
      'yesterday 14:30',
      '--window',
      '15m',
    ])
  );
  expect(result.text).toContain(
    'utc-range: 2026-09-21T14:15:00.000Z .. 2026-09-21T14:30:00.000Z (UTC)'
  );
});

test('local discovery selects native artifacts before querying Tempo', async () => {
  const tempoManifest = (
    instanceId: string,
    startedAtMs: number,
    url: string
  ) =>
    JSON.stringify({
      instanceId,
      startedAtMs,
      observabilityTempoUrl: url,
    });
  const found = await discoverLatestLocalTraceSource(
    manifestStore({
      'old.json': tempoManifest('old', 1, 'http://127.0.0.1:3200'),
      'new.json': JSON.stringify({
        instanceId: 'new',
        startedAtMs: 2,
        observabilityTraceDir: '/tmp/native-traces',
      }),
      'partial.json': '{',
    })
  );
  expect(found).toEqual({ kind: 'ndjson', path: '/tmp/native-traces' });
});
