/** @jsxImportSource solid-js */
/** The games list's tags: who plays each game, said once about who watches. */

import { afterEach, expect, test } from 'bun:test';
import { SpaceGamesScreenView } from '@libs/spaces-client-ts/space-games-screen-view';
import { GAMES } from '@libs/spaces-client-ts/spaces-story.example';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(width: number): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="dark" fixedLayout={{ width, height: 900 }}>
      <SpaceGamesScreenView
        games={GAMES}
        shownGame={null}
        canSelectGame
        present={5}
        hostChoosesNotice={false}
        onSelectGame={() => undefined}
        whoIsHere={<span>5 here · you host</span>}
      />
    </ThemeProvider>
  ));
}

// regression: space-game-list-repeats-spectator-rule — with five here,
// every row's tag said "2 play, others watch" under a line that already
// said everyone else watches, crowding the choice of a game.
test('each row says only who plays; one line says the rest watch', () => {
  for (const width of [390, 1440]) {
    mount(width);
    expect(screen.queryByText(/others watch/)).toBeNull();
    expect(screen.getAllByText(/everyone else here can watch/)).toHaveLength(1);
    expect(screen.getByText('2 players')).toBeTruthy();
    expect(screen.getAllByText('4 players')).toHaveLength(2);
    expect(screen.getByText('Solo')).toBeTruthy();
    cleanup();
  }
});
