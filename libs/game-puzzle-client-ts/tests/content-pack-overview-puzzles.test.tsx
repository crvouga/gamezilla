/** @jsxImportSource @solidjs/web */
/**
 * A pack's puzzles: numbered tiles for an ordered sequence, named rows for
 * puzzles that need their names.
 */

import { afterEach, expect, test } from 'bun:test';
import {
  PackPuzzleGrid,
  PackPuzzleList,
} from '@libs/game-puzzle-client-ts/content-pack-overview';
import type { PackPuzzleProgress } from '@libs/game-puzzle-shared-ts/pack-progress';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function item(
  title: string,
  status: PackPuzzleProgress['status']
): PackPuzzleProgress {
  return {
    puzzleId: `puzzle-${title}`,
    revisionId: `revision-${title}`,
    title,
    status,
    attemptId: null,
  };
}

const DOCKS = [
  item('Dock 01', 'completed'),
  item('Dock 02', 'completed'),
  item('Dock 03', 'in-progress'),
  item('Dock 04', 'unplayed'),
];

function mount(content: () => unknown): void {
  renderWithI18n(() => (
    <ThemeProvider fixedLayout={{ width: 390, height: 844 }}>
      {content() as never}
    </ThemeProvider>
  ));
}

test('a numbered pack is a grid: a check on solved puzzles, the next one current', () => {
  const opened: string[] = [];
  mount(() => (
    <PackPuzzleGrid
      items={DOCKS}
      next={DOCKS[2] ?? null}
      onOpen={(id) => opened.push(id)}
    />
  ));
  const grid = screen.getByTestId('content-pack-puzzles');
  expect(grid.getAttribute('data-component')).toBe('PuzzleGrid');
  const tiles = [...grid.querySelectorAll('button')];
  expect(tiles.map((tile) => tile.textContent)).toEqual(['1', '2', '3', '4']);
  expect(tiles.map((tile) => tile.getAttribute('data-state'))).toEqual([
    'solved',
    'solved',
    'current',
    'open',
  ]);
  expect(tiles.map((tile) => tile.querySelector('svg') !== null)).toEqual([
    true,
    true,
    false,
    false,
  ]);
  expect(tiles[0]?.getAttribute('aria-label')).toBe('Dock 01, Completed');
  expect(tiles[3]?.getAttribute('aria-label')).toBe('Dock 04, Unplayed');
  fireEvent.click(screen.getByTestId('content-pack-puzzle-revision-Dock 04'));
  expect(opened).toEqual(['revision-Dock 04']);
});

test('a finished numbered pack has no current tile', () => {
  const done = DOCKS.map((entry) => ({
    ...entry,
    status: 'completed' as const,
  }));
  mount(() => (
    <PackPuzzleGrid items={done} next={null} onOpen={() => undefined} />
  ));
  expect(document.querySelectorAll('[data-state="current"]')).toHaveLength(0);
  expect(document.querySelectorAll('[data-state="solved"]')).toHaveLength(4);
});

test('named puzzles stay a list of rows that say their name and where each stands', () => {
  const named = [
    item('Count to five', 'completed'),
    item('Count to seven', 'in-progress'),
  ];
  const opened: string[] = [];
  mount(() => (
    <PackPuzzleList items={named} onOpen={(id) => opened.push(id)} />
  ));
  const list = screen.getByTestId('content-pack-puzzles');
  expect(list.textContent).toContain('Count to five');
  expect(list.textContent).toContain('Completed');
  expect(list.textContent).toContain('Count to seven');
  expect(list.textContent).toContain('In progress');
  expect(document.querySelector('[data-component="PuzzleGrid"]')).toBeNull();
  fireEvent.click(
    screen.getByTestId('content-pack-puzzle-revision-Count to seven')
  );
  expect(opened).toEqual(['revision-Count to seven']);
});
