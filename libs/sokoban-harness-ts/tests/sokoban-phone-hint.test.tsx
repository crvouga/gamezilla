/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { SokobanPlayer } from '@libs/sokoban-client-ts/sokoban-player';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

const CORRIDOR = JSON.stringify({ format: 1, rows: ['#@$ .'] });

// regression: sokoban-phone-hint-three-lines — on a phone the hint beside
// the pad read "Swipe the board, tap a square beside the worker, or use
// the pad.", three lines in the narrow column beside the pad, which made
// the puzzle screen taller. It now says the same in one short sentence.
test("on a phone the board's hint is one short sentence", () => {
  const start = sokobanPuzzleContent.rules.initial(CORRIDOR);
  if (!start.accepted) throw new Error('corridor refused');
  const time = createHarnessClock();
  const view = renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <SokobanPlayer
          definition={CORRIDOR}
          state={start.state}
          disabled={false}
          onAction={() => undefined}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  try {
    const board = view.getByTestId('sokoban-board');
    const help = document.getElementById(
      board.getAttribute('aria-describedby') ?? ''
    );
    expect(help?.textContent).toBe(
      'Swipe, tap beside the worker, or use the pad.'
    );
  } finally {
    view.unmount();
  }
});
