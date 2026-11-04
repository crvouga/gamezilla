/** @jsxImportSource solid-js */
/** The games list's line saying who is in the space and who hosts. */

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
import { cleanup, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

afterEach(cleanup);

function mount(ui: () => JSX.Element): HTMLElement {
  const { container } = renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      {ui()}
    </ThemeProvider>
  ));
  return container;
}

// regression: game-chooser-hides-the-room
test('choosing a game, the list says who is here and who hosts', () => {
  const container = mount(() => (
    <SpaceGamesScreenView
      games={GAMES}
      shownGame={null}
      canSelectGame={false}
      hostChoosesNotice={false}
      onSelectGame={() => undefined}
      whoIsHere={
        <SpaceWhoIsHereView
          faces={faces([AVERY, ...GUESTS])}
          host={AVERY}
          hostIsYou={false}
        />
      }
    />
  ));
  expect(screen.getByText('5 here · avery hosts')).toBeTruthy();
  expect(
    container.querySelector('[data-component="AvatarGroup"]')
  ).not.toBeNull();
});

test('the host is told they host', () => {
  mount(() => (
    <SpaceWhoIsHereView
      faces={faces([AVERY, ...GUESTS])}
      host={AVERY}
      hostIsYou
    />
  ));
  expect(screen.getByText('5 here · you host')).toBeTruthy();
});

test('a host alone is told it is just them', () => {
  mount(() => (
    <SpaceWhoIsHereView faces={faces([AVERY])} host={AVERY} hostIsYou />
  ));
  expect(screen.getByText('Just you here')).toBeTruthy();
});

test('before anyone is connected the line is not drawn', () => {
  const container = mount(() => (
    <SpaceWhoIsHereView faces={[]} host={null} hostIsYou={false} />
  ));
  expect(container.textContent).toBe('');
});
