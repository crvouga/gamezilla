/** @jsxImportSource solid-js */
/**
 * A desktop inbox reads as a feed: capped at the reading measure on the
 * column's edge, with each card's answers beside its words and its "…"
 * right after them; a phone stacks the answers under the words.
 */
import { afterEach, expect, mock, test } from 'bun:test';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { NotificationCardDefault } from '@libs/notifications-client-ts/notification-card-default';
import { NotificationsScreenView } from '@libs/notifications-client-ts/notifications-screen-view';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

afterEach(cleanup);

const router: AppRouter = {
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  canGoBack: () => false,
};

const STILL = {
  clock: { now: () => Date.parse('2023-11-14T22:00:00.000Z') },
  timers: {
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    setInterval: () => 0,
    clearInterval: () => undefined,
  },
};

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const CARD = 'card-request';

const REQUEST: Notification = {
  id: 'request',
  sourceNamespace: 'friends',
  sourceType: 'friend-request',
  sourceId: 'request',
  category: 'action_required',
  title: '@jordan sent you a friend request',
  createdAt: '2023-11-14T21:35:00.000Z',
  priority: 0,
  actions: [
    { id: 'accept', label: 'Accept', variant: 'solid' },
    { id: 'decline', label: 'Decline', variant: 'ghost' },
  ],
  payload: {},
  isUnread: true,
  isArchived: false,
  isDismissed: false,
  isActive: true,
};

function mount(
  size: { width: number; height: number },
  ui: () => JSX.Element
): HTMLElement {
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={STILL.clock} timers={STILL.timers}>
      <ThemeProvider colorScheme="light" fixedLayout={size}>
        <SurfaceStackProvider>
          <StaticAppRouterProvider router={router}>
            <TestViewportProvider value={size}>
              <ModerationProvider rules={shippedModerationRules()}>
                {ui()}
              </ModerationProvider>
            </TestViewportProvider>
          </StaticAppRouterProvider>
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

function card(): JSX.Element {
  const actions = {
    performAction: mock(() => Promise.resolve()),
    markRead: mock(() => Promise.resolve()),
    archive: mock((_id: string) => Promise.resolve()),
  };
  return (
    <NotificationCardDefault
      interaction={REQUEST}
      actions={actions}
      onOpen={() => undefined}
      testID={CARD}
      actionTestID={(action) => `${CARD}-${action.id}`}
    />
  );
}

/** The column holding the card's words (its `-open` target). */
function wordsColumn(): Element | null {
  return (
    screen
      .getByTestId(`${CARD}-open`)
      .parentElement?.closest('[data-component="StackVertical"]') ?? null
  );
}

// regression: notifications-desktop-rows-too-wide
test('a desktop inbox keeps to the reading measure on the column edge', () => {
  const container = mount(DESKTOP, () => (
    <NotificationsScreenView
      sections={[{ key: 'today', title: 'Today', items: [REQUEST] }]}
      isLoading={false}
      filter="all"
      failure={null}
      markingAllRead={false}
      renderCard={(item) => item.title}
      onFilterChange={() => undefined}
      onMarkAllRead={() => undefined}
    />
  ));
  const header = container.querySelector('[data-component="ScreenBaseHeader"]');
  expect((header as HTMLElement | null)?.style.maxWidth).toBe('720px');
  const body = container.querySelector('[data-component="CollectionBody"]');
  const capped = body?.closest('[style*="max-width"]') as HTMLElement | null;
  expect(capped?.style.maxWidth).toBe('720px');
});

// regression: notifications-desktop-actions-stacked
test('on a desktop a card answers beside its words, not under them', () => {
  mount(DESKTOP, card);
  const words = wordsColumn();
  const accept = screen.getByTestId(`${CARD}-accept`);
  expect(words?.contains(accept)).toBe(false);
  // The answers sit between the words and the "…", on one row.
  const row = screen.getByTestId(CARD);
  expect(row.contains(accept)).toBe(true);
  expect(row.contains(words)).toBe(true);
});

test('on a phone the answers stay stacked under the words', () => {
  mount(PHONE, card);
  const accept = screen.getByTestId(`${CARD}-accept`);
  expect(wordsColumn()?.contains(accept)).toBe(true);
});
