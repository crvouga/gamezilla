/** @jsxImportSource solid-js */
/**
 * The friend requests waiting reach the person on the friends list on
 * every size: a desktop lists them in the column beside the list, a phone
 * has a "Friend requests" entry with their count at the top of the list.
 */
import { afterEach, expect, test } from 'bun:test';
import { FriendRequestsEntryView } from '@libs/friends-client-ts/friend-requests-entry';
import { FriendsListScreenView } from '@libs/friends-client-ts/friends-list-screen-view';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const router: AppRouter = {
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  canGoBack: () => false,
};

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const ASKERS = ['quinn', 'dana_r'];

function renderFriends(size: { width: number; height: number }): HTMLElement {
  const harness = createHarnessClock();
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider colorScheme="light" fixedLayout={size}>
        <StaticAppRouterProvider router={router}>
          <ModerationProvider rules={shippedModerationRules()}>
          <TestViewportProvider value={size}>
            <FriendsListScreenView
              status="ready"
              friends={[
                {
                  userId: 'casey',
                  username: 'casey',
                  avatarConfig: null,
                  friendsSince: '2024-01-01T00:00:00.000Z',
                },
              ]}
              aside={<span data-testid="requests-column">column</span>}
              requests={
                <FriendRequestsEntryView
                  incomingIds={ASKERS}
                  request={(id) => <span data-testid={`asker-${id}`}>{id}</span>}
                />
              }
              onOpenFriend={() => undefined}
              onFindFriends={() => undefined}
              onRetry={() => undefined}
            />
          </TestViewportProvider>
          </ModerationProvider>
        </StaticAppRouterProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

// regression: friends-phone-hides-friend-requests
test('a phone tops the friends list with a Friend requests entry and count', () => {
  const container = renderFriends(PHONE);
  const controls = container.querySelector(
    '[data-component="CollectionControls"]'
  );
  const entry = screen.getByRole('button', { name: /Friend requests/ });
  expect(controls?.contains(entry)).toBe(true);
  expect(entry.textContent).toContain(String(ASKERS.length));
  expect(screen.queryByTestId('requests-column')).toBe(null);
  // It opens to the same askers the desktop column lists.
  expect(screen.queryByTestId('asker-quinn')).toBe(null);
  fireEvent.click(entry);
  expect(screen.getByTestId('asker-quinn')).toBeTruthy();
  expect(screen.getByTestId('asker-dana_r')).toBeTruthy();
});

test('a desktop lists them in the column instead, never twice', () => {
  renderFriends(DESKTOP);
  expect(screen.getByTestId('requests-column')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Friend requests/ })).toBe(null);
});
