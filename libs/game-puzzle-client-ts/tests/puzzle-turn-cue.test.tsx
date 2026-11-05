/** @jsxImportSource solid-js */
/** The solver's turn and the line played so far, said where the eye lands. */

import { afterEach, expect, test } from 'bun:test';
import { PuzzleMoveHistory } from '@libs/game-puzzle-client-ts/puzzle-move-history';
import { PuzzleStatusHeader } from '@libs/game-puzzle-client-ts/puzzle-status-header';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

afterEach(cleanup);

function mount(ui: () => JSX.Element): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width: 390, height: 844 }}>
      {ui()}
    </ThemeProvider>
  ));
}

// regression: puzzle-board-no-your-move-cue — the solver's turn was a plain
// line of text, with none of the accent the game screens give the seat to
// move, so nothing near the board said it was their move.
test("the solver's turn is the accent pill the game screens use, in the board's words", () => {
  mount(() => <PuzzleStatusHeader kind="started" solverSide="White" />);
  const pill = screen.getByTestId('chess-puzzle-your-move');
  expect(pill.getAttribute('data-component')).toBe('Badge');
  expect(pill.getAttribute('data-intent')).toBe('brand');
  expect(pill.getAttribute('data-tone')).toBe('solid');
  expect(screen.getByTestId('chess-puzzle-status-label').textContent).toBe(
    'White to move'
  );
});

// regression: puzzle-correct-move-neutral-pill — after a right move the
// coach said "Yes!" but the pill kept the neutral accent "White to move",
// so a success read like any other turn. The pill now takes the success
// colour and says so.
test('after a right move the turn pill says so in the success colour', () => {
  mount(() => <PuzzleStatusHeader kind="started" solverSide="White" correct />);
  const pill = screen.getByTestId('chess-puzzle-your-move');
  expect(pill.getAttribute('data-intent')).toBe('success');
  expect(pill.getAttribute('data-correct')).toBe('true');
  expect(screen.getByTestId('chess-puzzle-status-label').textContent).toBe(
    'Correct · White to move'
  );
});

test('any other status keeps its plain words', () => {
  mount(() => <PuzzleStatusHeader kind="solved" solverSide="White" />);
  expect(screen.queryByTestId('chess-puzzle-your-move')).toBeNull();
  expect(screen.getByTestId('chess-puzzle-status-label').textContent).toBe(
    'Solved'
  );
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
