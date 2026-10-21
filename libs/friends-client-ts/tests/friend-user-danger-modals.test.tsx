import { afterEach, expect, test } from 'bun:test';
import { FriendUserDangerModals } from '@libs/friends-client-ts/friend-user-danger-modals';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen, waitFor } from '@solidjs/testing-library';

afterEach(cleanup);

const USERNAME = 'alex';

function renderModals(input: {
  readonly removeOpen: boolean;
  readonly blockOpen: boolean;
  readonly onRemove: () => Promise<void>;
  readonly onBlock: () => Promise<void>;
  readonly onClose: () => void;
}): void {
  const harness = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <SurfaceStackProvider>
          <FriendUserDangerModals
            username={USERNAME}
            removeOpen={input.removeOpen}
            blockOpen={input.blockOpen}
            onCloseRemove={input.onClose}
            onCloseBlock={input.onClose}
            onRemove={input.onRemove}
            onBlock={input.onBlock}
          />
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}

test('a failed remove shows a retryable error and keeps the confirmation open', async () => {
  // regression: friend-remove-block-silent-failure
  let attempts = 0;
  let closes = 0;
  renderModals({
    removeOpen: true,
    blockOpen: false,
    onRemove: async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('network down');
    },
    onBlock: async () => {},
    onClose: () => {
      closes += 1;
    },
  });
  const confirm = screen.getByTestId(Handles.friendRemoveConfirm(USERNAME));
  fireEvent.click(confirm);
  expect(
    await screen.findByText('This friend could not be removed. Try again.')
  ).toBeInTheDocument();
  expect(screen.getByTestId(Handles.friendRemoveConfirm(USERNAME))).toBe(
    confirm
  );
  expect(confirm).not.toBeDisabled();
  expect(closes).toBe(0);

  fireEvent.click(confirm);
  await waitFor(() => expect(attempts).toBe(2));
  await waitFor(() =>
    expect(
      screen.queryByText('This friend could not be removed. Try again.')
    ).toBeNull()
  );
});

test('a failed block shows a retryable error and keeps the confirmation open', async () => {
  // regression: friend-remove-block-silent-failure
  let attempts = 0;
  let closes = 0;
  renderModals({
    removeOpen: false,
    blockOpen: true,
    onRemove: async () => {},
    onBlock: async () => {
      attempts += 1;
      throw new Error('network down');
    },
    onClose: () => {
      closes += 1;
    },
  });
  const confirm = screen.getByTestId(Handles.friendBlockConfirm(USERNAME));
  fireEvent.click(confirm);
  expect(
    await screen.findByText('This user could not be blocked. Try again.')
  ).toBeInTheDocument();
  expect(confirm).not.toBeDisabled();
  expect(closes).toBe(0);

  fireEvent.click(confirm);
  await waitFor(() => expect(attempts).toBe(2));
  expect(
    await screen.findByText('This user could not be blocked. Try again.')
  ).toBeInTheDocument();
});
