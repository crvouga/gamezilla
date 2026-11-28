/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { Collapsible } from '@pkgs/ui-root-client-ts/collapsible';
import { FloatingMenu } from '@pkgs/ui-root-client-ts/floating-menu';
import { FloatingPanelHeader } from '@pkgs/ui-root-client-ts/floating-panel';
import { FocusTrap } from '@pkgs/ui-root-client-ts/focus-trap';
import { SettingsIcon } from '@pkgs/ui-root-client-ts/icons';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { Tabs } from '@pkgs/ui-root-client-ts/tabs';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent, render } from '@solidjs/testing-library';
import { createAgent } from '@ui-sdk/solid/agent';
import { createSignal, Show } from 'solid-js';

test('an agent opens a disclosure and selects a named tab inside it', async () => {
  const view = render(() => (
    <ThemeProvider fixedLayout={{ width: 800, height: 600 }}>
      <Collapsible title="Match history">
        <Tabs
          aria-label="Match result"
          items={[
            { value: 'wins', label: 'Wins' },
            { value: 'draws', label: 'Draws' },
          ]}
        >
          {(value) => (value === 'wins' ? 'Won games' : 'Drawn games')}
        </Tabs>
      </Collapsible>
    </ThemeProvider>
  ));
  const agent = createAgent();
  const result = await agent.act({
    steps: [
      { ref: 'Match history', action: 'setOpen', args: [true] },
      { ref: 'Match result', action: 'setValue', args: ['Draws'] },
    ],
  });
  expect(result.error?.message).toBeUndefined();
  expect(
    view.getByRole('tab', { name: 'Draws' }).getAttribute('aria-selected')
  ).toBe('true');
  expect(view.getByRole('tabpanel').textContent).toBe('Drawn games');
});

test('an agent can dismiss the active dialog', async () => {
  const [open, setOpen] = createSignal(true);
  const view = render(() => (
    <Show when={open()}>
      <FocusTrap active label="Room options" onEscape={() => setOpen(false)}>
        Room settings
      </FocusTrap>
    </Show>
  ));
  const result = await createAgent().act({
    steps: [{ ref: 'Room options', action: 'setOpen', args: [false] }],
  });
  expect(view.queryByRole('dialog')).toBeNull();
  expect(result.error?.message).toBeUndefined();
});

test('an agent can run a named command in the open account menu', async () => {
  let settings = 0;
  const [open, setOpen] = createSignal(true);
  const view = render(() => (
    <ThemeProvider fixedLayout={{ width: 800, height: 600 }}>
      <SurfaceStackProvider>
        <FloatingMenu
          open={open()}
          label="Account"
          anchor={{ x: 20, y: 20, width: 10, height: 10 }}
          onClose={() => setOpen(false)}
          content={{
            rows: [
              {
                type: 'item',
                id: 'settings',
                label: 'Change preferences',
                icon: SettingsIcon,
                onClick: () => {
                  settings += 1;
                },
              },
            ],
          }}
        />
      </SurfaceStackProvider>
    </ThemeProvider>
  ));
  expect(
    document.querySelector('[role=menu]')?.getAttribute('popover')
  ).toBeNull();
  const result = await createAgent().act({
    steps: [{ ref: 'Account', action: 'press', args: ['Change preferences'] }],
  });
  expect(result.error?.message).toBeUndefined();
  expect(settings).toBe(1);
  expect(view.queryByRole('menu')).toBeNull();
});

test('the floating panel moves from its handle by keyboard and by agent', async () => {
  const moves: string[] = [];
  const view = render(() => (
    <FloatingPanelHeader
      title="Preview"
      handleLabel="Move preview"
      drag={{
        down() {},
        move() {},
        up() {},
        nudge: (direction) => moves.push(direction),
      }}
    />
  ));
  const result = await createAgent().act({
    steps: [{ ref: 'Move preview', action: 'nudge', args: ['down'] }],
  });
  expect(result.error?.message).toBeUndefined();
  fireEvent.keyDown(view.getByRole('button', { name: 'Move preview' }), {
    key: 'ArrowLeft',
  });
  expect(moves).toEqual(['down', 'left']);
});
