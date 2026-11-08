import { afterEach, expect, test } from 'bun:test';
import { AcceptDeclinePills } from '@libs/friends-client-ts/friend-action-pill-buttons';
import { FriendRequestDecisionModal } from '@libs/friends-client-ts/friend-request-decision-modal';
import { ModerationProvider } from '@libs/moderation-client-ts/moderation-context';
import { shippedModerationRules } from '@libs/moderation-shared-ts/moderation-rules';
import type { Notification } from '@libs/notifications-shared-ts/notification';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen, waitFor } from '@solidjs/testing-library';

afterEach(cleanup);
const REQUEST: Notification = {
  id: 'request-alex',
  sourceNamespace: 'friends',
  sourceType: 'friend-request',
  sourceId: 'alex',
  category: 'action_required',
  title: 'Alex sent a friend request',
  createdAt: '2026-01-01T00:00:00.000Z',
  priority: 0,
  actions: [
    { id: 'accept', label: 'Accept', variant: 'solid' },
    { id: 'decline', label: 'Decline', variant: 'ghost' },
  ],
  payload: {},
  deepLink: { path: '/profile/user/alex' },
  isUnread: true,
  isArchived: false,
  isDismissed: false,
  isActive: true,
};
const router = {
  push: () => {},
  replace: () => {},
  back: () => {},
  canGoBack: () => false,
};
function renderAnswers(
  kind: 'pills' | 'modal',
  perform: (answer: string) => Promise<void>
) {
  let closes = 0;
  let navigations = 0;
  const trackedRouter = {
    ...router,
    push: () => {
      navigations += 1;
    },
  };
  const harness = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <StaticAppRouterProvider router={trackedRouter}>
          <ModerationProvider rules={shippedModerationRules()}>
            <SurfaceStackProvider>
              {kind === 'pills' ? (
                <AcceptDeclinePills
                  onAccept={() => perform('accept')}
                  onDecline={() => perform('decline')}
                />
              ) : (
                <FriendRequestDecisionModal
                  visible
                  interaction={REQUEST}
                  actions={{
                    performAction: (_id, action) => perform(action),
                    markRead: async () => {},
                    archive: async () => {},
                  }}
                  onClose={() => {
                    closes += 1;
                  }}
                />
              )}
            </SurfaceStackProvider>
          </ModerationProvider>
        </StaticAppRouterProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  return { closes: () => closes, navigations: () => navigations };
}

for (const kind of ['pills', 'modal'] as const) {
  for (const first of ['Accept', 'Decline'] as const) {
    // regression: friend-request-conflicting-answers
    test(`${kind}: ${first} excludes the opposite answer until failure, then allows another choice`, async () => {
      const pending = Promise.withResolvers<void>();
      const calls: string[] = [];
      renderAnswers(kind, async (answer) => {
        calls.push(answer);
        await pending.promise;
      });
      const opposite = first === 'Accept' ? 'Decline' : 'Accept';
      fireEvent.click(screen.getByRole('button', { name: first }));
      const other = screen.getByRole('button', { name: opposite });
      expect(other).toBeDisabled();
      fireEvent.click(other);
      expect(calls).toEqual([first.toLowerCase()]);
      pending.reject(new Error('Connection unavailable'));
      await waitFor(() => expect(other).not.toBeDisabled());
      fireEvent.click(other);
      expect(calls).toEqual([first.toLowerCase(), opposite.toLowerCase()]);
    });
  }
}

for (const answer of ['Accept', 'Decline']) {
  test(`modal: ${answer} prevents leaving for a second decision while pending`, async () => {
    // regression: friend-request-pending-navigation
    const pending = Promise.withResolvers<void>();
    const probe = renderAnswers('modal', () => pending.promise);
    fireEvent.click(screen.getByRole('button', { name: answer }));
    const viewProfile = screen.getByRole('button', { name: 'View profile' });
    expect(viewProfile).toBeDisabled();
    fireEvent.click(viewProfile);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(probe.navigations()).toBe(0);
    expect(probe.closes()).toBe(0);
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    pending.reject(new Error('Connection unavailable'));
    await waitFor(() => expect(viewProfile).not.toBeDisabled());
    fireEvent.click(viewProfile);
    expect(probe.navigations()).toBe(1);
    expect(probe.closes()).toBe(1);
  });
}
