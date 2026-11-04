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

/** A px length from an inline style, or 0 when it is unset. */
function px(value: string): number {
  return value === '' ? 0 : Number.parseFloat(value);
}

// regression: game-chooser-faces-cropped-to-slivers
test('every face shows whole: inside its ring, overlapped by nothing but a ring', () => {
  const container = mount(() => (
    <SpaceWhoIsHereView
      faces={faces([AVERY, ...GUESTS])}
      host={AVERY}
      hostIsYou={false}
    />
  ));
  const group = container.querySelector('[data-component="AvatarGroup"]');
  const avatars = [
    ...(group?.querySelectorAll<HTMLElement>('[data-component="Avatar"]') ??
      []),
  ];
  expect(avatars.length).toBeGreaterThan(1);
  for (const [index, avatar] of avatars.entries()) {
    const slot = avatar.parentElement as HTMLElement;
    const ring = px(slot.style.borderWidth);
    const face = px(avatar.style.width);
    // The face fits inside its ring, so the ring never crops it.
    expect(face + ring * 2).toBeLessThanOrEqual(px(slot.style.width));
    // A neighbour reaches no further than the ring around this face.
    if (index > 0) expect(-px(slot.style.marginLeft)).toBeLessThanOrEqual(ring);
    // Big enough to tell people apart.
    expect(face).toBeGreaterThanOrEqual(28);
  }
});
