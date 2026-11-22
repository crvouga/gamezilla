/** @jsxImportSource solid-js */
/** The solver's turn and the line played so far, said where the eye lands. */

import { afterEach, expect, test } from 'bun:test';
import { PuzzleMoveHistory } from '@libs/game-puzzle-client-ts/puzzle-move-history';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { mountPlay } from './puzzle-play-view-fixture';

afterEach(cleanup);

function mount(ui: () => JSX.Element): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width: 390, height: 844 }}>
      {ui()}
    </ThemeProvider>
  ));
}

/** The status line the space draws over the board. */
function statusLine(): HTMLElement {
  const label = screen.getByTestId('chess-puzzle-status-label');
  expect(
    label.closest('[data-component="SpaceInGameTemplate"]')
  ).not.toBeNull();
  return label;
}

// regression: puzzle-board-no-your-move-cue — the solver's turn was a plain
// line of text, with none of the weight the game screens give the seat to
// move, so nothing near the board said it was their move. It is now the
// in-game status line right over the board, in the board's words.
test("the solver's turn is the status line over the board, in the board's words", () => {
  mountPlay('play');
  expect(statusLine().tagName).toBe('H2');
  expect(statusLine().textContent).toBe('White to move');
});

// regression: puzzle-correct-move-neutral-pill — after a right move the
// coach said "Yes!" but the turn line kept saying only "White to move", so
// a success read like any other turn. It now says so.
test('after a right move the status line says so', () => {
  mountPlay('play', { correct: true });
  expect(statusLine().textContent).toBe('Correct · White to move');
});

test('any other status keeps its plain words', () => {
  mountPlay('play', { statusKind: 'solved', status: 'solved' });
  expect(statusLine().textContent).toBe('Solved');
});

// regression: puzzle-move-chip-unlabelled — "4… g6" sat between arrows with
// nothing saying it was a move of the line.
test('the move list is named', () => {
  mount(() => (
    <PuzzleMoveHistory
      plies={[]}
      selectedSolveIdx={0}
      interactive
      onSeek={() => undefined}
      nav={{
        canGoBack: false,
        canGoForward: false,
        onNavigate: () => undefined,
      }}
      writing={{
        notation: () => 'san',
        format: (label) => label,
        moveNumber: () => null,
      }}
    />
  ));
  expect(screen.getByTestId('chess-puzzle-moves-label').textContent).toBe(
    'Moves'
  );
});
