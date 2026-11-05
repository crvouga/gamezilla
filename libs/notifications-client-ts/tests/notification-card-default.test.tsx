/** @jsxImportSource solid-js */
import { afterEach, expect, mock, test } from 'bun:test';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { NotificationCardDefault } from '@libs/notifications-client-ts/notification-card-default';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import type { NotificationAction } from '@libs/notifications-shared-ts/notification-action';
import { TIME_CRITICAL_PRIORITY } from '@libs/notifications-shared-ts/notifications-sections';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const NOW_MS = Date.parse('2023-11-14T22:00:00.000Z');
const CARD = 'card-invite';

/** Time stands still: the card's "1h ago" never ticks during a test. */
const STILL = {
  clock: { now: () => NOW_MS },
  timers: {
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    setInterval: () => 0,
    clearInterval: () => undefined,
  },
};

function invite(actions: readonly NotificationAction[]): Notification {
  return {
    id: 'invite-1',
    sourceNamespace: 'spaces',
    sourceType: 'space_invite',
    sourceId: 'invite-1',
    category: 'action_required',
    title: '@sam invited you to Quick connect four',
    createdAt: '2023-11-14T21:00:00.000Z',
    priority: 0,
    actions,
    payload: {},
    isUnread: true,
    isArchived: false,
    isDismissed: false,
    isActive: true,
  };
}

function mountCard(interaction: Notification) {
  const actions = {
    performAction: mock(() => Promise.resolve()),
    markRead: mock(() => Promise.resolve()),
    archive: mock((_id: string) => Promise.resolve()),
  };
  renderWithI18n(() => (
    <ClockProvider clock={STILL.clock} timers={STILL.timers}>
      <ThemeProvider colorScheme="light">
        <SurfaceStackProvider>
          <ModerationProvider rules={shippedModerationRules()}>
            <NotificationCardDefault
              interaction={interaction}
              actions={actions}
              onOpen={() => undefined}
              testID={CARD}
              actionTestID={(action) => `${CARD}-${action.id}`}
            />
          </ModerationProvider>
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return actions;
}

test("Archive waits in the card's More menu and sets the card aside", () => {
  const actions = mountCard(
    invite([{ id: 'accept', label: 'Join', variant: 'ghost' }])
  );
  expect(screen.queryByTestId(Handles.notificationsArchive(CARD))).toBeNull();
  const more = screen.getByRole('button', { name: 'More' });
  expect(more).toBe(screen.getByTestId(Handles.notificationsCardMenu(CARD)));
  fireEvent.click(more);
  const archive = screen.getByRole('menuitem', { name: 'Archive' });
  expect(archive).toBe(screen.getByTestId(Handles.notificationsArchive(CARD)));
  fireEvent.click(archive);
  expect(actions.archive).toHaveBeenCalledWith('invite-1');
});

test('an answer unavailable for a reason shows the reason, not a dead button', () => {
  mountCard(
    invite([
      {
        id: 'accept',
        label: 'Join',
        variant: 'ghost',
        disabled: true,
        disabledReason: 'Space is full',
      },
    ])
  );
  expect(screen.getByText('Space is full')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Join' })).toBeNull();
  expect(screen.queryByTestId(`${CARD}-accept`)).toBeNull();
});

test('an available answer stays a button beside the card words', () => {
  mountCard(invite([{ id: 'accept', label: 'Join', variant: 'ghost' }]));
  expect(screen.getByTestId(`${CARD}-accept`).textContent).toContain('Join');
});

test('a card whose every answer is unavailable is plainly inactive', () => {
  mountCard(
    invite([
      {
        id: 'accept',
        label: 'Join',
        variant: 'ghost',
        disabled: true,
        disabledReason: 'Space is full',
      },
    ])
  );
  const reason = screen
    .getByText('Space is full')
    .closest('[data-component="Badge"]');
  expect(reason?.getAttribute('data-intent')).toBe('neutral');
  // Unread, but nothing waits: the words lose their unread weight.
  const title = screen.getByText('@sam invited you to Quick connect four');
  expect(title.className).not.toContain('textBodyBold');
  expect(title.className).toContain('text-text-secondary');
});

test('a card that waits on you without answers says its next step', () => {
  const opened = mock(() => undefined);
  renderWithI18n(() => (
    <ClockProvider clock={STILL.clock} timers={STILL.timers}>
      <ThemeProvider colorScheme="light">
        <SurfaceStackProvider>
          <ModerationProvider rules={shippedModerationRules()}>
            <NotificationCardDefault
              interaction={invite([])}
              actions={{
                performAction: () => Promise.resolve(),
                markRead: () => Promise.resolve(),
                archive: () => Promise.resolve(),
              }}
              onOpen={opened}
              testID={CARD}
            />
          </ModerationProvider>
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  fireEvent.click(screen.getByRole('button', { name: 'Open' }));
  expect(opened).toHaveBeenCalledTimes(1);
  // The words still open it by the card's own id.
  expect(screen.getByTestId(CARD).textContent).toContain('@sam invited you');
});

test('an informational card offers no open step, only its More menu', () => {
  mountCard({ ...invite([]), category: 'informational' });
  expect(screen.queryByRole('button', { name: 'Open' })).toBeNull();
  expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
});

// regression: inbox-unread-only-a-heavier-title
test('an unread card leads with a named unread dot; a read card has none', () => {
  mountCard(invite([{ id: 'accept', label: 'Join', variant: 'ghost' }]));
  const dot = screen.getByRole('img', { name: 'Unread' });
  expect(dot.getAttribute('data-status')).toBe('unread');
  cleanup();
  mountCard({
    ...invite([{ id: 'accept', label: 'Join', variant: 'ghost' }]),
    isUnread: false,
  });
  expect(screen.queryByRole('img', { name: 'Unread' })).toBeNull();
});

// regression: inbox-card-stacked-metadata
test('when and what share one caption line', () => {
  mountCard({ ...invite([]), subtitle: 'Space invite' });
  expect(screen.getByText('1h ago · Space invite')).toBeTruthy();
});

// regression: inbox-archive-full-weight-text
test('the card menu is a quiet icon with no visible word', () => {
  mountCard(invite([{ id: 'accept', label: 'Join', variant: 'ghost' }]));
  const more = screen.getByRole('button', { name: 'More' });
  expect(more.getAttribute('data-component')).toBe('IconButton');
  expect(more.textContent ?? '').not.toContain('More');
  expect(screen.queryByText('Archive')).toBeNull();
});

// regression: inbox-archive-icon-on-every-card
test('Archive is not a control on the card face; it waits in the menu', () => {
  mountCard(invite([{ id: 'accept', label: 'Join', variant: 'ghost' }]));
  expect(screen.queryByRole('button', { name: 'Archive' })).toBeNull();
  expect(screen.queryByTestId(Handles.notificationsArchive(CARD))).toBeNull();
  expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
});

// regression: notifications-update-dismiss-solid
test("an update's only choice stays outlined; a card that waits on you keeps its solid answer", () => {
  mountCard({
    ...invite([{ id: 'dismiss', label: 'Dismiss', variant: 'ghost' }]),
    category: 'informational',
    title: 'You won your daily game against @jordan_plays',
  });
  const dismiss = screen.getByTestId(`${CARD}-dismiss`);
  expect(dismiss.getAttribute('data-face')).toBe('neutral-outline');
  cleanup();
  mountCard(invite([{ id: 'accept', label: 'Accept', variant: 'solid' }]));
  expect(screen.getByTestId(`${CARD}-accept`).getAttribute('data-face')).toBe(
    'primary'
  );
});

// regression: notification-unread-dot-shifts-title
test('read and unread titles start at the same x: the dot lives in a fixed gutter', () => {
  for (const isUnread of [true, false]) {
    mountCard({ ...invite([]), isUnread });
    const title = screen.getByText(/invited you to Quick connect four/);
    // The title itself never carries the dot.
    expect(title.querySelector('[data-component="StatusDot"]')).toBeNull();
    // The gutter always holds one dot, visible only while unread (one card
    // is mounted, so the document holds just its dots).
    const dots = document.querySelectorAll('[data-component="StatusDot"]');
    expect(dots).toHaveLength(1);
    expect(dots[0]?.getAttribute('aria-hidden') === 'true').toBe(!isUnread);
    cleanup();
  }
});

function turn(priority: number, body: string): Notification {
  return {
    ...invite([]),
    id: `turn-${priority}`,
    sourceNamespace: 'game-session',
    sourceType: 'multiplayer-turn',
    title: "You're low on time in your daily game against @sam",
    body,
    priority,
  };
}

// regression: inbox-low-on-time-turn-ranks-late — a turn with 3 hours left
// looked like every routine card, its time left in the quiet caption ink.
// A notice whose time is running out shows that time with a clock in the
// warning ink; a plain turn keeps the quiet caption.
test('a turn running out of time says so in the warning ink', () => {
  mountCard(
    turn(
      TIME_CRITICAL_PRIORITY,
      "It's your turn. You have 3 hours left to move."
    )
  );
  const urgent = document.querySelector('[data-inbox-urgency="time-critical"]');
  expect(urgent?.textContent).toContain('3 hours left');
  cleanup();
  mountCard(turn(10, "It's your turn."));
  expect(document.querySelector('[data-inbox-urgency]')).toBeNull();
  expect(screen.getByText("It's your turn.")).toBeTruthy();
});
