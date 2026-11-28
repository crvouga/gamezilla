/** @jsxImportSource @solidjs/web */

import { expect, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import { PuzzleGrid } from '@pkgs/ui-root-client-ts/puzzle-grid';
import PuzzleGridExample, {
  sequenceTiles,
} from '@pkgs/ui-root-client-ts/puzzle-grid/puzzle-grid.example';
import { fireEvent, screen } from '@solidjs/testing-library';
import { renderUi } from './render';

test('a named list of numbered tiles in sequence, each one button', () => {
  renderUi(() => <PuzzleGridExample />, { width: 390, height: 844 });
  const grid = screen.getByRole('list', {
    name: 'Puzzles in Warehouse basics',
  });
  expect(grid.getAttribute('data-component')).toBe('PuzzleGrid');
  expect(grid.children).toHaveLength(30);
  const tiles = [...grid.querySelectorAll('button')];
  expect(tiles.map((tile) => tile.textContent).slice(0, 5)).toEqual([
    '1',
    '2',
    '3',
    '4',
    '5',
  ]);
  expect(tiles[0]?.getAttribute('data-component')).toBe('PuzzleGridTile');
  expect(tiles[0]?.getAttribute('aria-label')).toBe('Dock 01, solved');
  expect(auditTree(document.body).map(formatFailure)).toEqual([]);
});

test('solved tiles carry a check and the next puzzle is the one current tile', () => {
  renderUi(() => <PuzzleGrid label="Puzzles" tiles={sequenceTiles(6, 2)} />);
  const states = [...document.querySelectorAll('button')].map((tile) =>
    tile.getAttribute('data-state')
  );
  expect(states).toEqual([
    'solved',
    'solved',
    'current',
    'open',
    'open',
    'open',
  ]);
  const withCheck = [...document.querySelectorAll('button')].map(
    (tile) => tile.querySelector('svg') !== null
  );
  expect(withCheck).toEqual([true, true, false, false, false, false]);
  const current = [...document.querySelectorAll('[aria-current="true"]')];
  expect(current).toHaveLength(1);
  expect(current[0]?.getAttribute('data-testid')).toBe('example-puzzle-3');
});

test('pressing a tile opens that puzzle', () => {
  const opened: number[] = [];
  renderUi(() => (
    <PuzzleGrid
      label="Puzzles"
      tiles={sequenceTiles(4, 1, (number) => opened.push(number))}
    />
  ));
  fireEvent.click(screen.getByTestId('example-puzzle-3'));
  fireEvent.click(screen.getByTestId('example-puzzle-1'));
  expect(opened).toEqual([3, 1]);
});

test('with every puzzle solved no tile is current', () => {
  renderUi(() => <PuzzleGrid label="Puzzles" tiles={sequenceTiles(3, 3)} />);
  expect(document.querySelectorAll('[aria-current="true"]')).toHaveLength(0);
  expect(document.querySelectorAll('[data-state="solved"]')).toHaveLength(3);
});
