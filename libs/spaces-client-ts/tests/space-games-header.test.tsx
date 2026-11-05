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
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';

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
  expect(text.split('everyone else here watches')).toHaveLength(2);
  // No game's tag repeats it.
  expect(text).not.toContain('others watch');
});
