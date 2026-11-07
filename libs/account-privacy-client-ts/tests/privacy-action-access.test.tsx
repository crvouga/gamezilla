/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { ExportChoice } from '@libs/account-privacy-client-ts/export-choice';
import type { PrivacyActionAccess } from '@libs/account-privacy-client-ts/privacy-action-access';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { KeyRoundIcon } from '@pkgs/ui-root-client-ts/icons';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal, type JSX } from 'solid-js';

afterEach(cleanup);
const allowed: PrivacyActionAccess = { kind: 'allowed' };
const denied = {
  kind: 'denied',
  denial: {
    icon: KeyRoundIcon,
    title: 'Prove the account again to continue',
    dataSet: { testid: 'privacy-export-access' },
    action: { label: 'Sign in', onPress: () => undefined },
  },
} satisfies PrivacyActionAccess;
function mount(ui: () => JSX.Element) {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <OverlayPortalProvider>
          <SurfaceStackProvider>{ui()}</SurfaceStackProvider>
        </OverlayPortalProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}
const done = async () => undefined;

// regression: privacy-current-access-obsolete-actions
test('an idle export uses its current permission and recovers when permission changes', () => {
  const [access, setAccess] = createSignal<PrivacyActionAccess>(denied);
  let requests = 0;
  mount(() => (
    <ExportChoice
      access={access()}
      row={null}
      phase="none"
      replacing={false}
      onRequest={async () => {
        requests += 1;
      }}
      onReviewReplace={() => undefined}
      onCancelReplace={() => undefined}
    />
  ));
  expect(screen.queryByTestId('privacy-export-request')).toBeNull();
  expect(screen.getByTestId('privacy-export-access').textContent).toContain(
    'Prove the account again'
  );
  expect(requests).toBe(0);
  setAccess(allowed);
  expect(screen.queryByTestId('privacy-export-access')).toBeNull();
  fireEvent.click(screen.getByTestId('privacy-export-request'));
  expect(requests).toBe(1);
});

// regression: privacy-current-access-obsolete-actions
test('permission changing during a request retains its failure and retry outcome', async () => {
  const [access, setAccess] = createSignal<PrivacyActionAccess>(allowed);
  let rejectRequest: ((reason: Error) => void) | undefined;
  let requests = 0;
  mount(() => (
    <ExportChoice
      access={access()}
      row={null}
      phase="none"
      replacing={false}
      onRequest={() => {
        requests += 1;
        return new Promise<void>((_resolve, reject) => {
          rejectRequest = reject;
        });
      }}
      onReviewReplace={() => undefined}
      onCancelReplace={() => undefined}
    />
  ));
  fireEvent.click(screen.getByTestId('privacy-export-request'));
  setAccess(denied);
  expect(screen.getByTestId('privacy-export-request')).toBeDefined();
  rejectRequest?.(
    new Error('The request was refused. Sign in, then try again.')
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
  );
  expect(screen.getByTestId('privacy-export-access')).toBeDefined();
  expect(requests).toBe(1);
});

// regression: privacy-current-access-obsolete-actions
test('an existing replacement confirmation stays mounted when live access changes', async () => {
  const [access, setAccess] = createSignal<PrivacyActionAccess>(allowed);
  let requests = 0;
  mount(() => (
    <ExportChoice
      access={access()}
      row={null}
      phase="readyToReplace"
      replacing={true}
      onRequest={async () => {
        requests += 1;
      }}
      onReviewReplace={() => undefined}
      onCancelReplace={() => undefined}
    />
  ));
  setAccess(denied);
  expect(screen.getByRole('dialog').textContent).toContain(
    'Replace your ready export?'
  );
  expect(screen.queryByTestId('privacy-export-request')).toBeNull();
  fireEvent.click(screen.getByTestId('privacy-export-replace-confirm'));
  await waitFor(() =>
    expect(screen.getByRole('dialog').textContent).toContain(
      'New export requested'
    )
  );
  expect(requests).toBe(1);
});

// regression: privacy-current-access-obsolete-actions
test('a live denial does not erase an earlier refusal notice or preparing export status', () => {
  mount(() => (
    <ExportChoice
      access={denied}
      row={null}
      phase="preparing"
      replacing={false}
      denial={{
        ...denied.denial,
        title: 'Earlier request was refused',
        dataSet: { testid: 'earlier-refusal' },
      }}
      onRequest={done}
      onReviewReplace={() => undefined}
      onCancelReplace={() => undefined}
    />
  ));
  expect(screen.getByTestId('earlier-refusal').textContent).toContain(
    'Earlier request was refused'
  );
  expect(screen.getByTestId('privacy-export-preparing').textContent).toContain(
    'being prepared'
  );
  expect(screen.getByTestId('privacy-export-access')).toBeDefined();
});
