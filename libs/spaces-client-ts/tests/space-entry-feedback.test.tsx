import { afterEach, expect, test } from 'bun:test';
import type {
  SpaceJoinConnection,
  SpaceJoinStatus,
} from '@libs/spaces-client-ts/space-join-screen-view';
import { SpaceJoinScreenView } from '@libs/spaces-client-ts/space-join-screen-view';
import { JOINED_SPACE } from '@libs/spaces-client-ts/spaces-story.example';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { createSignal, flush } from 'solid-js';

afterEach(cleanup);

function mount(child: () => JSX.Element, width = 390) {
  const time = createHarnessClock();
  return renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider colorScheme="light" fixedLayout={{ width, height: 844 }}>
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
  joinPending?: boolean;
}) {
  return (
    <SpaceJoinScreenView
      title={JOINED_SPACE.title}
      status={props.status}
      connection={props.connection}
      needsConnection={props.needsConnection}
      space={JOINED_SPACE}
      canLeave={false}
      joinPending={props.joinPending === true}
      joinDisabled={false}
      onJoin={() => Promise.resolve()}
      onLeave={() => undefined}
      onBackToSpaces={() => undefined}
      onRetry={() => Promise.resolve()}
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
  flush();
  expect(screen.queryByText('Checking the host’s connection…')).toBeNull();
  expect(screen.getByTestId(Handles.spaceJoin)).toBeTruthy();
});

// regression: space-offline-notice-duplicated
test('an offline invitation explains the connection requirement once', () => {
  const view = mount(() => (
    <Join status="offline" connection="offline" needsConnection />
  ));
  // Said once, as the screen's own state with the way back, never a
  // banner over an empty page.
  expect(
    view.container.querySelectorAll('[data-testid="spaces-need-connection"]')
  ).toHaveLength(1);
  expect(
    view.container.querySelectorAll('[data-component="Notice"]')
  ).toHaveLength(0);
  expect(view.container.textContent).toContain('Back to Spaces');
});

// regression: space-recovery-title-on-another-axis
test('a join that cannot go on heads its centred message with the screen title, once', () => {
  const states: readonly SpaceJoinStatus[] = [
    'loading',
    'unavailable',
    'missing',
    'offline',
  ];
  for (const width of [390, 1280]) {
    for (const status of states) {
      const view = mount(
        () => (
          <Join status={status} connection="offline" needsConnection={false} />
        ),
        width
      );
      const headings = view.container.querySelectorAll('h1');
      expect(headings).toHaveLength(1);
      const heading = headings[0];
      expect(
        heading?.closest('[data-component="SpaceRecoveryState"]')
      ).not.toBeNull();
      const title = heading?.textContent ?? '';
      expect(view.container.textContent?.split(title)).toHaveLength(2);
      cleanup();
    }
  }
});

// regression: space-unconfirmed-join-inline
test('an unanswered join floats beside the check action and clears when confirmed', () => {
  const [pending, setPending] = createSignal(true);
  mount(() => (
    <Join
      status="live"
      connection="ready"
      needsConnection={false}
      joinPending={pending()}
    />
  ));
  const notice = screen.getByTestId(Handles.spaceJoinNotConfirmed);
  expect(notice.closest('[data-component="ToastStack"]')).not.toBeNull();
  expect(screen.getByTestId(Handles.spaceJoin).textContent).toContain(
    "Check if I'm in"
  );
  setPending(false);
  flush();
  expect(screen.queryByTestId(Handles.spaceJoinNotConfirmed)).toBeNull();
});
