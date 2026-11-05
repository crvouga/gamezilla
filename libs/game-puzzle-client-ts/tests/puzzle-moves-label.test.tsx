/** @jsxImportSource solid-js */
/** The move list's name never shares a shrinking row with its controls. */

import { afterEach, expect, test } from 'bun:test';
import { PuzzleMoveHistory } from '@libs/game-puzzle-client-ts/puzzle-move-history';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const PLIES = [
  { plyIndex: 1, solveIdxAfter: 2, label: 'Nxe5', before: 'w' },
  { plyIndex: 2, solveIdxAfter: 3, label: 'Bxd1', before: 'b' },
];

// regression: puzzle-moves-label-wraps — the "Moves" label sat inline
// beside the step buttons and the move strip in one shrinking row, so it
// broke mid-word ("Mov / es") and left the strip so little room that the
// first move chip was clipped ("ке5" for "Nxe5"). The label now heads the
// strip on a line of its own and never wraps; the strip spans the width.
test('the move list is named on its own row, over moves that wrap rather than clip', () => {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <PuzzleMoveHistory
          plies={PLIES}
          selectedSolveIdx={3}
          interactive
          onSeek={() => undefined}
          nav={{
            canGoBack: true,
            canGoForward: false,
            onNavigate: () => undefined,
          }}
          writing={{
            notation: () => 'san',
            format: (label) => label,
            moveNumber: () => null,
          }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  const label = screen.getByTestId('chess-puzzle-moves-label');
  expect(label.className).toContain('whitespace-nowrap');
  const column = screen.getByTestId('chess-puzzle-moves');
  expect(column.getAttribute('data-component')).toBe('StackVertical');
  // The name heads the column on a row of its own, over the moves.
  expect(label.parentElement?.parentElement).toBe(column);
  expect(column.firstElementChild?.contains(label)).toBe(true);
  const strip = screen.getByTestId('chess-puzzle-move-history');
  expect(strip.contains(label)).toBe(false);
  // The moves have the strip to themselves and wrap rather than scroll, so
  // no chip is ever cut at the strip's edge; the steps head it with its name.
  expect(strip.getAttribute('data-overflow')).toBe('wrap');
  expect(strip.querySelector('[data-component="ScrollView"]')).toBeNull();
  expect(strip.contains(screen.getByTestId('chess-puzzle-move-nav-back'))).toBe(
    false
  );
  expect(
    label.parentElement?.contains(
      screen.getByTestId('chess-puzzle-move-nav-back')
    )
  ).toBe(true);
});

// regression: move-nav-styles-differ — a puzzle's steps were filled discs
// while a game's record showed bare glyphs during play. Both use one rule:
// quiet while the board shows the latest move, plated while reviewing.
test("the puzzle's steps are quiet at the latest move and plated while reviewing", () => {
  const plated = (canGoForward: boolean): boolean => {
    const time = createHarnessClock();
    renderWithI18n(() => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <ThemeProvider
          colorScheme="dark"
          fixedLayout={{ width: 390, height: 844 }}
        >
          <PuzzleMoveHistory
            plies={PLIES}
            selectedSolveIdx={canGoForward ? 2 : 3}
            interactive
            onSeek={() => undefined}
            nav={{ canGoBack: true, canGoForward, onNavigate: () => undefined }}
            writing={{
              notation: () => 'san',
              format: (label) => label,
              moveNumber: () => null,
            }}
          />
        </ThemeProvider>
      </ClockProvider>
    ));
    const shown = !screen
      .getByTestId('chess-puzzle-move-nav-back')
      .innerHTML.includes('background-color: transparent');
    cleanup();
    return shown;
  };
  expect(plated(false)).toBe(false);
  expect(plated(true)).toBe(true);
});
