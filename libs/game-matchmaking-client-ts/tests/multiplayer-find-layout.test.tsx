/** @jsxImportSource solid-js */
/**
 * Before a search: a hub of rows, the search's conditions and its one
 * command. The ratings and the guide are places of their own, the same on
 * a phone and wide.
 */

import { afterEach, expect, mock, test } from 'bun:test';
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

test('a game with clock choices offers its quick clocks on the hub, and every other clock one row away', () => {
  const view = mountPlaces({
    stage: 'idle',
    props: { find: { players: 2, timed: true, timeControl: '5+0' } },
  });
  // The quick clocks are radios on the hub itself, the chosen one checked.
  const chosen = screen.getByTestId(
    'multiplayer-clock-5-0'
  ) as HTMLInputElement;
  expect(chosen.checked).toBe(true);
  // The tiles are the clock: the card over them does not repeat it.
  expect(screen.queryByTestId('multiplayer-find-clock')).toBeNull();
  screen.getByTestId('multiplayer-clock-10-0').click();
  expect(view.place()).toBe('find');
  expect(
    (screen.getByTestId('multiplayer-clock-10-0') as HTMLInputElement).checked
  ).toBe(true);
  // Every other clock is a place of its own, one row away.
  const row = screen.getByTestId('multiplayer-open-time-control');
  expect(row.getAttribute('data-time-control')).toBe('10+0');
  row.click();
  expect(screen.queryByTestId('multiplayer-find')).toBeNull();
  screen.getByTestId('multiplayer-time-control-30-20').click();
  expect(view.place()).toBe('find');
  // A clock chosen from the full list joins the quick clocks, checked.
  expect(
    (screen.getByTestId('multiplayer-clock-30-20') as HTMLInputElement).checked
  ).toBe(true);
  expect(screen.getByTestId('multiplayer-find-rated').textContent).toBe(
    'Ranked match'
  );
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
// They are tiles on the card that says what is played, in the game's words.
// regression: matchmaking-find-empty-canvas — the hub was three rows and a
// command at the top of an empty phone: nothing said what was played, and
// the command sat far from the thumb. The mode card opens the screen and
// the command is docked at its foot.
test('what is played opens the screen as one card, and the one command is docked', () => {
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
    expect(conditions.querySelector('h1')?.textContent).toBe('Connect Four');
    expect(conditions.textContent).toContain('Ranked match');
    expect(conditions.textContent).toContain('Four in a row wins.');
    // What the search finds is one line over the game's name, no tiles.
    expect(conditions.querySelectorAll('dd')).toHaveLength(0);
    expect(conditions.textContent).toContain('Ranked match · Untimed');
    expect(view.container.querySelectorAll('h1')).toHaveLength(1);
    // The command and what a found opponent means share the dock.
    const dock = view.container.querySelector(
      '[data-component="GameLobbyDock"]'
    );
    const find = screen.getByTestId('multiplayer-find');
    expect(dock?.contains(find)).toBe(true);
    expect(find.getAttribute('data-size')).toBe('lg');
    expect(screen.queryByText('Find someone to play with.')).toBeNull();
    expect(screen.queryByText('This search finds')).toBeNull();
    const note = screen.getByTestId('multiplayer-find-space');
    expect(dock?.contains(note)).toBe(true);
    expect(note.textContent).toContain('opens in this space');
    expect(note.textContent).toContain('everyone here can watch');
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
  // The rows never repeat it: the list's one footnote says what "?" means.
  expect(screen.queryByTestId('multiplayer-rating-game-settles')).toBeNull();
  expect(
    screen.getByText(/A “\?” marks a rating that settles after 12 rated games/)
  ).toBeTruthy();
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
test('a first visit says there is no game here yet, above the search it offers', () => {
  const view = mountPlaces({
    stage: 'idle',
    props: {
      find: { players: 2, timed: false, timeControl: '5+0', fresh: true },
    },
  });
  const told = screen.getByTestId('multiplayer-unavailable');
  expect(told.textContent).toContain('No game has started here yet.');
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
  expect(screen.getByText('A game of you and 3 other players.')).toBeTruthy();
  expect(screen.getByTestId('multiplayer-find').textContent).toContain(
    'Find players'
  );
});

// regression: search-stop-silent — after Stop searching the hub came back
// with nothing to say the search had ended.
test('a search this device stopped is said so on the hub, until the next search', async () => {
  const view = mountPlaces({ stage: 'searching' });
  screen.getByTestId('multiplayer-stop').click();
  await Promise.resolve();
  await Promise.resolve();
  view.setStage('idle');
  const told = await screen.findByTestId('multiplayer-stopped');
  expect(told.textContent).toContain('Search stopped.');
  screen.getByTestId('multiplayer-find').click();
  await Promise.resolve();
  expect(screen.queryByTestId('multiplayer-stopped')).toBeNull();
});

// regression: finish-first-dead-end — a refused search (finish your current
// game first) left Find an opponent as the only way on, so the person had
// nowhere to go but the same refusal.
test('a refused search leads back to the game first, with trying again a quiet second', () => {
  const view = mountPlaces({
    stage: 'idle',
    props: {
      commandDenial: {
        icon: () => null,
        title: 'Finish your current game first',
        dataSet: { testid: 'multiplayer-command-denial' },
      },
    },
  });
  const back = screen.getByTestId('multiplayer-blocked-leave');
  const find = screen.getByTestId('multiplayer-find');
  expect(back.getAttribute('data-variant')).toBe('solid');
  expect(find.getAttribute('data-variant')).toBe('outline');
  expect(find.textContent).toContain('Search again');
  expect(back.textContent).toContain('Back to game choices');
  expect(
    back.compareDocumentPosition(find) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  back.click();
  expect(view.props().onLeave).toHaveBeenCalledTimes(1);
});

// A custom game still on refuses the search: the dock opens that custom game.
test('a search refused by a custom game still on leads straight to that custom game', () => {
  const onOpenCustomGame = mock(() => undefined);
  mountPlaces({
    stage: 'idle',
    props: {
      onOpenCustomGame,
      find: { players: 2, timed: true, timeControl: '5+0', fresh: true },
      commandDenial: {
        icon: () => null,
        title: 'Finish your Custom Game first',
        dataSet: { testid: 'multiplayer-command-denial', reason: 'restricted' },
      },
    },
  });
  expect(screen.queryByTestId('multiplayer-blocked-leave')).toBeNull();
  // The screen says only that the other game is on: no first-visit line,
  // no clocks to choose while the search cannot run.
  expect(screen.queryByTestId('multiplayer-unavailable')).toBeNull();
  expect(screen.queryByTestId('multiplayer-clock-5-0')).toBeNull();
  expect(screen.queryByTestId('multiplayer-open-time-control')).toBeNull();
  // The refusal is the screen's middle, said as it appears.
  const refusal = screen.getByTestId('multiplayer-command-denial');
  expect(refusal.getAttribute('role')).toBe('status');
  expect(refusal.textContent).toContain('Your custom game is still on.');
  expect(screen.queryByTestId('multiplayer-find-space')).toBeNull();
  const open = screen.getByTestId('multiplayer-open-custom-game');
  expect(open.textContent).toContain('Go to your custom game');
  open.click();
  expect(onOpenCustomGame).toHaveBeenCalledTimes(1);
});
