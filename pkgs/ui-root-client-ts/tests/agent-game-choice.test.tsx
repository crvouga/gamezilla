/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { fireEvent, render } from '@solidjs/testing-library';
import { createAgent } from '@ui-sdk/solid/agent';
import { createSignal } from 'solid-js';

test('round length can be chosen by name and submits as a native radio group', async () => {
  const [pace, setPace] = createSignal('60');
  const changes: string[] = [];
  const view = render(() => (
    <form>
      <GameChoiceGrid
        label="Round length"
        choices={[
          { value: '60', title: 'One minute' },
          { value: '90', title: 'Ninety seconds' },
        ]}
        value={pace()}
        onChange={(value) => {
          setPace(value);
          changes.push(value);
        }}
      />
    </form>
  ));
  const result = await createAgent().act({
    steps: [
      { ref: 'Round length', action: 'setValue', args: ['Ninety seconds'] },
    ],
  });
  expect(result.error?.message).toBeUndefined();
  const input = view.getByRole('radio', { name: 'Ninety seconds' });
  if (!(input instanceof HTMLInputElement) || !input.form)
    throw new Error('Expected a native radio inside the form');
  expect(input.checked).toBe(true);
  expect(
    Array.from(input.form.elements).filter(
      (el) =>
        el instanceof HTMLInputElement && el.name === input.name && el.checked
    )
  ).toEqual([input]);
  fireEvent.click(view.getByRole('radio', { name: 'One minute' }));
  expect(changes).toEqual(['90', '60']);
});
