/** @jsxImportSource solid-js */
/** Which of the puzzle feed's small screens holds which control. */

import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import {
  filledCommands,
  mountPlay,
  region,
  SOLVED,
  shownIds,
} from './puzzle-play-view-fixture';

afterEach(cleanup);

const shown = (testId: string): boolean =>
  screen.queryByTestId(testId) !== null;

/** A line with one move reached, the board before it. */
const FEED_LINE = {
  plies: [{ plyIndex: 0, solveIdxAfter: 1, label: 'g6', before: 'b' }],
  selectedSolveIdx: 0,
  interactive: true,
  awaiting: false,
  writing: {
    notation: () => 'san',
    format: (label: string) => label,
    moveNumber: () => null,
  },
  onSeek: () => undefined,
};

test('the shell names the stage and the place it shows', () => {
  mountPlay('play');
  const shell = screen.getByTestId('chess-puzzle-play-screen');
  expect(shell.getAttribute('data-stage')).toBe('playing');
  expect(shell.getAttribute('data-place')).toBe('play');
});

test('play: the status line, the board, what solving allows, the line and one way to the settings', () => {
  mountPlay('play');
  const header = region('PuzzleHeader');
  expect(header.textContent).toContain('White to move');
  expect(header.textContent).toContain('Something on the board is undefended.');
  expect(header.contains(screen.getByTestId('chess-puzzle-clock'))).toBe(true);
  expect(shown('board')).toBe(true);
  const actions = region('PuzzleActions');
  expect(actions.contains(screen.getByTestId('chess-puzzle-action-hint'))).toBe(
    true
  );
  expect(actions.contains(screen.getByTestId('chess-puzzle-action-skip'))).toBe(
    true
  );
  expect(shown('chess-puzzle-move-ply-1')).toBe(true);
  expect(shown('chess-puzzle-line-open')).toBe(true);
  expect(shown('chess-puzzle-feed-summary')).toBe(true);
  // What other places hold is not here.
  for (const elsewhere of [
    'chess-puzzle-move-nav-back',
    'chess-puzzle-action-next',
    'chess-puzzle-action-retry',
    'chess-puzzle-share-link',
    'chess-puzzle-summary',
    'chess-puzzle-feed-done',
  ])
    expect(shown(elsewhere)).toBe(false);
  expect(filledCommands()).toEqual([]);
});

// regression: puzzle-phone-board-pushed-down — on a phone the feed's
// settings line and the coach stacked over the board, which started about
// 300px down the screen. Only the status line is over the board now, on
// every size: the settings row follows the line under it.
test('the same screen on a phone and a desktop: only the status line is over the board', () => {
  mountPlay('play', {}, 390);
  const phone = shownIds();
  expect(
    region('PuzzleHeader').contains(
      screen.getByTestId('chess-puzzle-feed-summary')
    )
  ).toBe(false);
  cleanup();
  mountPlay('play', {}, 1440);
  expect(shownIds()).toEqual(phone);
  expect(
    region('PuzzleTimeline').contains(
      screen.getByTestId('chess-puzzle-feed-summary')
    )
  ).toBe(true);
});

test('play: the line is read, not pressed, and one control opens it', () => {
  const opened: string[] = [];
  mountPlay('play', { onOpen: (place) => opened.push(place.screen) });
  expect(screen.getByTestId('chess-puzzle-move-ply-0')).toHaveProperty(
    'disabled',
    true
  );
  fireEvent.click(screen.getByTestId('chess-puzzle-line-open'));
  fireEvent.click(screen.getByTestId('chess-puzzle-feed-summary'));
  expect(opened).toEqual(['line', 'feed']);
});

test('play: a wrong move reports failure, and Retry is the one filled command', () => {
  mountPlay('play', { statusKind: 'failed', status: 'wrong' });
  expect(screen.getByTestId('chess-puzzle-status-label').textContent).toBe(
    'Failed'
  );
  expect(shown('chess-puzzle-action-solution')).toBe(true);
  expect(shown('chess-puzzle-action-skip')).toBe(true);
  expect(shown('chess-puzzle-action-next')).toBe(false);
  expect(filledCommands()).toEqual(['Retry']);
});

test('play: a board on an earlier move holds the hint and offers the way back to the latest', () => {
  const asked: string[] = [];
  mountPlay('play', {
    canGoForward: true,
    line: {
      ...FEED_LINE,
      nav: {
        canGoBack: true,
        canGoForward: true,
        onNavigate: (intent) => asked.push(intent),
      },
    },
  });
  expect(screen.getByTestId('chess-puzzle-action-hint')).toHaveProperty(
    'disabled',
    true
  );
  expect(screen.getByTestId('chess-puzzle-action-skip')).toHaveProperty(
    'disabled',
    false
  );
  fireEvent.click(screen.getByTestId('chess-puzzle-return-live'));
  expect(asked).toEqual(['end']);
});

test('play: a wrong move already shows what it did to the rating, on the status line', () => {
  mountPlay('play', {
    statusKind: 'failed',
    status: 'wrong',
    ratingChange: -9,
  });
  const change = screen.getByTestId('chess-puzzle-feed-rating-change');
  expect(change.textContent).toBe('-9');
  expect(region('PuzzleHeader').contains(change)).toBe(true);
});

test('play: a repeat says it is unrated on the status line', () => {
  mountPlay('play', { ratingChange: 'unrated' });
  expect(
    region('PuzzleHeader').contains(
      screen.getByTestId('chess-puzzle-feed-unrated-label')
    )
  ).toBe(true);
});

test('play: a watcher gets the board, the status line, the line and the allowance only', () => {
  mountPlay('play', {
    spectator: true,
    allowanceLabel: '3 rated puzzles remaining today',
  });
  expect(shown('board')).toBe(true);
  expect(screen.getByTestId('chess-puzzle-remaining-today').textContent).toBe(
    '3 rated puzzles remaining today'
  );
  for (const solvers of [
    'chess-puzzle-action-hint',
    'chess-puzzle-action-skip',
    'chess-puzzle-line-open',
    'chess-puzzle-feed-summary',
  ])
    expect(shown(solvers)).toBe(false);
});

test('line, while solving: the step and jump controls, and the way back to the puzzle', () => {
  let back = 0;
  mountPlay('line', { onBack: () => back++ });
  expect(shown('board')).toBe(true);
  for (const control of ['start', 'back', 'forward', 'end'])
    expect(shown(`chess-puzzle-move-nav-${control}`)).toBe(true);
  expect(screen.getByTestId('chess-puzzle-move-ply-0')).toHaveProperty(
    'disabled',
    false
  );
  expect(shown('chess-puzzle-action-hint')).toBe(false);
  expect(shown('chess-puzzle-feed-summary')).toBe(false);
  fireEvent.click(screen.getByTestId('chess-puzzle-line-close'));
  expect(back).toBe(1);
});

// regression: chess-puzzle-reveal-headline-failed
test('line, once the solution is shown: it says Solution shown and keeps retry and next', () => {
  mountPlay('line', {
    stage: 'finished',
    statusKind: 'failed',
    status: 'revealed',
    hintStage: 'solution',
    coach: { message: 'Knight takes e5, even with the queen pinned.' },
  });
  expect(screen.getByTestId('chess-puzzle-status-label').textContent).toBe(
    'Solution shown'
  );
  expect(screen.queryByText('Failed')).toBeNull();
  expect(shown('chess-puzzle-action-retry')).toBe(true);
  expect(shown('chess-puzzle-action-next')).toBe(true);
  expect(shown('chess-puzzle-line-close')).toBe(false);
  expect(
    screen.getByText('Knight takes e5, even with the queen pinned.')
  ).toBeTruthy();
  expect(filledCommands()).toEqual(['Next']);
});

test('result: how it went, the rating it made, and Next puzzle as the one filled command', () => {
  mountPlay('result', SOLVED);
  const result = screen.getByTestId('chess-puzzle-summary');
  expect(result.getAttribute('data-outcome')).toBe('solved');
  expect(result.textContent).toContain('Puzzle solved!');
  expect(screen.getByTestId('chess-puzzle-summary-rating').textContent).toBe(
    '1516'
  );
  expect(screen.getByTestId('chess-puzzle-summary-delta').textContent).toBe(
    '+16'
  );
  expect(screen.getByTestId('chess-puzzle-board-elo').textContent).toContain(
    '1702'
  );
  expect(filledCommands()).toEqual(['Next puzzle']);
  for (const command of [
    'chess-puzzle-summary-next',
    'chess-puzzle-action-retry',
    'chess-puzzle-share-link',
    'chess-puzzle-summary-close',
    'chess-puzzle-feed-summary',
  ])
    expect(shown(command)).toBe(true);
  expect(shown('board')).toBe(false);
  expect(shown('chess-puzzle-action-hint')).toBe(false);
});

test('result: a skip has no rated outcome, and still offers the next puzzle and a retry', () => {
  mountPlay('result', {
    stage: 'finished',
    statusKind: 'skipped',
    status: 'skipped',
  });
  expect(screen.getByTestId('chess-puzzle-summary').textContent).toContain(
    'Puzzle skipped'
  );
  expect(shown('chess-puzzle-summary-delta')).toBe(false);
  expect(shown('chess-puzzle-summary-next')).toBe(true);
  expect(shown('chess-puzzle-action-retry')).toBe(true);
});

test('result: its rows lead to the line and to the settings', () => {
  const opened: string[] = [];
  mountPlay('result', {
    ...SOLVED,
    onOpen: (place) => opened.push(place.screen),
  });
  fireEvent.click(screen.getByTestId('chess-puzzle-summary-close'));
  fireEvent.click(screen.getByTestId('chess-puzzle-feed-summary'));
  expect(opened).toEqual(['line', 'feed']);
});

// regression: chess-puzzle-phone-board-too-small
test('width-driven chess bypasses height fitting without changing the default puzzle layout', () => {
  mountPlay('play');
  expect(region('PuzzleScreen').getAttribute('data-board-sizing')).toBe(
    'width'
  );
  expect(document.querySelector('[data-component="BoardFit"]')).toBeNull();
  expect(shown('board')).toBe(true);
  cleanup();
  mountPlay('play', { boardSizing: 'fit' });
  expect(region('PuzzleScreen').getAttribute('data-board-sizing')).toBe('fit');
  expect(document.querySelector('[data-component="BoardFit"]')).not.toBeNull();
});
