import { expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  CellGridBoard,
  type CellGridCell,
  cellGridStep,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import CellGridBoardExample from '../../ui-root-client-ts/src/cell-grid-board/cell-grid-board.example';

function example() {
  const { clock, timers } = createHarnessClock();
  return render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <CellGridBoardExample />
      </ThemeProvider>
    </ClockProvider>
  ));
}
const at = (testId: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

test('barriers and previews update without remounting the focused pawn cell', () => {
  const [cells, setCells] = createSignal<readonly CellGridCell[]>([
    {
      id: 'a1',
      glyph: '●',
      label: 'A1: circle, wall above',
      tone: 'occupied',
      enabled: true,
      identity: 'one',
      edges: ['top'],
    },
    {
      id: 'b1',
      glyph: '◆',
      label: 'B1: diamond',
      tone: 'occupied',
      enabled: false,
      identity: 'two',
    },
    {
      id: 'a2',
      glyph: '▲',
      label: 'A2: triangle',
      tone: 'occupied',
      enabled: false,
      identity: 'three',
    },
    {
      id: 'b2',
      glyph: '■',
      label: 'B2: square',
      tone: 'occupied',
      enabled: false,
      identity: 'four',
    },
  ]);
  const view = render(() => (
    <CellGridBoard
      label="Barrier grid"
      testId="barriers"
      columnLabels={['A', 'B']}
      rowLabels={['1', '2']}
      cells={cells()}
    />
  ));
  const first = view.getByRole('button', { name: 'A1: circle, wall above' });
  first.focus();
  setCells((current) =>
    current.map((cell) =>
      cell.id === 'a1'
        ? { ...cell, previewEdges: ['right'], enabled: false }
        : cell
    )
  );
  expect(document.activeElement).toBe(first);
  expect(first.getAttribute('aria-disabled')).toBe('true');
  expect(first.getAttribute('data-edge-top')).toBe('true');
  expect(first.getAttribute('data-preview-edge-right')).toBe('true');
  expect(first.getAttribute('data-edge-right')).toBe('false');
  expect(
    [
      ...view
        .getByRole('group', { name: 'Barrier grid' })
        .querySelectorAll('[data-identity]'),
    ].map((cell) => cell.getAttribute('data-identity'))
  ).toEqual(['one', 'two', 'three', 'four']);
  view.unmount();
});

test('navigation keys move within the grid and stop at its edges', () => {
  const size = { columns: 5, rows: 4 };
  const key = (name: string, corner = false) => ({
    key: name,
    ctrlKey: corner,
    metaKey: false,
  });
  expect(cellGridStep(key('ArrowLeft'), 0, size)).toBe(0);
  expect(cellGridStep(key('ArrowRight'), 4, size)).toBe(4);
  expect(cellGridStep(key('ArrowDown'), 2, size)).toBe(7);
  expect(cellGridStep(key('ArrowUp'), 2, size)).toBe(2);
  expect(cellGridStep(key('End'), 6, size)).toBe(9);
  expect(cellGridStep(key('Home'), 9, size)).toBe(5);
  expect(cellGridStep(key('End', true), 6, size)).toBe(19);
  expect(cellGridStep(key('Home', true), 19, size)).toBe(0);
  expect(cellGridStep(key('Enter'), 3, size)).toBeNull();
});

test('each cell is a named button with a hidden glyph; only enabled cells activate', () => {
  const activated: string[] = [];
  const [cells, setCells] = createSignal<readonly CellGridCell[]>([
    {
      id: 'a1',
      glyph: '•',
      label: 'A1: passed',
      tone: 'quiet',
      enabled: false,
    },
    { id: 'b1', glyph: '', label: 'B1: empty', tone: 'open', enabled: true },
  ]);
  const view = render(() => (
    <CellGridBoard
      label="Small grid"
      testId="small"
      columnLabels={['A', 'B']}
      rowLabels={['1']}
      cells={cells()}
      onActivate={(id) => activated.push(id)}
    />
  ));
  const grid = view.getByRole('group', { name: 'Small grid' });
  const first = view.getByRole('button', { name: 'A1: passed' });
  expect(first.getAttribute('data-testid')).toBe('small-cell-a1');
  expect(first.getAttribute('aria-disabled')).toBe('true');
  expect(first.querySelector('[aria-hidden="true"]')?.textContent).toBe('•');
  fireEvent.click(first);
  fireEvent.click(view.getByRole('button', { name: 'B1: empty' }));
  expect(activated).toEqual(['b1']);
  const second = at('small-cell-b1');
  setCells([
    {
      id: 'a1',
      glyph: '•',
      label: 'A1: passed',
      tone: 'quiet',
      enabled: false,
    },
    {
      id: 'b1',
      glyph: '✕',
      label: 'B1: flagged',
      tone: 'alert',
      enabled: false,
    },
  ]);
  // The same node updates in place, so focus is never lost to a remount.
  expect(at('small-cell-b1')).toBe(second);
  expect(second?.getAttribute('data-tone')).toBe('alert');
  expect(
    auditTree(grid)
      .map(formatFailure)
      .filter((failure) => failure.startsWith('2ee8b8'))
  ).toEqual([]);
  view.unmount();
});

test('one roving tab stop follows focus; previews report the focused cell; other keys reach the caller', () => {
  const previews: (string | null)[] = [];
  const keys: string[] = [];
  const cells: readonly CellGridCell[] = ['a1', 'b1', 'a2', 'b2'].map((id) => ({
    id,
    glyph: '',
    label: id,
    tone: 'open',
    enabled: true,
  }));
  const view = render(() => (
    <CellGridBoard
      label="Grid"
      testId="grid"
      columnLabels={['A', 'B']}
      rowLabels={['1', '2']}
      cells={cells}
      onPreview={(id) => previews.push(id)}
      onCellKey={(key, id) => {
        keys.push(`${key}@${id}`);
        return key === 'x';
      }}
    />
  ));
  const a1 = view.getByRole('button', { name: 'a1' });
  const b2 = view.getByRole('button', { name: 'b2' });
  expect(a1.tabIndex).toBe(0);
  expect(b2.tabIndex).toBe(-1);
  a1.focus();
  fireEvent.keyDown(a1, { key: 'End', ctrlKey: true });
  expect(document.activeElement).toBe(b2);
  expect(b2.tabIndex).toBe(0);
  expect(a1.tabIndex).toBe(-1);
  expect(previews.at(-1)).toBe('b2');
  fireEvent.keyDown(b2, { key: 'x' });
  expect(keys).toEqual(['x@b2']);
  view.unmount();
});

test('paired panels keep both panels mounted and switch which one shows', () => {
  const view = example();
  const pair = at('example-grids');
  expect(pair?.getAttribute('data-selected')).toBe('left');
  const second = at('example-second');
  expect(second).not.toBeNull();
  expect(second?.closest('[data-panel]')?.getAttribute('data-shown')).toBe(
    'false'
  );
  fireEvent.click(view.getByRole('radio', { name: 'Second grid' }));
  expect(pair?.getAttribute('data-selected')).toBe('right');
  expect(at('example-second')).toBe(second);
  expect(second?.closest('[data-panel]')?.getAttribute('data-shown')).toBe(
    'true'
  );
  const cell = at('example-first-cell-a1');
  expect(cell?.getAttribute('aria-label')).toBe('A1: empty');
  if (cell !== null) fireEvent.click(cell);
  expect(cell?.getAttribute('aria-label')).toBe('A1: taken');
  expect(cell?.getAttribute('data-tone')).toBe('occupied');
  view.unmount();
});
