/** @jsxImportSource solid-js */
/** Before a search: one card holds the choice, its conditions and what the person brings. */

import { afterEach, expect, test } from 'bun:test';
import { MultiplayerScreenView } from '@libs/game-matchmaking-client-ts/multiplayer-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(width: number): HTMLElement {
  const time = createHarnessClock();
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
        <MultiplayerScreenView
          title="Connect Four"
          stage="search"
          next={{ kind: 'find', players: 2, timed: false }}
          error={null}
          online
          ratings={[{ pool: 'game', rating: 1512, games: 7 }]}
          confirming={null}
          manyPlayers={false}
          onFind={() => Promise.resolve()}
          onStop={() => Promise.resolve()}
          onConfirm={() => Promise.resolve()}
          onCloseConfirm={() => undefined}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

// regression: matchmaking-columns-lopsided — wide, a 210px search card sat
// beside a 500px rail of ratings and three paragraphs on how matchmaking
// works, so the explanation outweighed the decision.
test('wide: the search, the ratings and a short guide are one card, with no rail beside it', () => {
  const container = mount(1440);
  const card = container.querySelector('[data-component="GameSetupPanel"]');
  if (card === null) throw new Error('No search card');
  expect(card.contains(screen.getByTestId('multiplayer-rating-game'))).toBe(
    true
  );
  expect(card.contains(screen.getByTestId('multiplayer-guide'))).toBe(true);
  expect(
    container
      .querySelector('[data-component="GameLayout"]')
      ?.getAttribute('data-has-aside')
  ).toBe('false');
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
  for (const width of [390, 1440]) {
    mount(width);
    const conditions = screen.getByTestId('multiplayer-find-conditions');
    expect(conditions.getAttribute('data-component')).toBe('GameFacts');
    expect(conditions.querySelector('[data-component="Badge"]')).toBeNull();
    const facts = [
      ...conditions.querySelectorAll('[data-component="GameFact"]'),
    ].map((fact) => fact.textContent);
    expect(facts).toEqual(['Rated', 'Untimed']);
    // The chips and the command are one group: the command comes next.
    const actions = conditions.nextElementSibling;
    expect(
      actions?.contains(screen.getByTestId('multiplayer-find')) === true
    ).toBe(true);
    expect(screen.queryByText('Find someone to play with.')).toBeNull();
    expect(screen.queryByText('This search finds')).toBeNull();
    cleanup();
  }
});

// regression: matchmaking-phone-drops-guide — a phone left out "How
// matchmaking works", which the wide card explains.
// regression: matchmaking-guide-dominates — wide, the three points of the
// guide sat open under the search and outweighed its one command, while a
// phone kept them closed. Every size keeps them behind one closed disclosure.
test.each([390, 1440])(
  'at %ipx the ratings are in the card and the guide behind one closed disclosure',
  (width) => {
    const container = mount(width);
    const card = container.querySelector('[data-component="GameSetupPanel"]');
    expect(card?.contains(screen.getByTestId('multiplayer-rating-game'))).toBe(
      true
    );
    const guide = screen.getByTestId('multiplayer-guide');
    expect(card?.contains(guide)).toBe(true);
    const toggle = screen.getByTestId('multiplayer-guide-toggle');
    expect(toggle.textContent).toContain('How matchmaking works');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Every match is rated')).toBeNull();
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Every match is rated')).toBeTruthy();
  }
);

// regression: provisional-rating-reads-as-error — "1512?" read like an
// error: the "?" the spec keeps is a quiet glyph beside the number, and the
// tag beside it says the rating is provisional.
test('a provisional rating keeps its "?" quietly, its tag saying what it means', () => {
  mount(1440);
  const value = screen.getByTestId('multiplayer-rating-game-value');
  expect(value.textContent).toBe('1512?');
  const mark = [...value.querySelectorAll('span')].find(
    (span) => span.textContent === '?'
  );
  expect(mark?.className).toContain('text-text-secondary');
  const tag = screen.getByTestId('multiplayer-rating-game-provisional');
  expect(tag.textContent).toBe('Provisional');
  expect(tag.getAttribute('data-intent')).toBe('info');
});
