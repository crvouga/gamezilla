/** @jsxImportSource solid-js */
/** What the feed's status and settings screens show in each of their states. */

import { afterEach, expect, test } from 'bun:test';
import type { PuzzleFeedConfig } from '@libs/game-puzzle-shared-ts/feed-config';
import { DEFAULT_PUZZLE_FEED_CONFIG } from '@libs/game-puzzle-shared-ts/feed-config';
import { SearchIcon } from '@pkgs/ui-root-client-ts/icons';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import {
  FEED,
  filledCommands,
  mountPlay,
  none,
} from './puzzle-play-view-fixture';

afterEach(cleanup);

const shown = (testId: string): boolean =>
  screen.queryByTestId(testId) !== null;

const SHELL = {
  statusKind: 'loading',
  status: 'loading',
  elapsedMs: null,
  share: null,
} as const;

test('status, loading: one activity indicator and the settings row, no board', () => {
  mountPlay('status', { ...SHELL, stage: 'loading' });
  expect(document.querySelector('[data-component="LoadingState"]')).not.toBe(
    null
  );
  expect(shown('board')).toBe(false);
  expect(shown('chess-puzzle-feed-summary')).toBe(true);
  expect(shown('chess-puzzle-action-hint')).toBe(false);
});

test('status, offline: says puzzles need a connection', () => {
  mountPlay('status', { ...SHELL, stage: 'offline' });
  expect(screen.getByTestId('chess-puzzle-offline').textContent).toContain(
    "You're offline"
  );
});

test('status, limited: the denial and what unlocks more', () => {
  let unlocked = 0;
  mountPlay('status', {
    ...SHELL,
    stage: 'limited',
    denial: {
      icon: SearchIcon,
      title: "You've hit today's puzzle limit",
      action: { label: 'Sign in', onPress: () => unlocked++ },
      dataSet: { testid: 'chess-puzzle-limit' },
    },
  });
  fireEvent.click(screen.getByTestId('chess-puzzle-limit-action'));
  expect(unlocked).toBe(1);
});

test('status, empty with filters: including played puzzles is the one thing to do', () => {
  let widened = 0;
  mountPlay('status', {
    ...SHELL,
    stage: 'empty',
    feed: { ...FEED, saved: { ...DEFAULT_PUZZLE_FEED_CONFIG, themes: ['pin'] } },
    onIncludeAllPuzzles: () => widened++,
  });
  expect(filledCommands()).toEqual(['Include played puzzles']);
  fireEvent.click(screen.getByTestId('chess-puzzle-empty-pool-action'));
  expect(widened).toBe(1);
  expect(shown('chess-puzzle-empty-pool-no-failed')).toBe(false);
});

test('status, empty with nothing failed: says why, in its own words', () => {
  mountPlay('status', {
    ...SHELL,
    stage: 'empty',
    feed: {
      ...FEED,
      saved: { ...DEFAULT_PUZZLE_FEED_CONFIG, historyFilter: 'failed' },
    },
  });
  expect(shown('chess-puzzle-empty-pool-no-failed')).toBe(true);
});

test('status, empty with nothing to widen: the one thing to do opens the settings', () => {
  const opened: string[] = [];
  mountPlay('status', {
    ...SHELL,
    stage: 'empty',
    feed: {
      ...FEED,
      saved: { ...DEFAULT_PUZZLE_FEED_CONFIG, historyFilter: 'any' },
    },
    onOpen: (place) => opened.push(place.screen),
  });
  fireEvent.click(screen.getByTestId('chess-puzzle-empty-pool-action'));
  expect(opened).toEqual(['feed']);
});

test('status, waiting: a watcher waits for the host and has nothing to set', () => {
  mountPlay('status', { ...SHELL, stage: 'waiting', spectator: true });
  expect(shown('chess-puzzle-waiting-for-host')).toBe(true);
  expect(shown('chess-puzzle-feed-summary')).toBe(false);
});

// regression: puzzle-feed-settings-unlabelled — on a phone the puzzle
// feed's settings were a small sliders icon with no words, far below the
// board. The one control that opens them names them, with what the feed
// serves now as its value.
test('the settings row names the settings and what the saved feed serves', () => {
  mountPlay('play', { allowanceLabel: '2 rated puzzles remaining today' });
  const row = screen.getByTestId('chess-puzzle-feed-summary');
  const label = screen.getByTestId('chess-puzzle-feed-settings-label');
  expect(label.textContent).toBe('Puzzle settings');
  expect(row.contains(label)).toBe(true);
  expect(screen.getByTestId('chess-puzzle-feed-target-label').textContent).toBe(
    'Auto target 1500'
  );
  expect(screen.getByTestId('chess-puzzle-feed-history-label').textContent).toBe(
    'Unseen'
  );
  expect(screen.getByTestId('chess-puzzle-feed-themes-label').textContent).toBe(
    'All themes'
  );
  expect(screen.getByTestId('chess-puzzle-remaining-today').textContent).toBe(
    '2 rated puzzles remaining today'
  );
  expect(screen.getByTestId('chess-puzzle-feed-description').textContent).toBe(
    'Puzzle feed. Automatic target 1500. History: Unseen. Themes: All themes. Manual next puzzle. 2 rated puzzles remaining today'
  );
});

test('feed: one row per setting with the value the draft holds, the pool and Done', () => {
  const draft: PuzzleFeedConfig = {
    ...DEFAULT_PUZZLE_FEED_CONFIG,
    mode: 'custom',
    customRating: 1850,
    historyFilter: 'failed',
    themes: ['mate', 'pin'],
    autoAdvance: 'after1s',
  };
  mountPlay('feed', { feed: { ...FEED, draft, draftTarget: 1850 } });
  expect(screen.getByTestId('chess-puzzle-feed-row-target').textContent).toContain(
    'Custom target 1850'
  );
  expect(
    screen.getByTestId('chess-puzzle-feed-row-history').textContent
  ).toContain('Failed');
  expect(
    screen.getByTestId('chess-puzzle-feed-theme-trigger').textContent
  ).toContain('2 themes');
  expect(
    screen.getByTestId('chess-puzzle-feed-row-advance').textContent
  ).toContain('Next after 1 s');
  expect(screen.getByTestId('chess-puzzle-feed-pool').textContent).toBe(
    '12 matching · 40 local puzzles'
  );
  expect(filledCommands()).toEqual(['Done']);
  // No setting is edited on the hub itself.
  expect(shown('chess-puzzle-feed-offset-increase')).toBe(false);
  expect(shown('chess-puzzle-feed-history-any')).toBe(false);
});

test('feed: each row opens the screen of its setting, and Done saves', () => {
  const opened: string[] = [];
  let done = 0;
  mountPlay('feed', {
    onOpen: (place) => opened.push(place.screen),
    feed: { ...FEED, onDone: () => done++ },
  });
  for (const row of [
    'chess-puzzle-feed-row-target',
    'chess-puzzle-feed-row-history',
    'chess-puzzle-feed-theme-trigger',
    'chess-puzzle-feed-row-advance',
  ])
    fireEvent.click(screen.getByTestId(row));
  expect(opened).toEqual([
    'feed-target',
    'feed-history',
    'feed-themes',
    'feed-advance',
  ]);
  fireEvent.click(screen.getByTestId('chess-puzzle-feed-done'));
  expect(done).toBe(1);
});

test('feed, locked: a guest is told how to get an account, with no row and no Done', () => {
  mountPlay('feed', {
    feed: {
      ...FEED,
      status: 'locked',
      denial: {
        icon: SearchIcon,
        title: 'Sign in to customize your feed',
        action: { label: 'Sign in', onPress: none },
        dataSet: { testid: 'chess-puzzle-feed-locked' },
      },
    },
  });
  expect(screen.getByTestId('chess-puzzle-feed-locked-action').textContent).toBe(
    'Sign in'
  );
  expect(shown('chess-puzzle-feed-pool')).toBe(false);
  expect(shown('chess-puzzle-feed-row-target')).toBe(false);
  expect(shown('chess-puzzle-feed-done')).toBe(false);
});

test('feed, loading: one activity indicator until the saved settings are read', () => {
  mountPlay('feed', { feed: { ...FEED, status: 'loading' } });
  expect(shown('chess-puzzle-feed-row-target')).toBe(false);
  expect(shown('chess-puzzle-feed-done')).toBe(false);
});

test('feed-history and feed-advance: a choice is applied and returns to the settings', () => {
  const patches: Partial<PuzzleFeedConfig>[] = [];
  let back = 0;
  const wiring = {
    onBack: () => back++,
    feed: {
      ...FEED,
      onChange: (patch: Partial<PuzzleFeedConfig>) => patches.push(patch),
    },
  };
  mountPlay('feed-history', wiring);
  fireEvent.click(screen.getByTestId('chess-puzzle-feed-history-seen'));
  cleanup();
  mountPlay('feed-advance', wiring);
  fireEvent.click(screen.getByTestId('chess-puzzle-feed-auto-advance-immediate'));
  expect(patches).toEqual([
    { historyFilter: 'seen' },
    { autoAdvance: 'immediate' },
  ]);
  expect(back).toBe(2);
});

test('feed-target: automatic previews the target under its offset; custom has its own stepper', () => {
  const patches: Partial<PuzzleFeedConfig>[] = [];
  const onChange = (patch: Partial<PuzzleFeedConfig>): void => {
    patches.push(patch);
  };
  mountPlay('feed-target', {
    feed: {
      ...FEED,
      draft: { ...DEFAULT_PUZZLE_FEED_CONFIG, autoOffset: 100 },
      draftTarget: 1600,
      onChange,
    },
  });
  expect(screen.getByTestId('chess-puzzle-feed-offset-value').textContent).toBe(
    '100'
  );
  expect(screen.getByTestId('chess-puzzle-feed-target').textContent).toBe(
    'Target rating: 1600'
  );
  expect(shown('chess-puzzle-feed-custom-rating-value')).toBe(false);
  fireEvent.click(screen.getByTestId('chess-puzzle-feed-offset-increase'));
  fireEvent.click(screen.getByTestId('chess-puzzle-feed-mode-custom'));
  expect(patches).toEqual([{ autoOffset: 150 }, { mode: 'custom' }]);
  cleanup();
  mountPlay('feed-target', {
    feed: {
      ...FEED,
      draft: { ...DEFAULT_PUZZLE_FEED_CONFIG, mode: 'custom' },
      onChange,
    },
  });
  expect(shown('chess-puzzle-feed-custom-rating-value')).toBe(true);
  expect(shown('chess-puzzle-feed-offset-value')).toBe(false);
});

test('feed-themes: a theme toggles, and one the search hides keeps its choice', () => {
  const patches: Partial<PuzzleFeedConfig>[] = [];
  mountPlay('feed-themes', {
    feed: {
      ...FEED,
      draft: { ...DEFAULT_PUZZLE_FEED_CONFIG, themes: ['mate'] },
      onChange: (patch) => patches.push(patch),
    },
  });
  expect(
    screen.getByTestId('chess-puzzle-feed-theme-mate').getAttribute('aria-pressed')
  ).toBe('true');
  expect(
    screen.getByTestId('chess-puzzle-feed-theme-pin').getAttribute('aria-pressed')
  ).toBe('false');
  const search = screen.getByTestId('chess-puzzle-feed-theme-search');
  fireEvent.input(search.querySelector('input') ?? search, {
    target: { value: 'pi' },
  });
  expect(shown('chess-puzzle-feed-theme-mate')).toBe(false);
  fireEvent.click(screen.getByTestId('chess-puzzle-feed-theme-pin'));
  expect(patches).toEqual([{ themes: ['mate', 'pin'] }]);
});
