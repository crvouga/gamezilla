import { afterEach, expect, test } from 'bun:test';
import { FriendActionPillsForStatus } from '@libs/friends-client-ts/friend-action-pills-by-status';
import type { FriendshipStatus } from '@libs/friends-shared-ts/friends-types';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const USERNAME = 'jordy';
const done = (): Promise<void> => Promise.resolve();

function renderPills(status: FriendshipStatus, compact: boolean): void {
  const harness = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider colorScheme="light">
        <FriendActionPillsForStatus
          status={status}
          mutations={{
            addFriend: done,
            confirmRequest: done,
            deleteRequest: done,
            cancelRequest: done,
            unblock: done,
          }}
          addFailureCode={() => null}
          username={USERNAME}
          compact={compact}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
}

test('a row with a request out ends in Cancel request, the same small pill as Add friend', () => {
  renderPills('pending_outgoing', true);
  const cancel = screen.getByTestId(Handles.friendCancel(USERNAME));
  // A bare "Cancel" reads as dismissing the screen, not the request.
  expect(cancel.textContent).toContain('Cancel request');
  expect(cancel.getAttribute('data-size')).toBe('sm');
  expect(cancel.getAttribute('data-face')).toBe('neutral-outline');
  expect(screen.getAllByRole('button')).toHaveLength(1);
});

test('on a profile a request that is out says Request sent over Cancel request', () => {
  renderPills('pending_outgoing', false);
  expect(screen.getByText('Request sent')).toBeTruthy();
  const cancel = screen.getByTestId(Handles.friendCancel(USERNAME));
  expect(cancel.textContent).toContain('Cancel request');
});

test('a row ends in the small secondary pill for its main action', () => {
  renderPills('none', true);
  const add = screen.getByTestId(Handles.friendAdd(USERNAME));
  expect(add.textContent).toContain('Add friend');
  expect(add.getAttribute('data-size')).toBe('sm');
  expect(add.getAttribute('data-face')).toBe('neutral-outline');
});

test('on a profile the main action keeps its full-size solid pill', () => {
  renderPills('none', false);
  const add = screen.getByTestId(Handles.friendAdd(USERNAME));
  expect(add.getAttribute('data-size')).toBe('md');
  expect(add.getAttribute('data-face')).toBe('primary');
});
