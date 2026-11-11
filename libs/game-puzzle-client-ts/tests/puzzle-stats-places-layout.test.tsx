/** @jsxImportSource solid-js */
/** Which of the puzzle stats' small screens holds which figure. */

import { afterEach, expect, test } from 'bun:test';
import type { PuzzleStatsPlace } from '@libs/game-puzzle-client-ts/puzzle-stats-places';
import {
  PuzzleStatsScreenView,
  type PuzzleStatsScreenViewProps,
} from '@libs/game-puzzle-client-ts/puzzle-stats-screen-view';
import type { PuzzleGameLogEntry } from '@libs/game-puzzle-shared-ts/stats';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const none = (): void => undefined;

const LOG: readonly PuzzleGameLogEntry[] = [
  {
    puzzleId: 'chess:b',
    puzzleRating: 1474,
    outcome: 'failed',
    ratingBefore: 1512,
    ratingAfter: 1500,
    delta: -12,
    rated: true,
    at: '2023-11-14T21:00:00.000Z',
  },
  {
    puzzleId: 'chess:a',
    puzzleRating: 1437,
    outcome: 'solved',
    ratingBefore: 1500,
    ratingAfter: 1512,
    delta: 12,
    rated: true,
    at: '2023-11-14T20:00:00.000Z',
  },
];

const VIEW: PuzzleStatsScreenViewProps = {
  stage: 'ready',
  place: { screen: 'summary' },
  onOpen: none,
  stats: {
    currentRating: 1500,
    ratingDeviation: 120,
    provisional: true,
    totalPlayed: 2,
    totalSolved: 1,
    accuracy: 50,
    currentStreak: 0,
    bestStreak: 1,
    ratingSeries: [1500, 1512, 1500],
  },
  gameLog: LOG,
  onSelectEntry: none,
};

/** Time stands still: the layout is all this file reads. */
const STILL = {
  clock: { now: () => Date.parse('2023-11-14T22:00:00.000Z') },
  timers: {
    setTimeout: () => 0,
    clearTimeout: none,
    setInterval: () => 0,
    clearInterval: none,
  },
};

function mount(
  place: PuzzleStatsPlace,
  overrides: Partial<PuzzleStatsScreenViewProps> = {}
): void {
  renderWithI18n(() => (
    <ClockProvider clock={STILL.clock} timers={STILL.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <PuzzleStatsScreenView {...VIEW} {...overrides} place={place} />
      </ThemeProvider>
    </ClockProvider>
  ));
}

const shown = (testId: string): boolean =>
  screen.queryByTestId(testId) !== null;

// specs/games/puzzle-stats-summary.feature: the puzzle rating, the puzzles
// played and solved, and the accuracy together, at one glance.
test('summary: the rating, played, solved and accuracy together, and the rows onward', () => {
  const opened: string[] = [];
  mount(
    { screen: 'summary' },
    { onOpen: (place) => opened.push(place.screen) }
  );
  expect(screen.getByTestId('chess-stats-elo').textContent).toBe('1500?');
  expect(screen.getByTestId('chess-stats-played').textContent).toBe('2');
  expect(screen.getByTestId('chess-stats-solved').textContent).toBe('1');
  expect(screen.getByTestId('chess-stats-accuracy').textContent).toBe('50%');
  // Each row says where it leads and what is there now.
  expect(screen.getByTestId('chess-stats-rated-count').textContent).toBe(
    '2 rated'
  );
  const latest = screen.getByTestId('chess-stats-latest');
  expect(latest.textContent).toBe('Failed 1474');
  expect(latest.getAttribute('data-puzzle')).toBe('chess:b');
  // The trend and the log are screens of their own.
  expect(shown('chess-stats-rating-history-0')).toBe(false);
  expect(shown('chess-game-log-row-chess:a')).toBe(false);
  fireEvent.click(screen.getByTestId('chess-stats-open-trend'));
  fireEvent.click(screen.getByTestId('chess-stats-open-log'));
  expect(opened).toEqual(['trend', 'log']);
});

test('summary, with nothing played: the log row says so', () => {
  mount({ screen: 'summary' }, { gameLog: [] });
  expect(screen.getByTestId('chess-stats-log-empty').textContent).toBe(
    'Nothing played yet'
  );
  expect(shown('chess-stats-latest')).toBe(false);
});

test('summary, while the history is unknown: one activity indicator and no figure', () => {
  mount({ screen: 'summary' }, { stage: 'loading', gameLog: [] });
  expect(shown('chess-stats-elo')).toBe(false);
  expect(shown('chess-stats-open-log')).toBe(false);
  expect(document.querySelector('[data-component="LoadingState"]')).not.toBe(
    null
  );
});

test('trend: the rating after each rated puzzle, oldest first', () => {
  mount({ screen: 'trend' });
  expect(screen.getByTestId('chess-stats-rating-history-0').textContent).toBe(
    '1512'
  );
  expect(screen.getByTestId('chess-stats-rating-history-1').textContent).toBe(
    '1500'
  );
  expect(shown('chess-stats-elo')).toBe(false);
  expect(shown('chess-game-log-row-chess:a')).toBe(false);
});

test('trend, with nothing rated: says so instead of an empty chart', () => {
  mount({ screen: 'trend' }, { gameLog: [] });
  expect(shown('chess-stats-trend-empty')).toBe(true);
  expect(shown('chess-stats-sparkline')).toBe(false);
});

test('log: every puzzle played, and a row asks for its review', () => {
  const picked: string[] = [];
  mount(
    { screen: 'log' },
    { onSelectEntry: (entry) => picked.push(entry.puzzleId) }
  );
  expect(
    screen.getByTestId('chess-game-log-row-chess:a-title').textContent
  ).toBe('Solved 1437');
  expect(
    screen.getByTestId('chess-game-log-row-chess:b-change').textContent
  ).toBe('-12');
  expect(shown('chess-stats-elo')).toBe(false);
  fireEvent.click(screen.getByTestId('chess-game-log-row-chess:b'));
  expect(picked).toEqual(['chess:b']);
});

test('log, with nothing played: says so, and what fills it', () => {
  mount({ screen: 'log' }, { gameLog: [] });
  expect(shown('chess-game-log-empty')).toBe(true);
});
