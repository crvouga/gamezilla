/** @jsxImportSource solid-js */
/** Revealing the selected move scrolls the move strip, never the page. */

import { afterEach, expect, test } from 'bun:test';
import { PuzzleMoveHistory } from '@libs/game-puzzle-client-ts/puzzle-move-history';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';

afterEach(cleanup);

const PLIES = [
  { plyIndex: 1, solveIdxAfter: 2, label: 'g6', before: 'b' },
  { plyIndex: 2, solveIdxAfter: 3, label: 'Nxe5', before: 'w' },
  { plyIndex: 3, solveIdxAfter: 4, label: 'Bxd1', before: 'b' },
];

// regression: puzzle-move-strip-shifts-page — on a phone the puzzle feed
// after a correct move was shifted sideways (its title read "uzzles" and
// the board was clipped): the selected move was revealed with the
// browser's own scrollIntoView, which also scrolls the page's scroller.
test('the selected move is revealed inside the strip, never by scrolling the page', () => {
  const pageReveals: string[] = [];
  const original = HTMLElement.prototype.scrollIntoView;
  HTMLElement.prototype.scrollIntoView = function scrollIntoView(
    this: HTMLElement
  ): void {
    pageReveals.push(this.textContent ?? '');
  };
  const time = createHarnessClock();
  try {
    renderWithI18n(() => (
      <ClockProvider clock={time.clock} timers={time.timers}>
        <ThemeProvider
          colorScheme="dark"
          fixedLayout={{ width: 390, height: 844 }}
        >
          <PuzzleMoveHistory
            plies={PLIES}
            selectedSolveIdx={4}
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
    expect(pageReveals).toEqual([]);
  } finally {
    HTMLElement.prototype.scrollIntoView = original;
  }
});
