/** @jsxImportSource solid-js */
/** The games list's header says who is here once; each game says who plays. */

import { afterEach, expect, test } from 'bun:test';
import { SpaceGamesScreenView } from '@libs/spaces-client-ts/space-games-screen-view';
import { SpaceWhoIsHereView } from '@libs/spaces-client-ts/space-who-is-here-view';
import {
  AVERY,
  faces,
  GAMES,
  GUESTS,
} from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

// regression: space-seats-explained-twice
test('with more here than a game seats, the header never explains seats again', () => {
  const { container } = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 1280, height: 800 }}
    >
      <SpaceGamesScreenView
        games={GAMES}
        shownGame={null}
        canSelectGame
        present={1 + GUESTS.length}
        hostChoosesNotice={false}
        onSelectGame={() => undefined}
        whoIsHere={
          <SpaceWhoIsHereView
            faces={faces([AVERY, ...GUESTS])}
            host={AVERY}
            hostIsYou
          />
        }
      />
    </ThemeProvider>
  ));
  const text = container.textContent ?? '';
  expect(text).toContain('5 here · you host');
  // Said once, in the list's subtitle; never again in the header.
  expect(text.split('everyone else here can watch')).toHaveLength(2);
  // regression: game-list-watch-rule-unclear — "Pick a game to play;
  // everyone else here watches" sat over games for two to four players, as
  // if only the chooser played. The line says the players are chosen next.
  expect(text).toContain('Choose a game, then its players');
  // No game's tag repeats it.
  expect(text).not.toContain('others watch');
});

function mountGames(size: { width: number; height: number }): void {
  renderWithI18n(() => (
    <ThemeProvider colorScheme="light" fixedLayout={size}>
      <TestViewportProvider value={size}>
        <SpaceGamesScreenView
          games={GAMES}
          shownGame={null}
          canSelectGame
          present={1 + GUESTS.length}
          hostChoosesNotice={false}
          onSelectGame={() => undefined}
          whoIsHere={
            <SpaceWhoIsHereView
              faces={faces([AVERY, ...GUESTS])}
              host={AVERY}
              hostIsYou
              onInvite={() => undefined}
            />
          }
        />
      </TestViewportProvider>
    </ThemeProvider>
  ));
}

// regression: space-desktop-members-only-in-header — wide, four game tiles
// sat across the top of an empty page and the people here were only small
// faces in the header, while a phone showed them in the page. Wide, a
// "Who's here" section follows the games: everyone here by face and name,
// the host marked, Invite friends at its head. A phone keeps its line of
// faces above the games.
test("wide, Who's here follows the games with each person by name; a phone keeps its line above", () => {
  mountGames({ width: 1440, height: 900 });
  const section = screen.getByTestId('space-who-is-here');
  const tiles = screen.getByTestId(`game-menu-${GAMES[0]?.id ?? ''}`);
  expect(
    tiles.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
  expect(screen.getByRole('heading', { name: "Who's here" })).toBeTruthy();
  const people = [...section.querySelectorAll('[role="listitem"]')].map(
    (row) => row.textContent
  );
  expect(people).toEqual([
    `${AVERY.name}Host`,
    ...GUESTS.map((guest) => guest.name),
  ]);
  expect(section.contains(screen.getByTestId(Handles.spaceInviteFriends))).toBe(
    true
  );
  cleanup();
  mountGames({ width: 390, height: 844 });
  expect(screen.queryByTestId('space-who-is-here')).toBeNull();
  const invite = screen.getByTestId(Handles.spaceInviteFriends);
  expect(
    invite.compareDocumentPosition(
      screen.getByTestId(`game-menu-${GAMES[0]?.id ?? ''}`)
    ) & Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});
