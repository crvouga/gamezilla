import { afterEach, expect, test } from 'bun:test';
import { SpaceGamesScreenView } from '@libs/spaces-client-ts/space-games-screen-view';
import type {
  SpaceJoinConnection,
  SpaceJoinStatus,
} from '@libs/spaces-client-ts/space-join-screen-view';
import { SpaceJoinScreenView } from '@libs/spaces-client-ts/space-join-screen-view';
import {
  GAMES,
  JOINED_SPACE,
} from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';

afterEach(cleanup);

function mount(child: () => JSX.Element) {
  const time = createHarnessClock();
  return renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <StaticAppRouterProvider
          router={{
            push: () => undefined,
            replace: () => undefined,
            back: () => undefined,
            canGoBack: () => false,
          }}
        >
          {child()}
        </StaticAppRouterProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}

function Join(props: {
  status: SpaceJoinStatus;
  connection: SpaceJoinConnection;
  needsConnection: boolean;
}) {
  return (
    <SpaceJoinScreenView
      title={JOINED_SPACE.title}
      status={props.status}
      connection={props.connection}
      needsConnection={props.needsConnection}
      space={JOINED_SPACE}
      canLeave={false}
      joinPending={false}
      joinDisabled={false}
      onJoin={() => Promise.resolve()}
      onLeave={() => undefined}
      onBackToSpaces={() => undefined}
    />
  );
}

// regression: space-host-check-has-no-feedback
test('checking a host explains the wait, then offers Join when ready', () => {
  const [connection, setConnection] =
    createSignal<SpaceJoinConnection>('loading');
  mount(() => (
    <Join status="live" connection={connection()} needsConnection={false} />
  ));
  expect(screen.getByText('Checking the host’s connection…')).toBeTruthy();
  expect(
    screen.queryByText('Join to see who is here and hang out.')
  ).toBeNull();
  expect(screen.queryByTestId(Handles.spaceJoin)).toBeNull();
  setConnection('ready');
  expect(screen.queryByText('Checking the host’s connection…')).toBeNull();
  expect(screen.getByTestId(Handles.spaceJoin)).toBeTruthy();
});

// regression: space-offline-notice-duplicated
test('an offline invitation explains the connection requirement once', () => {
  const view = mount(() => (
    <Join status="offline" connection="offline" needsConnection />
  ));
  expect(
    view.container.querySelectorAll('[data-component="Notice"]')
  ).toHaveLength(1);
});

// regression: space-guest-invited-to-pick-game
test('a guest is told to wait for the host, without a contradictory choice prompt', () => {
  for (const present of [1, 5]) {
    mount(() => (
      <SpaceGamesScreenView
        games={GAMES}
        shownGame={null}
        canSelectGame={false}
        present={present}
        hostChoosesNotice={false}
        onSelectGame={() => undefined}
      />
    ));
    expect(
      screen.getByText('The host picks the game for this space.')
    ).toBeTruthy();
    expect(screen.queryByText('Pick a game to play.')).toBeNull();
    expect(screen.queryByText(/Choose a game, then its players/)).toBeNull();
    cleanup();
  }
});
