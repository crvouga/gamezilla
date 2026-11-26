/** @jsxImportSource @solidjs/web */
/**
 * Before a search: a hub of rows, the search's conditions and its one
 * command. The ratings and the guide are places of their own, the same on
 * a phone and wide.
 */

import { afterEach, expect, test } from 'bun:test';
import { cleanup, screen } from '@solidjs/testing-library';
import { mountPlaces } from './multiplayer-places-fixture';

afterEach(cleanup);

const WIDTHS = [390, 1440];

// regression: matchmaking-columns-lopsided — wide, a 210px search card sat
// beside a 500px rail of ratings and three paragraphs on how matchmaking
// works, so the explanation outweighed the decision.
// regression: matchmaking-card-lonely
// regression: matchmaking-columns-equal-weight
// regression: matchmaking-card-too-wide
// regression: matchmaking-search-stretched-legal-columns
// regression: matchmaking-column-off-the-page-edge — every one of these was
// a way one card failed to hold the search, the ratings and the guide at
// once. The search no longer shares its screen: it is a menu-width hub.
test('the search is a hub of rows and one command, with no ratings or guide beside it', () => {
  for (const width of WIDTHS) {
    const { container } = mountPlaces({ stage: 'idle', width });
    expect(
      container.querySelector('[data-component="GameSetupPanel"]')
    ).toBeNull();
    expect(container.querySelector('[data-component="GameLayout"]')).toBeNull();
    expect(screen.queryByTestId('multiplayer-rating-game')).toBeNull();
    expect(screen.queryByTestId('multiplayer-guide')).toBeNull();
    const rows = [
      ...container.querySelectorAll('[data-component="MenuRow"]'),
    ].map((row) => row.getAttribute('data-testid'));
    expect(rows).toEqual([
      'multiplayer-open-ratings',
      'multiplayer-open-guide',
    ]);
    // The match's choices are one section; how it works is its own, after.
    const sections = [
      ...container.querySelectorAll('[data-component="MenuSection"]'),
    ];
    expect(sections).toHaveLength(2);
    expect(
      sections[1]?.contains(screen.getByTestId('multiplayer-open-guide'))
    ).toBe(true);
    // One filled command, and it is finding an opponent.
    const filled = [
      ...container.querySelectorAll('button[data-variant="solid"]'),
    ].map((button) => button.getAttribute('data-testid'));
    expect(filled).toEqual(['multiplayer-find']);
    cleanup();
  }
});

test('a game with clock choices adds one row showing the chosen clock, and choosing another returns with it', () => {
  mountPlaces({
    stage: 'idle',
    props: { find: { players: 2, timed: true, timeControl: '5+0' } },
  });
  const row = screen.getByTestId('multiplayer-open-time-control');
  // The clock is said in plain words; its shorthand is for the choices.
  expect(row.textContent).toContain('5 min');
  expect(row.getAttribute('data-time-control')).toBe('5+0');
  expect(row.textContent).toContain('Blitz');
  // The choices are a place of their own, never on the hub.
  expect(screen.queryByTestId('multiplayer-time-control-10-0')).toBeNull();
  row.click();
  expect(screen.queryByTestId('multiplayer-find')).toBeNull();
  expect(
    screen
      .getByTestId('multiplayer-time-control-5-0')
      .getAttribute('aria-pressed')
  ).toBe('true');
  screen.getByTestId('multiplayer-time-control-10-0').click();
  expect(
    screen.getByTestId('multiplayer-open-time-control').textContent
  ).toContain('10 min');
  expect(screen.getByTestId('multiplayer-find-rated').textContent).toBe(
    'Rated'
  );
  // regression: matchmaking-clock-said-twice — the clock was a tile on the
  // card and the row's value. The row alone says a chosen clock.
  expect(screen.queryByTestId('multiplayer-find-clock')).toBeNull();
  expect(
    screen.getByTestId('multiplayer-find-conditions').textContent
  ).not.toContain('10 min');
});

test('choosing the clock already chosen returns to the search all the same', () => {
  const view = mountPlaces({
    stage: 'idle',
    open: 'time-control',
    props: { find: { players: 2, timed: true, timeControl: '5+0' } },
  });
  screen.getByTestId('multiplayer-time-control-5-0').click();
  expect(view.place()).toBe('home');
  expect(screen.getByTestId('multiplayer-find')).toBeTruthy();
});

// regression: matchmaking-intro-wordy — the card said "Find someone to
// play with." and "This search finds / A rated game with no clock" before
// its one command.
// regression: match-conditions-unlike-game-chips
// regression: match-chips-look-pressable
// regression: matchmaking-find-empty-canvas — the command sat far from the
// thumb: it is docked at the foot of the screen.
// regression: matchmaking-board-preview-dominates — a phone gave most of
// the screen to a still picture of the board, and the card repeated the
// clock and the rating as tiles over the rows that set them. The card is
// one line of what is played for over the game's name and goal: no board,
// no tiles.
test('what is played opens the screen as one compact card, and the one command is docked', () => {
  for (const width of WIDTHS) {
    const view = mountPlaces({
      stage: 'idle',
      width,
      props: { goal: 'Four in a row wins.' },
    });
    const conditions = screen.getByTestId('multiplayer-find-conditions');
    expect(conditions.getAttribute('data-component')).toBe('GameModeCard');
    expect(conditions.querySelector('[data-component="Badge"]')).toBeNull();
    expect(conditions.querySelector('button')).toBeNull();
    expect(conditions.querySelector('dl')).toBeNull();
    expect(conditions.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(conditions.querySelector('h1')?.textContent).toBe('Connect Four');
    expect(conditions.textContent).toContain('Ranked match\u00a0· Rated');
    expect(conditions.textContent).toContain('Four in a row wins.');
    expect(screen.getByTestId('multiplayer-find-clock').textContent).toBe(
      'Untimed'
    );
    expect(view.container.querySelectorAll('h1')).toHaveLength(1);
    // The dock holds the command alone.
    const dock = view.container.querySelector(
      '[data-component="GameLobbyDock"]'
    );
    const find = screen.getByTestId('multiplayer-find');
    expect(dock?.contains(find)).toBe(true);
    expect(dock?.textContent).toBe('Find an opponent');
    expect(find.getAttribute('data-size')).toBe('lg');
    expect(screen.queryByText('Find someone to play with.')).toBeNull();
    expect(screen.queryByText('This search finds')).toBeNull();
    // Where the found game is played is said quietly, under how it works.
    const note = screen.getByTestId('multiplayer-find-space');
    expect(dock?.contains(note)).toBe(false);
    expect(
      note
        .closest('[data-component="MenuSection"]')
        ?.contains(screen.getByTestId('multiplayer-open-guide'))
    ).toBe(true);
    expect(note.textContent).toContain('opens in this space');
    expect(note.textContent).toContain('everyone can watch');
    cleanup();
  }
});

// regression: matchmaking-phone-drops-guide — a phone left out "How
// matchmaking works", which the wide card explains.
// regression: matchmaking-guide-dominates — wide, the three points of the
// guide sat open under the search and outweighed its one command.
// regression: matchmaking-guide-nested-card — the guide then stood as a
// sunken grey card inside the card. It is a place of its own, one row from
// the search, with nothing to open or close on any size.
test('the guide is one row away on every size: three points, no disclosure', () => {
  for (const width of WIDTHS) {
    const view = mountPlaces({ stage: 'idle', width });
    expect(screen.queryByText('Every match is rated')).toBeNull();
    screen.getByTestId('multiplayer-open-guide').click();
    expect(view.place()).toBe('guide');
    expect(screen.queryByTestId('multiplayer-guide-toggle')).toBeNull();
    expect(view.container.querySelector('[aria-expanded]')).toBeNull();
    const points = [
      ...screen
        .getByTestId('multiplayer-guide')
        .querySelectorAll('[data-component="MenuRow"]'),
    ].map((point) => point.textContent);
    expect(points).toEqual([
      'Every match is ratedWin, lose or draw, your rating moves once.',
      'Stop whenever you likeA search waits until you stop it or are matched.',
      "Only people you can playNever someone you've blocked, or who blocked you.",
    ]);
    // Nothing to press: the guide is read, then Back.
    expect(
      screen.getByTestId('multiplayer-guide').querySelector('button')
    ).toBeNull();
    cleanup();
  }
});

// regression: provisional-rating-reads-as-error — "1512?" read like an
// error: the "?" the spec keeps is a quiet glyph beside the number.
// regression: provisional-rating-said-three-ways — the "?", a
// "Provisional" tag and a footnote all said the rating was provisional.
// The "?" stays, and the footnote alone says what it means.
test('a provisional rating keeps its "?" quietly, explained once under it', () => {
  mountPlaces({ stage: 'idle' });
  screen.getByTestId('multiplayer-open-ratings').click();
  const value = screen.getByTestId('multiplayer-rating-game-value');
  expect(value.textContent).toBe('1512?');
  const mark = [...value.querySelectorAll('span')].find(
    (span) => span.textContent === '?'
  );
  expect(mark?.className).toContain('text-text-secondary');
  expect(
    screen.queryByTestId('multiplayer-rating-game-provisional')
  ).toBeNull();
  const row = screen.getByTestId('multiplayer-rating-game');
  expect(row.querySelector('[data-component="Badge"]')).toBeNull();
  expect(
    screen.getByTestId('multiplayer-rating-game-settles').textContent
  ).toBe('the “?” goes once your rating settles');
});

// regression: provisional-rating-loud — beside Find an opponent the
// provisional rating drew an accent tag, a progress bar and a two-part
// footnote, outweighing the search itself. There is no bar, and how far
// the rating is from settling is one quiet line.
test('a provisional rating has no tag and no bar, and a settled one no "?"', () => {
  const view = mountPlaces({ stage: 'idle' });
  screen.getByTestId('multiplayer-open-ratings').click();
  const row = screen.getByTestId('multiplayer-rating-game');
  expect(row.querySelector('[data-component="ProgressBar"]')).toBeNull();
  expect(screen.getByTestId('multiplayer-rating-game-games').textContent).toBe(
    '7 of 12 rated games'
  );
  view.set({ ratings: [{ pool: 'game', rating: 1688, games: 240 }] });
  expect(screen.getByTestId('multiplayer-rating-game-value').textContent).toBe(
    '1688'
  );
  expect(screen.getByTestId('multiplayer-rating-game-games').textContent).toBe(
    '240 rated games'
  );
  expect(screen.queryByTestId('multiplayer-rating-game-settles')).toBeNull();
});

// regression: matchmaking-rating-focal-point — in the search's card the
// rating "1512?" was set in the large stat figures, the brightest thing on
// a screen whose task is finding an opponent. On the search it is a row's
// quiet value; the figures are the ratings' own place.
test('on the search the rating is a quiet row value, never a stat', () => {
  for (const width of WIDTHS) {
    const { container } = mountPlaces({ stage: 'idle', width });
    const row = screen.getByTestId('multiplayer-open-ratings');
    expect(row.textContent).toBe('Your ratings1512?');
    expect(container.querySelector('[data-component="GameStat"]')).toBeNull();
    expect(container.querySelector('.textStat')).toBeNull();
    cleanup();
  }
});

test('a game rated per speed shows the rating its chosen clock plays for', () => {
  mountPlaces({
    stage: 'idle',
    props: {
      find: { players: 2, timed: true, timeControl: '10+0' },
      ratings: [
        { pool: 'blitz', rating: 1623, games: 41 },
        { pool: 'rapid', rating: 1488, games: 12 },
      ],
    },
  });
  expect(screen.getByTestId('multiplayer-open-ratings').textContent).toBe(
    'Your ratings1488'
  );
});

// regression: multiplayer-empty-board-unavailable
// regression: matchmaking-first-visit-reads-as-error — a first visit was
// told "No multiplayer game is available to you." in a notice box, like a
// failure. It is one quiet line under the card.
test('a first visit says quietly there is no game here yet, above the search it offers', () => {
  const view = mountPlaces({
    stage: 'idle',
    props: {
      find: { players: 2, timed: false, timeControl: '5+0', fresh: true },
    },
  });
  const told = screen.getByTestId('multiplayer-unavailable');
  expect(told.textContent).toBe(
    'No ranked game here yet. Your first search starts one.'
  );
  expect(told.closest('[data-component="Notice"]')).toBeNull();
  expect(told.querySelector('[role="status"]')).not.toBeNull();
  expect(
    told.compareDocumentPosition(screen.getByTestId('multiplayer-find')) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  // Once something was sought from here, the hub says nothing of the kind.
  view.set({ find: { players: 2, timed: false, timeControl: '5+0' } });
  expect(screen.queryByTestId('multiplayer-unavailable')).toBeNull();
});

test('a bigger game says how many players it finds, and names its command so', () => {
  mountPlaces({
    stage: 'idle',
    props: { find: { players: 4, timed: false, timeControl: '5+0' } },
  });
  expect(
    screen.getByText(
      'A game needs 4 players including you. Find 3 other players.'
    )
  ).toBeTruthy();
  expect(screen.getByTestId('multiplayer-find').textContent).toContain(
    'Find players'
  );
});
