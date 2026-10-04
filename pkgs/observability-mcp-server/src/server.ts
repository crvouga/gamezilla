import {
  fromJsonSchema,
  type JsonSchemaType,
  McpServer,
} from '@modelcontextprotocol/server';
import type { TraceStore } from '@pkgs/observability-shared/types';

import { createObservabilityMcpTools } from '@pkgs/observability-mcp-shared/observability-mcp';

type TraceIdInput = { readonly traceId: string };
type TestIdInput = { readonly testId: string };
type UserActivityInput = {
  readonly userId: string;
  readonly startMs: number;
  readonly endMs: number;
};

function objectSchema<T>(
  properties: Record<string, JsonSchemaType>,
  required: string[]
) {
  return fromJsonSchema<T>({
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  });
}

const traceIdInput = objectSchema<TraceIdInput>(
  { traceId: { type: 'string', minLength: 1 } },
  ['traceId']
);
const userActivityInput = objectSchema<UserActivityInput>(
  {
    userId: { type: 'string', minLength: 1 },
    startMs: { type: 'number' },
    endMs: { type: 'number' },
  },
  ['userId', 'startMs', 'endMs']
);
const testIdInput = objectSchema<TestIdInput>(
  { testId: { type: 'string', minLength: 1 } },
  ['testId']
);

/** Builds the transport-independent MCP server used by stdio and tests. */
export function createObservabilityMcpServer(store: TraceStore): McpServer {
  const tools = createObservabilityMcpTools(store);
  const server = new McpServer({
    name: 'gamezilla-observability',
    version: '1.0.0',
  });

  server.registerTool(
    'find_user_activity',
    {
      description:
        'Find traces for a durable user id in an explicit UTC range.',
      inputSchema: userActivityInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tools.find_user_activity(input)
  );
  server.registerTool(
    'get_trace',
    {
      description: 'Retrieve a compact narrated trace by trace id.',
      inputSchema: traceIdInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tools.get_trace(input)
  );
  server.registerTool(
    'narrate_trace',
    {
      description: 'Narrate the significant causal timeline for a trace.',
      inputSchema: traceIdInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tools.narrate_trace(input)
  );
  server.registerTool(
    'find_failing_test_trace',
    {
      description: 'Find failing traces correlated to an exact test id.',
      inputSchema: testIdInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tools.find_failing_test_trace(input)
  );
  return server;
}
