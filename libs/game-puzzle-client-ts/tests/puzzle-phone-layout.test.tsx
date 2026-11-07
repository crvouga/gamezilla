/** @jsxImportSource solid-js */
/** Where the puzzle's prompt and its feed sit around the board, by size. */

import { afterEach, expect, test } from 'bun:test';
import {
  PuzzlePlayScreenView,
  type PuzzlePlayScreenViewProps,
} from '@libs/game-puzzle-client-ts/puzzle-play-screen-view';
import { DEFAULT_PUZZLE_FEED_CONFIG } from '@libs/game-puzzle-shared-ts/feed-config';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const none = (): void => undefined;

const VIEW: PuzzlePlayScreenViewProps = {
  pick: 'playing',
  statusKind: 'started',
  solverSide: 'White',
  coach: { message: 'Something on the board is undefended.' },
  elapsedMs: 12_000,
  spectator: false,
  allowanceLabel: '',
  progress: { streak: 3, solved: 24 },
  feedConfig: DEFAULT_PUZZLE_FEED_CONFIG,
  status: 'solving',
  hintStage: 'none',
  canGoForward: false,
  onHint: none,
  onSolution: none,
  onRetry: none,
  onSkip: none,
  onNext: none,
  onIncludeAllPuzzles: none,
  onOpenFeedSettings: none,
  feed: <p data-testid="feed">Auto target 1500 · Unseen · All themes</p>,
  board: () => <p data-testid="board">board</p>,
};

/** Time stands still: the layout is all this file reads. */
const STILL = {
  clock: { now: () => 0 },
  timers: {
    setTimeout: () => 0,
    clearTimeout: none,
    setInterval: () => 0,
    clearInterval: none,
  },
};

function mount(
  width: number,
  overrides: Partial<PuzzlePlayScreenViewProps> = {}
): void {
  renderWithI18n(() => (
    <ClockProvider clock={STILL.clock} timers={STILL.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 844 }}>
        <PuzzlePlayScreenView {...VIEW} {...overrides} />
      </ThemeProvider>
    </ClockProvider>
  ));
}

function region(name: string): Element {
  const found = document.querySelector(`[data-component="${name}"]`);
  if (found === null) throw new Error(`No ${name}`);
  return found;
}

// regression: puzzle-phone-board-pushed-down — on a phone the feed's
// settings line and the coach stacked over the board, which started about
// 300px down the screen.
test('phone: only the prompt sits over the board; the feed follows the actions', () => {
  mount(390);
  const header = region('PuzzleHeader');
  const feed = screen.getByTestId('feed');
  expect(header.contains(feed)).toBe(false);
  expect(region('PuzzleActions').contains(feed)).toBe(true);
  expect(header.textContent).toContain('Something on the board is undefended.');
});

test('wide: the feed heads the panel beside the board, over the prompt', () => {
  mount(1440);
  expect(region('PuzzleHeader').contains(screen.getByTestId('feed'))).toBe(
    true
  );
});

// regression: chess-puzzle-reveal-headline-failed
test('the revealed f3-e5 lesson says Solution shown and keeps retry and next', () => {
  mount(390, {
    statusKind: 'failed',
    status: 'revealed',
    hintStage: 'solution',
    coach: { message: 'Knight takes e5, even with the queen pinned.' },
  });
  expect(screen.getByTestId('chess-puzzle-status-label').textContent).toBe(
    'Solution shown'
  );
  expect(screen.queryByText('Failed')).toBeNull();
  expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy();
  expect(screen.getByRole('button', { name: /Next/ })).toBeTruthy();
  expect(
    screen.getByText('Knight takes e5, even with the queen pinned.')
  ).toBeTruthy();
});

test('a wrong move still reports failure with retry', () => {
  mount(390, { statusKind: 'failed', status: 'wrong' });
  expect(screen.getByTestId('chess-puzzle-status-label').textContent).toBe(
    'Failed'
  );
  expect(screen.getByRole('button', { name: /Retry/ })).toBeTruthy();
});

// regression: chess-puzzle-phone-board-too-small
test('width-driven chess bypasses height fitting without changing the default puzzle layout', () => {
  mount(390, { boardSizing: 'width' });
  expect(region('PuzzleScreen').getAttribute('data-board-sizing')).toBe(
    'width'
  );
  expect(document.querySelector('[data-component="BoardFit"]')).toBeNull();
  expect(screen.getByTestId('board')).toBeTruthy();
  cleanup();
  mount(390);
  expect(region('PuzzleScreen').getAttribute('data-board-sizing')).toBe('fit');
  expect(document.querySelector('[data-component="BoardFit"]')).not.toBeNull();
});
