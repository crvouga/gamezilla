/** @jsxImportSource solid-js */
/**
 * A desktop inbox reads as a feed across the content column, with each
 * card's answers beside its words and its "…" right after them; a phone
 * stacks the answers under the words, with when the card came on their row.
 */
import { afterEach, expect, mock, test } from 'bun:test';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { NotificationCardDefault } from '@libs/notifications-client-ts/notification-card-default';
import { NotificationsScreenView } from '@libs/notifications-client-ts/notifications-screen-view';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import { Handles } from '@libs/test-ids-shared-ts/handles';
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

// regression: notifications-desktop-rows-too-wide — the inbox once spread
// a card's words and its "…" 500px apart; the answers and "…" now sit
// together at the row's end (see the next test).
// regression: notifications-column-stops-short — held to a 720px reading
// measure, the inbox stopped at x=1080 while every other page runs to the
// content column's end. It takes the column every collection does, from
// the breadcrumb's edge, header included.
test('a desktop inbox takes the content column every page has', () => {
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
  expect(header).not.toBeNull();
  expect((header as HTMLElement).style.maxWidth).toBe('');
  const body = container.querySelector('[data-component="CollectionBody"]');
  expect(body).not.toBeNull();
  expect(body?.closest('[style*="max-width"]')).toBeNull();
  // Nothing centres it apart from the breadcrumb's edge either.
  expect(body?.closest('[style*="margin"]')).toBeNull();
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

// regression: inbox-phone-rows-tall — on a phone four cards that need the
// person filled the whole view (title, a caption line for the time, the
// answers on a row of their own), pushing Activity under the fold. A card
// with answers carries its time at the end of their row, one line fewer.
test('on a phone a card with answers says when it came on their row', () => {
  mount(PHONE, card);
  const metas = screen.getAllByTestId('notification-card-meta');
  expect(metas).toHaveLength(1);
  const meta = metas[0] as HTMLElement;
  expect(meta.textContent).toBe('25m ago');
  const accept = screen.getByTestId(`${CARD}-accept`);
  const row = accept.closest('[data-component="StackHorizontal"]');
  expect(row?.contains(meta)).toBe(true);
  // The words keep only the title.
  expect(screen.getByTestId(`${CARD}-open`).contains(meta)).toBe(false);
  // The "…" shares the title's row, so the answers' row runs under both
  // instead of beside the menu's column (Accept, Decline and the time fit).
  const menu = screen.getByTestId(Handles.notificationsCardMenu(CARD));
  const titleRow = screen.getByTestId(`${CARD}-open`).parentElement;
  expect(titleRow?.contains(menu)).toBe(true);
  expect(titleRow?.contains(accept)).toBe(false);
  expect(row?.parentElement?.contains(menu)).toBe(true);
});

test('a desktop card and a phone card with no answers keep the time under the title', () => {
  mount(DESKTOP, card);
  const meta = screen.getByTestId('notification-card-meta');
  expect(screen.getByTestId(`${CARD}-open`).contains(meta)).toBe(true);
  cleanup();
  mount(PHONE, () => (
    <NotificationCardDefault
      interaction={{ ...REQUEST, category: 'informational', actions: [] }}
      actions={{
        performAction: mock(() => Promise.resolve()),
        markRead: mock(() => Promise.resolve()),
        archive: mock((_id: string) => Promise.resolve()),
      }}
      onOpen={() => undefined}
      testID={CARD}
    />
  ));
  expect(
    screen.getByTestId(CARD).contains(screen.getByTestId('notification-card-meta'))
  ).toBe(true);
});
