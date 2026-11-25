/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { FocusTrap } from '@pkgs/ui-root-client-ts/focus-trap';
import { Collapsible } from '@pkgs/ui-root-client-ts/collapsible';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { Tabs } from '@pkgs/ui-root-client-ts/tabs';
import { createSignal, Show } from 'solid-js';
import { render } from '@solidjs/testing-library';
import { createAgent } from '@ui-sdk/solid/agent';

test('an agent opens a disclosure and selects a named tab inside it', async () => {
  const view = render(() => (
    <ThemeProvider colorScheme="light" fixedLayout={{width: 800, height: 600}}>
    <Collapsible title="Match history">
      <Tabs
        aria-label="Match result"
        items={[
          {value: 'wins', label: 'Wins'},
          {value: 'draws', label: 'Draws'},
        ]}
      >
        {(value) => value === 'wins' ? 'Won games' : 'Drawn games'}
      </Tabs>
    </Collapsible>
    </ThemeProvider>
  ));
  const agent = createAgent();
  const result = await agent.act({steps: [
    {ref:'Match history', action:'setOpen', args:[true]},
    {ref:'Match result', action:'setValue',args:['Draws']},
  ]});
  expect(result.error?.message).toBeUndefined();
  expect(view.getByRole('tab', { name: 'Draws' }).getAttribute('aria-selected')).toBe('true');
  expect(view.getByRole('tabpanel').textContent).toBe('Drawn games');
});

test('an agent can dismiss the active dialog', async () => {
  const [open, setOpen] = createSignal(true);
  render(() => <Show when={open()}><FocusTrap active label="Room options" onEscape={() => setOpen(false)}>Room settings</FocusTrap></Show>);
  const result = await createAgent().act({steps:[{ref:'Room options', action:'setOpen',args:[false]}]});
  expect(open()).toBe(false);
  expect(result.error?.message).toBeUndefined();
});
