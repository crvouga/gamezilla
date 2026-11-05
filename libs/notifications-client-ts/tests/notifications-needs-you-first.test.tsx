/** @jsxImportSource solid-js */
/**
 * The inbox is one list on every size: what needs the person first, then
 * the Activity timeline, every heading on the edge the title and the
 * filter chips start on.
 */
import { afterEach, expect, test } from 'bun:test';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { NotificationsScreenView } from '@libs/notifications-client-ts/notifications-screen-view';
import type {
  Notification,
  NotificationSection,
} from '@libs/notifications-shared-ts/notification';
import { NEEDS_YOU_SECTION_KEY } from '@libs/notifications-shared-ts/notifications-sections';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { TestViewportProvider } from '@pkgs/ui-root-client-ts/test-viewport';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const router: AppRouter = {
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  canGoBack: () => false,
};

/** Time stands still: no card's "1h ago" ticks during a test. */
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

function notification(id: string, title: string): Notification {
  return {
    id,
    sourceNamespace: 'friends',
    sourceType: 'friend-request',
    sourceId: id,
    category: 'action_required',
    title,
    createdAt: '2023-11-14T21:00:00.000Z',
    priority: 0,
    actions: [],
    payload: {},
    isUnread: true,
    isArchived: false,
    isDismissed: false,
    isActive: true,
  };
}

const SECTIONS: readonly NotificationSection[] = [
  {
    key: NEEDS_YOU_SECTION_KEY,
    title: 'Needs you',
    items: [notification('request', '@jordan sent you a friend request')],
  },
  {
    key: 'today',
    title: 'Today',
    items: [notification('accepted', '@morgan accepted your friend request')],
  },
];

function renderInbox(size: { width: number; height: number }): HTMLElement {
  const { container } = renderWithI18n(() => (
    <ClockProvider clock={STILL.clock} timers={STILL.timers}>
      <ThemeProvider colorScheme="light" fixedLayout={size}>
        <StaticAppRouterProvider router={router}>
          <TestViewportProvider value={size}>
            <ModerationProvider rules={shippedModerationRules()}>
              <NotificationsScreenView
                sections={SECTIONS}
                isLoading={false}
                filter="all"
                failure={null}
                markingAllRead={false}
                renderCard={(item) => item.title}
                onFilterChange={() => undefined}
                onMarkAllRead={() => undefined}
              />
            </ModerationProvider>
          </TestViewportProvider>
        </StaticAppRouterProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return container;
}

/** The heading's inset from the list's own edge, as the classes give it. */
function insetsBetween(heading: HTMLElement, body: Element): string[] {
  const insets: string[] = [];
  let node: HTMLElement | null = heading;
  while (node !== null && node !== body) {
    for (const name of node.classList) {
      if (/^p[xl]-ui-/.test(name) && !name.endsWith('-none')) insets.push(name);
    }
    node = node.parentElement;
  }
  return insets;
}

// regression: notifications-needs-you-in-desktop-aside
test('on a desktop Needs you leads the list under All, with no side column', () => {
  const container = renderInbox(DESKTOP);
  expect(container.querySelector('[data-component="CollectionAside"]')).toBe(
    null
  );
  const body = container.querySelector('[data-component="CollectionBody"]');
  const needsYou = screen.getByRole('heading', { name: /Needs you/ });
  const activity = screen.getByRole('heading', { name: 'Activity' });
  expect(body?.contains(needsYou)).toBe(true);
  expect(body?.contains(activity)).toBe(true);
  // Needs you comes first, Activity under it.
  expect(
    needsYou.compareDocumentPosition(activity) &
      Node.DOCUMENT_POSITION_FOLLOWING
  ).toBeTruthy();
});

// regression: notifications-section-headings-indented
test('on a phone every heading starts on the list edge, like the title and chips', () => {
  const container = renderInbox(PHONE);
  const body = container.querySelector('[data-component="CollectionBody"]');
  expect(body).not.toBe(null);
  for (const name of [/Needs you/, 'Activity', 'Today']) {
    const heading = screen.getByRole('heading', { name });
    expect(insetsBetween(heading, body as Element)).toEqual([]);
  }
});
