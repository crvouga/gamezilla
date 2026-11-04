/** @jsxImportSource solid-js */
/**
 * A friends-list row ends in one thing: Join while the friend is in a live
 * space, otherwise the chevron that says the row opens them.
 */
import { afterEach, expect, test } from 'bun:test';
import { FriendsListScreenView } from '@libs/friends-client-ts/friends-list-screen-view';
import type { Friend } from '@libs/friends-shared-ts/friends-types';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import {
  FriendLiveSpaceJoinView,
  FriendLiveSpaceStatusView,
} from '@libs/spaces-client-ts/friend-live-space';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';

afterEach(cleanup);

const router: AppRouter = {
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  canGoBack: () => false,
};

function friend(suffix: string, username: string): Friend {
  return {
    userId: `5a1e0000-0000-4000-8000-0000000000${suffix}`,
    username,
    avatarConfig: null,
    friendsSince: '2026-01-01T00:00:00.000Z',
  };
}

const HOSTING = friend('02', 'jordan_plays');
const IDLE = friend('03', 'morgan');

function renderList(): HTMLElement {
  const harness = createHarnessClock();
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <StaticAppRouterProvider router={router}>
          <TestViewportProvider value={{ width: 390, height: 844 }}>
            <ModerationProvider rules={shippedModerationRules()}>
              <FriendsListScreenView
                status="ready"
                friends={[HOSTING, IDLE]}
                friendStatus={(item) =>
                  item === HOSTING ? (
                    <FriendLiveSpaceStatusView hosting />
                  ) : undefined
                }
                friendTrailing={(item) =>
                  item === HOSTING ? (
                    <FriendLiveSpaceJoinView
                      action="join"
                      onPress={() => undefined}
                      hostAccountId={item.userId}
                    />
                  ) : undefined
                }
                onOpenFriend={() => undefined}
                onFindFriends={() => undefined}
                onRetry={() => undefined}
              />
            </ModerationProvider>
          </TestViewportProvider>
        </StaticAppRouterProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

/** The row's end: what sits beside the pressable face and name. */
function rowEnd(container: HTMLElement, username: string) {
  const press = container.querySelector(
    `[data-testid="${Handles.friendsListRow(username)}"]`
  );
  const row = press?.parentElement;
  if (row === null || row === undefined) throw new Error(`no row ${username}`);
  const outside = (el: Element): boolean => !press?.contains(el);
  return {
    buttons: [...row.querySelectorAll('button')].filter(outside).length,
    icons: [...row.querySelectorAll('[data-component="Icon"]')].filter(outside)
      .length,
  };
}

// regression: friends-row-join-beside-chevron
test('a friend in a live space ends in Join alone, with no chevron beside it', () => {
  const container = renderList();
  expect(rowEnd(container, HOSTING.username)).toEqual({ buttons: 1, icons: 0 });
});

test('a friend with nothing to join ends in the chevron', () => {
  const container = renderList();
  expect(rowEnd(container, IDLE.username)).toEqual({ buttons: 0, icons: 1 });
});

// regression: friends-row-bare-name-tall
test('a row with only a name keeps a compact face, not one sized for two lines', () => {
  const container = renderList();
  const face = container
    .querySelector(`[data-testid="${Handles.friendsListRow(IDLE.username)}"]`)
    ?.querySelector<HTMLElement>('[data-component="Avatar"]');
  expect(face?.style.width).toBe('40px');
});
