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
  expect(
    screen.getByTestId(Handles.friendRemoveConfirm(USERNAME))
  ).not.toBeDisabled();
  expect(closes).toBe(0);

  fireEvent.click(screen.getByTestId(Handles.friendRemoveConfirm(USERNAME)));
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
  expect(
    screen.getByTestId(Handles.friendBlockConfirm(USERNAME))
  ).not.toBeDisabled();
  expect(closes).toBe(0);

  fireEvent.click(screen.getByTestId(Handles.friendBlockConfirm(USERNAME)));
  await waitFor(() => expect(attempts).toBe(2));
  expect(
    await screen.findByText('This user could not be blocked. Try again.')
  ).toBeInTheDocument();
});

for (const kind of ['remove', 'block'] as const) {
  test(`${kind} shows progress and success until explicitly dismissed`, async () => {
    // regression: friend-danger-success-navigates-away
    // regression: friend-danger-harness-vacuous-success
    let finish: (() => void) | undefined;
    let calls = 0;
    let closes = 0;
    const operation = () => {
      calls += 1;
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    };
    renderModals({
      removeOpen: kind === 'remove',
      blockOpen: kind === 'block',
      onRemove: operation,
      onBlock: operation,
      onClose: () => {
        closes += 1;
      },
    });
    const id =
      kind === 'remove'
        ? Handles.friendRemoveConfirm(USERNAME)
        : Handles.friendBlockConfirm(USERNAME);
    fireEvent.click(screen.getByTestId(id));
    expect(
      await screen.findByText(
        kind === 'remove' ? 'Removing friend…' : 'Blocking user…'
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId(id)).toBeNull();
    expect(calls).toBe(1);
    expect(closes).toBe(0);
    finish?.();
    expect(
      await screen.findByText(
        kind === 'remove' ? 'Friend removed' : 'User blocked'
      )
    ).toBeInTheDocument();
    expect(closes).toBe(0);
    const successId =
      kind === 'remove'
        ? Handles.friendRemoveSuccess(USERNAME)
        : Handles.friendBlockSuccess(USERNAME);
    const doneId =
      kind === 'remove'
        ? Handles.friendRemoveDone(USERNAME)
        : Handles.friendBlockDone(USERNAME);
    expect(screen.getByTestId(successId)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId(doneId));
    expect(closes).toBe(1);
  });
}
