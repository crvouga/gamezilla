/** @jsxImportSource solid-js */
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
  expect(row.textContent).toContain('5+0');
  expect(row.textContent).toContain('Blitz');
  // The choices are a place of their own, never on the hub.
  expect(screen.queryByTestId('multiplayer-time-control-10-0')).toBeNull();
  row.click();
  expect(screen.queryByTestId('multiplayer-find')).toBeNull();
  expect(
    screen
      .getByTestId('multiplayer-time-control-5-0')
      .getAttribute('aria-current')
  ).toBe('true');
  screen.getByTestId('multiplayer-time-control-10-0').click();
  expect(
    screen.getByTestId('multiplayer-open-time-control').textContent
  ).toContain('10+0');
  expect(
    [
      ...screen
        .getByTestId('multiplayer-find-conditions')
        .querySelectorAll('[data-component="GameFact"]'),
    ].map((fact) => fact.textContent)
  ).toEqual(['Rated', '10+0']);
});

test('choosing the clock already chosen returns to the search all the same', () => {
  const view = mountPlaces({
    stage: 'idle',
    open: 'time-control',
    props: { find: { players: 2, timed: true, timeControl: '5+0' } },
  });
  screen.getByTestId('multiplayer-time-control-5-0').click();
  expect(view.place()).toBe('find');
  expect(screen.getByTestId('multiplayer-find')).toBeTruthy();
});

// regression: matchmaking-intro-wordy — the card said "Find someone to
// play with." and "This search finds / A rated game with no clock" before
// its one command.
// regression: match-conditions-unlike-game-chips — the conditions were
// plain "Rated · No clock" text while a game's title showed "Unrated"
// "Untimed" as chips, and wide they floated about 60px above the command.
// regression: match-chips-look-pressable — the conditions were then pills
// that looked pressable and said "No clock" where a game says "Untimed".
// They are the game's own quiet settings line, in the game's words.
test("the conditions are the game's settings line, right above the command", () => {
  for (const width of WIDTHS) {
    mountPlaces({ stage: 'idle', width });
    const conditions = screen.getByTestId('multiplayer-find-conditions');
    expect(conditions.getAttribute('data-component')).toBe('GameFacts');
    expect(conditions.querySelector('[data-component="Badge"]')).toBeNull();
    const facts = [
      ...conditions.querySelectorAll('[data-component="GameFact"]'),
    ].map((fact) => fact.textContent);
    expect(facts).toEqual(['Rated', 'Untimed']);
    // The conditions and the command are one group: the command comes next.
    const actions = conditions.nextElementSibling;
    expect(
      actions?.contains(screen.getByTestId('multiplayer-find')) === true
    ).toBe(true);
    expect(screen.queryByText('Find someone to play with.')).toBeNull();
    expect(screen.queryByText('This search finds')).toBeNull();
    // Under it, what a found opponent means for the space.
    const note = screen.getByTestId('multiplayer-find-space');
    expect(note.textContent).toContain('opens in this space');
    expect(note.textContent).toContain('everyone can watch');
    expect(
      screen.getByTestId('multiplayer-find').compareDocumentPosition(note) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
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
