/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { mountApplication } from '@pkgs/ui-root-client-ts/mount';
import { TextLink } from '@pkgs/ui-root-client-ts/text-link';
import { TileBoard } from '@pkgs/ui-root-client-ts/tile-board';
import { render } from '@solidjs/testing-library';
import { createAgent } from '@ui-sdk/solid/agent';
import { createSignal, flush } from 'solid-js';

type BrowserTool = {
  name: string;
  execute: (input: object) => Promise<unknown>;
};

test('browser agents can discover and follow app links and tools leave with the app', async () => {
  const tools = new Map<string, BrowserTool>();
  const modelContext = {
    registerTool(tool: BrowserTool, options?: { signal?: AbortSignal }) {
      tools.set(tool.name, tool);
      options?.signal?.addEventListener('abort', () => tools.delete(tool.name));
      return Promise.resolve();
    },
    unregisterTool(name: string) {
      tools.delete(name);
    },
  };
  Object.defineProperty(document, 'modelContext', {
    configurable: true,
    value: modelContext,
  });
  const host = document.createElement('div');
  host.id = 'agent-test-app';
  document.body.append(host);
  let visits = 0;
  let deletions = 0;
  const dispose = mountApplication(
    () => (
      <>
        <TextLink
          href="/settings"
          onPress={() => {
            visits++;
          }}
        >
          Account settings
        </TextLink>
        <Button
          title="Delete account"
          agentConfirm="Permanently deletes this account"
          onClick={() => {
            deletions++;
          }}
        />
      </>
    ),
    { rootId: host.id }
  );
  try {
    expect([...tools.keys()].sort()).toEqual(['act', 'query', 'snapshot']);
    const snapshot = await tools.get('snapshot')?.execute({});
    expect(JSON.stringify(snapshot)).toContain('Account settings');
    await tools
      .get('act')
      ?.execute({ steps: [{ ref: 'Account settings', action: 'follow' }] });
    expect(visits).toBe(1);
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/settings');
    const denied = await tools
      .get('act')
      ?.execute({ steps: [{ ref: 'Delete account', action: 'press' }] });
    expect(denied).toHaveProperty('error');
    expect(deletions).toBe(0);
  } finally {
    dispose();
    host.remove();
    Reflect.deleteProperty(document, 'modelContext');
  }
  expect(tools.size).toBe(0);
});

test('agents can read tile labels and use the board’s own tile and direction handlers', async () => {
  const agent = createAgent();
  const actions: (number | string)[] = [];
  const [disabled, setDisabled] = createSignal(false);
  const view = render(() => (
    <TileBoard
      label="Warehouse"
      testId="board"
      columns={1}
      rows={1}
      tiles={[{ terrain: 'open', label: 'Row one, crate', marked: true }]}
      pieces={[]}
      disabled={disabled()}
      onTile={(i) => actions.push(i)}
      onDirection={(direction) => actions.push(direction)}
    />
  ));
  const choices = await agent.query({ within: 'Warehouse' });
  if ('error' in choices) throw new Error(choices.error);
  expect(choices[0]?.items).toContainEqual({
    value: '0',
    label: 'Row one, crate',
  });
  const result = await agent.act({
    steps: [
      { ref: 'Warehouse', action: 'select', args: ['0'] },
      { ref: 'Warehouse', action: 'select', args: ['up'] },
    ],
  });
  expect(result.error).toBeUndefined();
  expect(actions).toEqual([0, 'up']);
  setDisabled(true);
  flush();
  expect(
    (
      await agent.act({
        steps: [{ ref: 'Warehouse', action: 'select', args: ['up'] }],
      })
    ).error
  ).toBeDefined();
  expect(actions).toEqual([0, 'up']);
  view.unmount();
});

// regression: ui-disabled-menu-row-link
test('a disabled menu link refuses navigation until it becomes available', async () => {
  let visits = 0;
  const [disabled, setDisabled] = createSignal(true);
  const view = render(() => (
    <MenuRow
      title="Player history"
      href="/history"
      hideChevron
      disabled={disabled()}
      onClick={() => {
        visits++;
      }}
    />
  ));
  const agent = createAgent();
  const follow = () =>
    agent.act({ steps: [{ ref: 'Player history', action: 'follow' }] });
  expect((await follow()).error).toBeDefined();
  expect(visits).toBe(0);
  setDisabled(false);
  flush();
  expect((await follow()).error).toBeUndefined();
  expect(visits).toBe(1);
  view.unmount();
});
