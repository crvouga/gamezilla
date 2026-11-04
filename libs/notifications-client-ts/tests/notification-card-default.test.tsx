/** @jsxImportSource solid-js */
import { afterEach, expect, mock, test } from 'bun:test';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import { NotificationCardDefault } from '@libs/notifications-client-ts/notification-card-default';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import type { NotificationAction } from '@libs/notifications-shared-ts/notification-action';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
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
        <ModerationProvider rules={shippedModerationRules()}>
          <NotificationCardDefault
            interaction={interaction}
            actions={actions}
            onOpen={() => undefined}
            testID={CARD}
            actionTestID={(action) => `${CARD}-${action.id}`}
          />
        </ModerationProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return actions;
}

test('Archive is one named button that sets the card aside', () => {
  const actions = mountCard(
    invite([{ id: 'accept', label: 'Join', variant: 'ghost' }])
  );
  const archive = screen.getByRole('button', { name: 'Archive' });
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
