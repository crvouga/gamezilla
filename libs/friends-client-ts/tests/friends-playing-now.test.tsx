/** @jsxImportSource solid-js */
/**
 * Who is playing now is told by room: each room leads with its own tile
 * (the same tile on every screen), names who of your friends is there, and
 * offers one way in. The friends list says which room under a friend's
 * name with the same tile, and its desktop column never repeats a Join.
 */
import { afterEach, expect, test } from 'bun:test';
import {
  FriendRequestRow,
  FriendRequestsAsideView,
} from '@libs/friends-client-ts/friend-requests-aside';
import { FriendsListScreenView } from '@libs/friends-client-ts/friends-list-screen-view';
import {
  FriendRoomStatusView,
  FriendsPlayingNowView,
  type PlayingRoom,
  roomsByFriend,
} from '@libs/friends-client-ts/friends-playing-now';
import type { Friend } from '@libs/friends-shared-ts/friends-types';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { FriendLiveSpaceJoinView } from '@libs/spaces-client-ts/friend-live-space';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

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

const JORDAN = friend('02', 'jordan_plays');
const ROBIN = friend('04', 'robin_42');
const SAM = friend('05', 'sam');
const MORGAN = friend('03', 'morgan');
const QUINN = friend('16', 'quinn');

/** Jordan hosts Friday chess with Robin in it; Sam hosts a room alone. */
const ROOMS: readonly PlayingRoom[] = [
  {
    spaceId: 'space-friday-chess',
    title: 'Friday chess',
    friends: [
      { friend: JORDAN, hosting: true },
      { friend: ROBIN, hosting: false },
    ],
    action: 'join',
    onJoin: () => undefined,
  },
  {
    spaceId: 'space-quick-connect-four',
    title: 'Quick connect four',
    friends: [{ friend: SAM, hosting: true }],
    action: 'join',
    onJoin: () => undefined,
  },
];

function renderWide(ui: () => JSX.Element): HTMLElement {
  const harness = createHarnessClock();
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 1440, height: 900 }}
      >
        <StaticAppRouterProvider router={router}>
          <TestViewportProvider value={{ width: 1440, height: 900 }}>
            <ModerationProvider rules={shippedModerationRules()}>
              {ui()}
            </ModerationProvider>
          </TestViewportProvider>
        </StaticAppRouterProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

function buttonsNamed(root: ParentNode, name: string): number {
  return [...root.querySelectorAll('button')].filter(
    (button) => button.textContent?.trim() === name
  ).length;
}

/** The room tiles on screen, in order. */
function roomTiles(container: HTMLElement): Element[] {
  return [...container.querySelectorAll('[data-component="MonogramTile"]')];
}

// regression: profile-playing-now-duplicate-join
test('two friends in one room offer one way into it', () => {
  const container = renderWide(() => <FriendsPlayingNowView rooms={ROOMS} />);
  expect(buttonsNamed(container, 'Join')).toBe(ROOMS.length);
});

// regression: playing-now-room-indent-mismatch
test('every room leads with a tile of one size, however many friends are in it', () => {
  const container = renderWide(() => <FriendsPlayingNowView rooms={ROOMS} />);
  const tiles = roomTiles(container);
  expect(tiles.map((tile) => tile.textContent)).toEqual(['F', 'Q']);
  // One fixed 40px tile per row, so every title starts at the same inset
  // (an avatar stack as wide as its faces used to lead instead).
  for (const tile of tiles) expect(tile.className).toContain('size-10');
});

// regression: space-identified-by-host-avatar
test('a friend in a room wears that room tile under their name, the same paint as the room row', () => {
  const live = roomsByFriend(ROOMS);
  const status = renderWide(() => (
    <Show when={live.get(ROBIN.userId)}>
      {(entry) => (
        <FriendRoomStatusView room={entry().room} hosting={entry().hosting} />
      )}
    </Show>
  ));
  const tile = status.querySelector('[data-component="MonogramTile"]');
  expect(tile?.textContent).toBe('F');
  expect(status.textContent).toContain('In Friday chess');
  cleanup();
  const panel = renderWide(() => <FriendsPlayingNowView rooms={ROOMS} />);
  const roomTile = panel.querySelector('[data-component="MonogramTile"]');
  expect(tile?.getAttribute('data-paint')).toBe(
    roomTile?.getAttribute('data-paint') ?? 'missing'
  );
});

// regression: friends-desktop-duplicate-join
test('on a desktop the friends list column carries no Join: each live friend has one, on their row', () => {
  const live = roomsByFriend(ROOMS);
  const friends = [JORDAN, SAM, ROBIN, MORGAN];
  const container = renderWide(() => (
    <FriendsListScreenView
      status="ready"
      friends={friends}
      friendStatus={(item) => (
        <Show when={live.get(item.userId)}>
          {(entry) => (
            <FriendRoomStatusView
              room={entry().room}
              hosting={entry().hosting}
            />
          )}
        </Show>
      )}
      friendTrailing={(item) =>
        live.has(item.userId) ? (
          <FriendLiveSpaceJoinView
            action="join"
            onPress={() => undefined}
            hostAccountId={item.userId}
          />
        ) : undefined
      }
      aside={
        <FriendRequestsAsideView
          incomingIds={[QUINN.userId]}
          outgoingCount={0}
          request={() => (
            <FriendRequestRow profile={QUINN} onOpen={() => undefined} />
          )}
        />
      }
      onOpenFriend={() => undefined}
      onFindFriends={() => undefined}
      onRetry={() => undefined}
    />
  ));
  const aside = container.querySelector('[data-component="CollectionAside"]');
  expect(aside?.textContent).toContain('@quinn');
  expect(buttonsNamed(aside ?? container, 'Join')).toBe(0);
  expect(buttonsNamed(container, 'Join')).toBe(live.size);
});
