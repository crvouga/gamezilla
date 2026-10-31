import { expect, test } from '@playwright/test';

type RpcResult = {
  protocolVersion?: string;
  tools?: { name: string }[];
  isError?: boolean;
  content?: { type: string; text?: string }[];
};

function rpcResult(text: string): RpcResult {
  const data =
    text
      .split('\n')
      .find((line) => line.startsWith('data: '))
      ?.slice(6) ?? text;
  const payload = JSON.parse(data) as {
    jsonrpc: string;
    error?: unknown;
    result: RpcResult;
  };
  expect(payload.jsonrpc).toBe('2.0');
  expect(payload.error).toBeUndefined();
  expect(payload.result).toBeDefined();
  return payload.result;
}

test('agents can initialize MCP and discover its actual tools', async ({
  request,
}) => {
  const headers: Record<string, string> = {
    accept: 'application/json, text/event-stream',
  };
  const init = await request.post('/mcp', {
    headers,
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'design-system-verification', version: '1' },
      },
    },
  });
  expect(init.ok(), await init.text()).toBe(true);
  expect(rpcResult(await init.text()).protocolVersion).toBe('2025-03-26');
  const session = init.headers()['mcp-session-id'];
  if (session) headers['mcp-session-id'] = session;
  headers['mcp-protocol-version'] = '2025-03-26';
  const ready = await request.post('/mcp', {
    headers,
    data: { jsonrpc: '2.0', method: 'notifications/initialized' },
  });
  expect(ready.ok()).toBe(true);
  const list = await request.post('/mcp', {
    headers,
    data: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  });
  expect(list.ok()).toBe(true);
  const listed = rpcResult(await list.text());
  expect((listed.tools ?? []).map((tool) => tool.name)).toContain(
    'stories-preview'
  );
  const preview = await request.post('/mcp', {
    headers,
    data: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: {
        name: 'stories-preview',
        arguments: {
          stories: [{ storyId: 'components-inputs-button--interactive' }],
        },
      },
    },
  });
  expect(preview.ok()).toBe(true);
  const result = rpcResult(await preview.text());
  expect(result.isError).not.toBe(true);
  expect((result.content ?? []).length).toBeGreaterThan(0);
  expect(
    (result.content ?? [])
      .filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n')
  ).toContain('components-inputs-button--interactive');
});
