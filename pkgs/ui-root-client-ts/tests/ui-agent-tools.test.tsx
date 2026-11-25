/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { registerUiAgentTools } from '@pkgs/ui-root-client-ts/register-ui-agent-tools';
import { TextLink } from '@pkgs/ui-root-client-ts/text-link';
import { render } from '@solidjs/testing-library';

type BrowserTool = {
  name: string;
  execute: (input: object) => Promise<unknown>;
};

test('browser agents can discover and follow app links and tools leave with the app', async () => {
  const tools = new Map<string, BrowserTool>();
  const modelContext = {
    async registerTool(tool: BrowserTool, options?: { signal?: AbortSignal }) {
      tools.set(tool.name, tool);
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name));
    },
    unregisterTool(name: string) {
      tools.delete(name);
    },
  };
  Object.defineProperty(document, 'modelContext', { configurable: true, value: modelContext });
  const unregister = registerUiAgentTools();
  let visits = 0;
  const view = render(() => (
    <TextLink href="/settings" onPress={() => { visits++; }}>Account settings</TextLink>
  ));
  try {
    expect([...tools.keys()].sort()).toEqual(['act', 'query', 'snapshot']);
    const snapshot = await tools.get('snapshot')?.execute({});
    expect(JSON.stringify(snapshot)).toContain('Account settings');
    await tools.get('act')?.execute({ steps: [{ ref: 'Account settings', action: 'follow' }] });
    expect(visits).toBe(1);
    expect(view.getByRole('link').getAttribute('href')).toBe('/settings');
  } finally {
    view.unmount();
    unregister();
    Reflect.deleteProperty(document, 'modelContext');
  }
  expect(tools.size).toBe(0);
});
