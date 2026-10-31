import { expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import {
  TileBoard,
  type TileBoardDirection,
  type TileBoardPiece,
  tileBoardSwipe,
} from '@pkgs/ui-root-client-ts/tile-board';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import TileBoardExample from '../../ui-root-client-ts/src/tile-board/tile-board.example';

const TILES = [
  { terrain: 'open' as const, marked: false, label: 'A1: floor' },
  { terrain: 'open' as const, marked: true, label: 'B1: goal' },
  { terrain: 'solid' as const, marked: false, label: 'C1: wall' },
];

function mount(disabled = false) {
  const seen: (TileBoardDirection | number)[] = [];
  const [pieces, setPieces] = createSignal<readonly TileBoardPiece[]>([
    { id: 'walker', column: 0, row: 0, glyph: '☻', tone: 'actor' },
  ]);
  const view = render(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <TileBoard
        label="Board"
        testId="board"
        columns={3}
        rows={1}
        tiles={TILES}
        pieces={pieces()}
        disabled={disabled}
        onDirection={(direction) => seen.push(direction)}
        onTile={(index) => seen.push(index)}
      />
    </ThemeProvider>
  ));
  return { view, seen, setPieces };
}

test('arrow keys and W A S D steer only while enabled; other keys pass through', () => {
  const { view, seen } = mount();
  const board = view.getByTestId('board');
  for (const key of ['ArrowRight', 'ArrowUp', 'a', 's', 'Enter', 'x'])
    fireEvent.keyDown(board, { key });
  fireEvent.keyDown(board, { key: 'ArrowLeft', ctrlKey: true });
  expect(seen).toEqual(['right', 'up', 'left', 'down']);
  const disabled = mount(true);
  fireEvent.keyDown(disabled.view.getByTestId('board'), {
    key: 'ArrowRight',
  });
  expect(disabled.seen).toEqual([]);
});

test('a swipe gives its dominant direction and a short press is a tap', () => {
  expect(tileBoardSwipe(30, 4)).toBe('right');
  expect(tileBoardSwipe(-30, 12)).toBe('left');
  expect(tileBoardSwipe(3, 40)).toBe('down');
  expect(tileBoardSwipe(0, -25)).toBe('up');
  expect(tileBoardSwipe(10, -10)).toBeNull();
});

test('a moved piece keeps its element, and tiles name what they hold', () => {
  const { view, setPieces } = mount();
  const before = view.container.querySelector('[data-piece="walker"]');
  setPieces([{ id: 'walker', column: 1, row: 0, glyph: '☻', tone: 'actor' }]);
  const after = view.container.querySelector('[data-piece="walker"]');
  expect(after).toBe(before);
  expect(after?.getAttribute('style')).toContain('translate(100%, 0%)');
  expect(view.getByLabelText('B1: goal').getAttribute('data-marked')).toBe(
    'true'
  );
  expect(view.getByLabelText('C1: wall').getAttribute('data-terrain')).toBe(
    'solid'
  );
});

test('the example passes the accessibility audit', () => {
  const view = render(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <TileBoardExample />
    </ThemeProvider>
  ));
  const failures = auditTree(view.container);
  expect(failures.map(formatFailure)).toEqual([]);
  fireEvent.keyDown(view.getByTestId('example-tile-board'), {
    key: 'ArrowRight',
  });
  expect(
    view.container.querySelector('[data-piece="walker"]')?.getAttribute('style')
  ).toContain('translate(200%, 100%)');
});
