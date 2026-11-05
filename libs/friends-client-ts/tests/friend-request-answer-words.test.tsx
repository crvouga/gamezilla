/** @jsxImportSource solid-js */
/**
 * A friend request is answered with the same two words everywhere: Accept
 * and Decline, as the inbox and the request modal say them.
 */
import { afterEach, expect, test } from 'bun:test';
import { AcceptDeclinePills } from '@libs/friends-client-ts/friend-action-pill-buttons';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

// regression: friend-request-answer-words-differ
test('a request row answers with Accept and Decline, never Confirm or Delete', () => {
  const harness = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <AcceptDeclinePills
          compact
          onAccept={() => Promise.resolve()}
          onDecline={() => Promise.resolve()}
          acceptTestID="accept"
          declineTestID="decline"
        />
      </ThemeProvider>
    </ClockProvider>
  ));
  expect(screen.getByTestId('accept').textContent).toContain('Accept');
  expect(screen.getByTestId('decline').textContent).toContain('Decline');
  expect(screen.queryByText('Confirm')).toBeNull();
  expect(screen.queryByText('Delete')).toBeNull();
});
