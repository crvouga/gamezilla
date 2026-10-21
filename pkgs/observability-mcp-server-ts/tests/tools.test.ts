import { expect, test } from 'bun:test';
import { createObservabilityMcpServer } from '@pkgs/observability-mcp-server-ts/server';
import { createObservabilityMcpTools } from '@pkgs/observability-mcp-shared-ts/observability-mcp';
import type { TraceStore } from '@pkgs/observability-root-shared-ts/types';

const trace = {
  traceId: 'trace-1',
  spans: [
    {
      traceId: 'trace-1',
      spanId: 'span-1',
      name: 'request.handle',
      startTimeMs: 1,
      durationMs: 3,
      status: 'error' as const,
      statusMessage: 'constraint failed',
      attributes: {},
    },
  ],
};

function fixtureStore(): TraceStore {
  const ref = {
    traceId: trace.traceId,
    startedAtMs: 1,
    durationMs: 3,
    spanCount: 1,
    errorCount: 1,
    rootName: 'request.handle',
  };
  return {
    source: 'fixture',
    async recent() {
      return [ref];
    },
    async findByUser() {
      return [ref];
    },
    async findBySession() {
      return [ref];
    },
    async findByMutation() {
      return [ref];
    },
    async findByTest() {
      return [ref];
    },
    async findByDevice() {
      return [ref];
    },
    async find() {
      return { kind: 'trace', value: trace.traceId, traces: [ref] };
    },
    async adjacent() {
      return {};
    },
    async getTrace(id) {
      return id === trace.traceId ? trace : null;
    },
    async schema() {
      return { attributeNames: [], eventNames: [], spanNames: [] };
    },
  };
}

test('MCP trace tools return narration and a drill-down breadcrumb', async () => {
  const tools = createObservabilityMcpTools(fixtureStore());
  const found = await tools.get_trace({ traceId: trace.traceId });
  expect(found.content[0].text).toContain('constraint failed');
  expect(found.content[0].text).toContain('next: bun obs span trace-1 span-1');
});

test('MCP empty results teach the next lookup', async () => {
  const tools = createObservabilityMcpTools(fixtureStore());
  const missing = await tools.get_trace({ traceId: 'missing' });
  expect(missing.isError).toBe(true);
  expect(missing.content[0].text).toContain('next:');
});

test('builds the stdio server with all read-only tools registered', () => {
  const server = createObservabilityMcpServer(fixtureStore());
  expect(server.toolInputSchemaJson('find_user_activity')).toBeDefined();
  expect(server.toolInputSchemaJson('get_trace')).toBeDefined();
  expect(server.toolInputSchemaJson('narrate_trace')).toBeDefined();
  expect(server.toolInputSchemaJson('find_failing_test_trace')).toBeDefined();
  expect(server.toolInputSchemaJson('find_session_activity')).toBeDefined();
  expect(server.toolInputSchemaJson('find_device_activity')).toBeDefined();
  expect(server.toolInputSchemaJson('recent_activity')).toBeDefined();
  expect(server.toolInputSchemaJson('person_timeline')).toBeDefined();
});

const WINDOW = { startMs: 0, endMs: 3_600_000 };

test('session and device lookups are bounded by the asked range', async () => {
  const seen: unknown[] = [];
  const store: TraceStore = {
    ...fixtureStore(),
    async findBySession(id, range) {
      seen.push(['session', id, range]);
      return [];
    },
    async findByDevice(id, range) {
      seen.push(['device', id, range]);
      return [];
    },
  };
  const tools = createObservabilityMcpTools(store);
  await tools.find_session_activity({ sessionId: 's-1', ...WINDOW });
  await tools.find_device_activity({ deviceId: 'd-1', ...WINDOW });
  expect(seen).toEqual([
    ['session', 's-1', WINDOW],
    ['device', 'd-1', WINDOW],
  ]);
});

test('a search that stopped early says so in the tool result', async () => {
  const store: TraceStore = {
    ...fixtureStore(),
    async findByUser(_id, _range, options) {
      options?.onTruncated?.({
        search: 'user.id = u',
        kept: 200,
        reason: 'limit',
      });
      return fixtureStore().findByUser('u', WINDOW);
    },
  };
  const found = await createObservabilityMcpTools(store).find_user_activity({
    userId: 'u',
    ...WINDOW,
  });
  expect(found.content[0].text).toContain(
    'WARNING truncated: user.id = u stopped at 200 traces'
  );
});

test('recent activity can be limited to failures', async () => {
  const asked: unknown[] = [];
  const store: TraceStore = {
    ...fixtureStore(),
    async recent(_range, options) {
      asked.push(options?.errorsOnly);
      return [];
    },
  };
  const tools = createObservabilityMcpTools(store);
  await tools.recent_activity({ ...WINDOW });
  await tools.recent_activity({ ...WINDOW, errorsOnly: true });
  expect(asked).toEqual([false, true]);
});

test('a person timeline over MCP gives problems first and a tool call to re-run', async () => {
  const at = 1_800_000;
  const error = {
    traceId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    spanId: 'bbbbbbbbbbbbbbbb',
    name: 'client.error',
    startTimeMs: at,
    durationMs: 3,
    status: 'error' as const,
    statusMessage: 'app crashed',
    attributes: { 'user.id': 'u' },
  };
  const ref = {
    traceId: error.traceId,
    startedAtMs: at,
    durationMs: 3,
    spanCount: 1,
    errorCount: 1,
    rootName: 'client.error',
  };
  const store: TraceStore = {
    ...fixtureStore(),
    async findByUser() {
      return [ref];
    },
    async findBySession() {
      return [];
    },
    async findByDevice() {
      return [];
    },
    async getTrace() {
      return { traceId: error.traceId, spans: [error] };
    },
  };
  const found = await createObservabilityMcpTools(store).person_timeline({
    userId: 'u',
    ...WINDOW,
  });
  const text = found.content[0].text;
  expect(text.indexOf('PROBLEMS')).toBeLessThan(text.indexOf('TIMELINE'));
  expect(text).toContain('[crash] client.error: app crashed');
  expect(text).toContain('next: person_timeline {"userId":"u"');
  expect(text).not.toContain('bun obs person');
});
