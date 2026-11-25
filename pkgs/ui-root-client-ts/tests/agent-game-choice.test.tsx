/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { CellGridBoard } from '@pkgs/ui-root-client-ts/cell-grid-board';
import { GameChoiceGrid } from '@pkgs/ui-root-client-ts/game-choice-grid';
import { PathGridBoard } from '@pkgs/ui-root-client-ts/path-grid-board';
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

test('the agent previews a placement by cell name, clears it, and chooses a bow', async () => {
  const previews: (string | null)[] = [];
  const chosen: string[] = [];
  render(() => (
    <CellGridBoard
      label="Fleet placement"
      testId="fleet"
      rowLabels={['1']}
      columnLabels={['A']}
      cells={[
        {
          id: 'a1',
          label: 'A1: open water',
          tone: 'open',
          glyph: '',
          enabled: true,
        },
      ]}
      onActivate={(id) => chosen.push(id)}
      onPreview={(id) => previews.push(id)}
    />
  ));
  const result = await createAgent().act({
    steps: [
      {
        ref: 'Fleet placement',
        action: 'previewCell',
        args: ['A1: open water'],
      },
      { ref: 'Fleet placement', action: 'clearPreview' },
      { ref: 'A1: open water', action: 'press' },
    ],
  });
  expect(result.error?.message).toBeUndefined();
  expect(previews).toEqual(['a1', null]);
  expect(chosen).toEqual(['a1']);
});

test('the agent draws a path through intermediate named cells, cancels and clears paths', async () => {
  const events: string[] = [];
  const [disabled, setDisabled] = createSignal(false);
  render(() => (
    <PathGridBoard
      label="Numberlink board"
      testId="paths"
      columns={2}
      rows={2}
      endpoints={[]}
      lines={[]}
      disabled={disabled()}
      cellLabel={(index) => `Cell ${index}`}
      onTraceStart={(index) => events.push(`start ${index}`)}
      onTraceMove={(index) => events.push(`move ${index}`)}
      onTraceEnd={() => events.push('finish')}
      onTraceCancel={() => events.push('cancel')}
      onCellKey={(key, index) => {
        events.push(`${key} ${index}`);
        return true;
      }}
    />
  ));
  const agent = createAgent();
  const act = (action: string, ...args: string[]) =>
    agent.act({ steps: [{ ref: 'Numberlink board', action, args }] });
  expect((await act('beginPath', 'Cell 0')).error?.message).toBeUndefined();
  expect((await act('extendPath', 'Cell 1')).error?.message).toBeUndefined();
  expect((await act('extendPath', 'Cell 3')).error?.message).toBeUndefined();
  expect((await act('finishPath')).error?.message).toBeUndefined();
  expect((await act('beginPath', 'Cell 0')).error?.message).toBeUndefined();
  expect((await act('cancelPath')).error?.message).toBeUndefined();
  expect((await act('clearPathAt', 'Cell 3')).error?.message).toBeUndefined();
  setDisabled(true);
  expect((await act('beginPath', 'Cell 1')).error).toBeDefined();
  expect(events).toEqual([
    'start 0',
    'move 1',
    'move 3',
    'finish',
    'start 0',
    'cancel',
    'Delete 3',
  ]);
});
