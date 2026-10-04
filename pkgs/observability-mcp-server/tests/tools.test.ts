import { expect, test } from 'bun:test';
import { createObservabilityMcpServer } from '@pkgs/observability-mcp-server/server';
import { createObservabilityMcpTools } from '@pkgs/observability-mcp-shared/observability-mcp';
import type { TraceStore } from '@pkgs/observability-shared/types';

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
});
