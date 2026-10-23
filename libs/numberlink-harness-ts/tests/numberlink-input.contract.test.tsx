import { expect, test } from 'bun:test';
import { numberlinkPuzzleContent } from '@libs/numberlink-shared-ts/numberlink-puzzle-content';
import { fireEvent } from '@solidjs/testing-library';
import { editorFixture, playerFixture } from './numberlink-client-fixture';

test('pointer samples preview without persisting and commit one rule-checked opaque action', () => {
  const f = playerFixture();
  f.pointer('pointerdown', 0);
  f.pointer('pointermove', 1);
  expect(f.actions).toEqual([]);
  expect(
    f.board.querySelector('[data-path="pair-1"]')?.getAttribute('points')
  ).toBe('50,50 150,50');
  f.pointer('pointerup', 2);
  expect(f.actions.map((action) => JSON.parse(action))).toEqual([
    {
      pairId: 'pair-1',
      cells: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
      ],
    },
  ]);
  expect(
    f.board
      .querySelector('[data-path="pair-1"]')
      ?.getAttribute('data-connected')
  ).toBe('true');
  f.view.unmount();
});

test('keyboard arrows build a provisional path; activation commits and Delete emits removal', () => {
  const f = playerFixture();
  const first = f.view.getByRole('button', {
    name: 'A1: endpoint 1, unfinished',
  });
  first.focus();
  fireEvent.click(first);
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  const middle = f.view.getByRole('button', { name: 'B1: path 1, unfinished' });
  expect(document.activeElement).toBe(middle);
  fireEvent.keyDown(middle, { key: 'ArrowRight' });
  const end = f.view.getByRole('button', { name: 'C1: endpoint 1, connected' });
  expect(f.actions.length).toBe(0);
  fireEvent.click(end);
  expect(f.actions.length).toBe(1);
  expect(document.activeElement).toBe(end);
  fireEvent.keyDown(end, { key: 'Delete' });
  expect(JSON.parse(f.actions[1] ?? 'null')).toEqual({
    pairId: 'pair-1',
    cells: [],
  });
  f.view.unmount();
});

test('cancelled, blocked and disabled pointer traces never overwrite saved progress', () => {
  const f = playerFixture();
  const original = f.state();
  f.pointer('pointerdown', 0);
  f.pointer('pointermove', 1);
  f.pointer('pointercancel', 1);
  f.pointer('pointerup', 2);
  expect(f.state()).toBe(original);
  f.pointer('pointerdown', 3);
  f.pointer('pointerup', 0);
  expect(f.view.getByRole('alert').textContent).toContain('another pair');
  expect(f.state()).toBe(original);
  f.pointer('pointerdown', 0);
  f.pointer('pointermove', 1);
  f.setDisabled(true);
  f.pointer('pointerup', 2);
  expect(f.actions).toEqual([]);
  f.view.unmount();
});

test('incoming state invalidates a provisional action and full coverage comes from the shared rules', () => {
  const f = playerFixture();
  for (const start of [0, 3, 6]) {
    f.pointer('pointerdown', start);
    f.pointer('pointerup', start + 2);
  }
  expect(numberlinkPuzzleContent.rules.complete(f.definition, f.state())).toBe(
    true
  );
  const before = f.actions.length;
  const first = f.view.getByRole('button', {
    name: 'A1: endpoint 1, connected',
  });
  fireEvent.click(first);
  f.setState('{"paths":[]}');
  fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(f.actions.length).toBe(before);
  expect(f.board.querySelector('polyline')).toBeNull();
  f.view.unmount();
});

test('editor callbacks preserve endpoints on a refused resize and use injected pair identities', () => {
  const f = editorFixture();
  const initial = f.definition();
  fireEvent.click(f.view.getByRole('button', { name: 'Decrease Columns' }));
  expect(f.definition()).toBe(initial);
  expect(f.view.getByRole('alert').textContent).toContain('Move endpoints');
  fireEvent.click(f.view.getByRole('button', { name: 'Add pair' }));
  expect(f.board().pairs.at(-1)?.id).toBe('new-pair-1');
  expect(f.board().pairs.at(-1)?.endpoints).toEqual([
    { x: 1, y: 0 },
    { x: 1, y: 1 },
  ]);
  fireEvent.input(f.view.getByRole('textbox', { name: 'Pair label' }), {
    target: { value: 'Sun' },
  });
  expect(f.board().pairs.at(-1)?.label).toBe('Sun');
  f.view.unmount();
});

test('an occupied endpoint placement leaves the draft and the chosen endpoint unchanged', () => {
  // regression: numberlink-refused-endpoint-changes-target
  const f = editorFixture();
  const initial = f.definition();
  fireEvent.click(
    f.view.getByRole('button', { name: 'A2: endpoint 2, unfinished' })
  );
  expect(f.definition()).toBe(initial);
  expect(
    f.view
      .getByRole('button', { name: 'Move first endpoint' })
      .getAttribute('aria-pressed')
  ).toBe('true');
  fireEvent.click(f.view.getByRole('button', { name: 'B1: empty' }));
  expect(f.board().pairs[0]?.endpoints[0]).toEqual({ x: 1, y: 0 });
  f.view.unmount();
});

test('endpoint removal keeps the confirmed identity when incoming content changes the selection', () => {
  // regression: numberlink-removal-follows-changed-selection
  const f = editorFixture();
  fireEvent.click(f.view.getByRole('button', { name: 'Remove pair' }));
  f.setDefinition(
    JSON.stringify({ ...f.board(), pairs: f.board().pairs.slice(1) })
  );
  fireEvent.click(f.view.getByRole('button', { name: 'Remove endpoints' }));
  expect(f.board().pairs.map((pair) => pair.id)).toEqual(['pair-2', 'pair-3']);
  f.view.unmount();
});
