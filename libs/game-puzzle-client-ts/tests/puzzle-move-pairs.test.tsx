/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { HistoryPlyPairs } from '@libs/game-puzzle-client-ts/puzzle-move-history-ply';
import type { PuzzleHistoryPly } from '@libs/game-puzzle-shared-ts/move-history';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, render, screen } from '@solidjs/testing-library';

afterEach(cleanup);

// A line opening on Black's reply, then two White moves each answered.
const PLIES: readonly PuzzleHistoryPly[] = [
  { plyIndex: 0, solveIdxAfter: 1, label: 'g6', before: '4b' },
  { plyIndex: 1, solveIdxAfter: 2, label: 'Nxe5', before: '5w' },
  { plyIndex: 2, solveIdxAfter: 3, label: 'Bxd1', before: '5b' },
  { plyIndex: 3, solveIdxAfter: 4, label: 'Bxf7+', before: '6w' },
  { plyIndex: 4, solveIdxAfter: 5, label: 'Ke7', before: '6b' },
];

function mount(numbered: boolean): string[][] {
  render(() => (
    <ThemeProvider colorScheme="light">
      <div data-testid="strip">
        <HistoryPlyPairs
          plies={PLIES}
          selectedSolveIdx={5}
          interactive={false}
          writing={{
            notation: () => 'san',
            format: (label) => label,
            moveNumber: (before, plyIndex) => {
              if (!numbered) return null;
              if (before.endsWith('w')) return `${before.slice(0, -1)}.`;
              return plyIndex === 0 ? `${before.slice(0, -1)}…` : null;
            },
          }}
          onSeek={() => undefined}
        />
      </div>
    </ThemeProvider>
  ));
  const groups = [...screen.getByTestId('strip').children];
  return groups
    .map((group) =>
      [
        ...group.querySelectorAll(
          '[data-testid^="chess-puzzle-move-ply-"]:not([data-testid$="-selected"])'
        ),
      ].map((chip) => chip.textContent?.replace(/\s+/g, ' ').trim() ?? '')
    )
    .filter((group) => group.length > 0);
}

test('a numbered line wraps between move pairs, never inside one', () => {
  expect(mount(true)).toEqual([
    ['4… g6'],
    ['5. Nxe5', 'Bxd1'],
    ['6. Bxf7+', 'Ke7'],
  ]);
});

test('a game that numbers no move keeps each move on its own', () => {
  expect(mount(false)).toEqual([
    ['g6'],
    ['Nxe5'],
    ['Bxd1'],
    ['Bxf7+'],
    ['Ke7'],
  ]);
});
