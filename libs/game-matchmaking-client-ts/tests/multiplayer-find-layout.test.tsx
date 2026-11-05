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
test('the conditions are one short line above the command', () => {
  for (const width of [390, 1440]) {
    mount(width);
    expect(screen.getByTestId('multiplayer-find-conditions').textContent).toBe(
      'Rated · No clock'
    );
    expect(screen.queryByText('Find someone to play with.')).toBeNull();
    expect(screen.queryByText('This search finds')).toBeNull();
    cleanup();
  }
});

test('a phone keeps the ratings in the card and leaves the guide out', () => {
  const container = mount(390);
  const card = container.querySelector('[data-component="GameSetupPanel"]');
  expect(card?.contains(screen.getByTestId('multiplayer-rating-game'))).toBe(
    true
  );
  expect(screen.queryByTestId('multiplayer-guide')).toBeNull();
});
