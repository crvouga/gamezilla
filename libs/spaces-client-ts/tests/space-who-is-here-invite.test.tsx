/** @jsxImportSource solid-js */
/**
 * The games list's room line: one set of faces on a desktop (the header's),
 * and a labelled Invite friends beside who is here.
 */
import { afterEach, expect, test } from 'bun:test';
import { SpaceWhoIsHereView } from '@libs/spaces-client-ts/space-who-is-here-view';
import {
  AVERY,
  faces,
  GUESTS,
} from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

function mount(
  size: { width: number; height: number },
  invited: string[]
): HTMLElement {
  const { container } = renderWithI18n(() => (
    <ThemeProvider colorScheme="light" fixedLayout={size}>
      <TestViewportProvider value={size}>
        <SpaceWhoIsHereView
          faces={faces([AVERY, ...GUESTS])}
          host={AVERY}
          hostIsYou
          onInvite={() => invited.push('share')}
        />
      </TestViewportProvider>
    </ThemeProvider>
  ));
  return container;
}

// regression: space-games-header-repeats-faces
test('a desktop line says who is here without a second set of faces', () => {
  const container = mount(DESKTOP, []);
  expect(screen.getByText('5 here · you host')).toBeTruthy();
  expect(container.querySelector('[data-component="AvatarGroup"]')).toBeNull();
});

// regression: space-games-no-visible-invite
test('Invite friends sits beside who is here and opens the Share sheet', () => {
  const invited: string[] = [];
  mount(DESKTOP, invited);
  const invite = screen.getByTestId(Handles.spaceInviteFriends);
  expect(invite.textContent).toContain('Invite friends');
  fireEvent.click(invite);
  expect(invited).toEqual(['share']);
});

test('a phone, whose header only counts people, shows their faces and Invite friends', () => {
  const container = mount(PHONE, []);
  expect(
    container.querySelector('[data-component="AvatarGroup"]')
  ).not.toBeNull();
  expect(screen.getByTestId(Handles.spaceInviteFriends)).toBeTruthy();
});
