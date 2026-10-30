import { expect, test } from '@playwright/test';

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
  const text = await list.text();
  expect(text).toContain('tools');
  expect(text).toContain('name');
  const payload = JSON.parse(
    text
      .split('\n')
      .find((line) => line.startsWith('data: '))
      ?.slice(6) ?? text
  ) as { error?: unknown; result: { tools: { name: string }[] } };
  expect(payload.error).toBeUndefined();
  expect(payload.result.tools.map((tool) => tool.name)).toContain(
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
  expect(await preview.text()).toContain(
    'components-inputs-button--interactive'
  );
});
