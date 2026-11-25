/** @jsxImportSource @solidjs/web */
/** The lobby's desktop cards each keep one column's width, a lone one too. */

import { afterEach, expect, test } from 'bun:test';
import type { SpaceCardData } from '@libs/spaces-client-ts/space-card-view';
import { SpacesLobbyView } from '@libs/spaces-client-ts/spaces-lobby-view';
import {
  FRIEND_SPACE,
  HOSTED_SPACE,
  JOINED_SPACE,
  LOBBY_SPACES,
} from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';

afterEach(cleanup);

function mountWide(spaces: readonly SpaceCardData[], hosted: number) {
  return renderWithI18n(() => (
    <ThemeProvider
      colorScheme="dark"
      fixedLayout={{ width: 1280, height: 800 }}
    >
      <SpacesLobbyView
        status="ready"
        hostedCount={hosted}
        spaces={spaces}
        onOpenSpace={() => undefined}
      />
    </ThemeProvider>
  )).container;
}

/** The cards laid two by two, and those across the full width. */
function placement(container: HTMLElement, space: SpaceCardData): string {
  const card = container.querySelector(
    `[data-testid="${Handles.spaceLobbyCard(space.spaceId)}"]`
  );
  if (card === null) return 'missing';
  return card.closest('[data-component="Grid"]') === null ? 'full' : 'paired';
}

// regression: lobby-lone-card-stretches-full-width
test('an odd group, and a lone card, keep one column each', () => {
  const container = mountWide([HOSTED_SPACE, FRIEND_SPACE, JOINED_SPACE], 1);
  expect(placement(container, HOSTED_SPACE)).toBe('paired');
  expect(placement(container, FRIEND_SPACE)).toBe('paired');
  expect(placement(container, JOINED_SPACE)).toBe('paired');
  cleanup();
  expect(placement(mountWide([HOSTED_SPACE], 1), HOSTED_SPACE)).toBe('paired');
});

test('even groups pair every card, and every space wears its own mark', () => {
  const container = mountWide(LOBBY_SPACES, 2);
  for (const space of LOBBY_SPACES) {
    expect(placement(container, space)).toBe('paired');
  }
  expect(
    container.querySelectorAll('[data-component="MonogramTile"]').length
  ).toBe(LOBBY_SPACES.length);
});
