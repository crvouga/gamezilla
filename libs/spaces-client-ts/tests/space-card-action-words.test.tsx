/** @jsxImportSource solid-js */
/**
 * A lobby card names what pressing it does in one of two words: Open for a
 * space the viewer already belongs to, Join for someone else's.
 */
import { afterEach, expect, test } from 'bun:test';
import { FriendLiveSpaceJoinView } from '@libs/spaces-client-ts/friend-live-space';
import { SpaceCardView } from '@libs/spaces-client-ts/space-card-view';
import {
  FRIEND_SPACE,
  HOSTED_SPACE,
  SECOND_HOSTED_SPACE,
} from '@libs/spaces-client-ts/spaces-story.example';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

afterEach(cleanup);

function mount(ui: () => JSX.Element): void {
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      {ui()}
    </ThemeProvider>
  ));
}

// regression: space-entry-words-differ
test('the space open here and the other one you host both say Open', () => {
  mount(() => (
    <>
      <SpaceCardView space={HOSTED_SPACE} onOpen={() => undefined} />
      <SpaceCardView space={SECOND_HOSTED_SPACE} onOpen={() => undefined} />
      <SpaceCardView space={FRIEND_SPACE} onOpen={() => undefined} />
    </>
  ));
  expect(screen.queryByText('Resume')).toBeNull();
  expect(screen.getAllByText('Open')).toHaveLength(2);
  expect(screen.getAllByText('Join')).toHaveLength(1);
});

test("a friend's space already open here says Open, as the lobby does", () => {
  mount(() => (
    <FriendLiveSpaceJoinView action="open" onPress={() => undefined} />
  ));
  expect(screen.getByRole('button', { name: 'Open' })).toBeTruthy();
  expect(screen.queryByText('Resume')).toBeNull();
});
