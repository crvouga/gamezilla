import {
  fromJsonSchema,
  type JsonSchemaType,
  McpServer,
} from '@modelcontextprotocol/server';
import { createObservabilityMcpTools } from '@pkgs/observability-mcp-shared-ts/observability-mcp';
import type { TraceStore } from '@pkgs/observability-root-shared-ts/types';

type TraceIdInput = { readonly traceId: string };
type TestIdInput = { readonly testId: string };
type Range = { readonly startMs: number; readonly endMs: number };
type UserActivityInput = Range & { readonly userId: string };
type SessionActivityInput = Range & { readonly sessionId: string };
type DeviceActivityInput = Range & { readonly deviceId: string };
type RecentInput = Range & { readonly errorsOnly?: boolean };
type PersonInput = Range & {
  readonly userId: string;
  readonly place?: string;
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
const range = {
  startMs: { type: 'number' },
  endMs: { type: 'number' },
} as const;
const sessionActivityInput = objectSchema<SessionActivityInput>(
  { sessionId: { type: 'string', minLength: 1 }, ...range },
  ['sessionId', 'startMs', 'endMs']
);
const deviceActivityInput = objectSchema<DeviceActivityInput>(
  { deviceId: { type: 'string', minLength: 1 }, ...range },
  ['deviceId', 'startMs', 'endMs']
);
const recentInput = objectSchema<RecentInput>(
  { errorsOnly: { type: 'boolean' }, ...range },
  ['startMs', 'endMs']
);
const personInput = objectSchema<PersonInput>(
  {
    userId: { type: 'string', minLength: 1 },
    place: { type: 'string', minLength: 1 },
    ...range,
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
    name: 'observability',
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
    'find_session_activity',
    {
      description:
        'Find traces for a session id in an explicit UTC range, including spans without a user id.',
      inputSchema: sessionActivityInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tools.find_session_activity(input)
  );
  server.registerTool(
    'find_device_activity',
    {
      description:
        'Find traces for a device id in an explicit UTC range, including anonymous use before sign-in.',
      inputSchema: deviceActivityInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tools.find_device_activity(input)
  );
  server.registerTool(
    'recent_activity',
    {
      description:
        'Newest traces in an explicit UTC range, errors first; set errorsOnly for failures only (bun obs last, bun obs errors).',
      inputSchema: recentInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tools.recent_activity(input)
  );
  server.registerTool(
    'person_timeline',
    {
      description:
        'Everything one account did in a UTC range, problems first and then a timeline, joining the sessions and devices seen on its traces (bun obs person).',
      inputSchema: personInput,
      annotations: { readOnlyHint: true },
    },
    (input) => tools.person_timeline(input)
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
