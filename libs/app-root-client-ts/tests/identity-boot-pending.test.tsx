import { expect, test } from 'bun:test';
import {
  IDENTITY_BOOT_DEADLINE_MS,
  IdentityBootPending,
} from '@libs/app-root-client-ts/identity-boot-pending';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { LoggerProvider } from '@pkgs/logger-client-ts/solid';
import { createNoopLogger } from '@pkgs/logger-shared-ts/logger';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { createSignal, Show } from 'solid-js';

function pendingIdentity() {
  const time = createHarnessClock();
  const [bound, setBound] = createSignal(false);
  const view = renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <LoggerProvider value={createNoopLogger()}>
        <ThemeProvider colorScheme="light">
          <Show when={bound()} fallback={<IdentityBootPending />}>
            <div>Account ready</div>
          </Show>
        </ThemeProvider>
      </LoggerProvider>
    </ClockProvider>
  ));
  return { ...view, time, bind: () => setBound(true) };
}

// regression: identity-boot-loading-forever
test('a missing account stops loading and gives a recovery action', () => {
  const view = pendingIdentity();
  expect(view.getByTestId('boot-loading')).toBeInTheDocument();
  view.time.clock.advance(IDENTITY_BOOT_DEADLINE_MS - 1);
  expect(view.queryByRole('alert')).toBeNull();
  view.time.clock.advance(1);
  expect(view.queryByTestId('boot-loading')).toBeNull();
  expect(view.getByRole('alert').textContent).toContain(
    'Your account could not be loaded'
  );
  expect(view.getByRole('button', { name: 'Reload app' })).toBeInTheDocument();
  view.bind();
  expect(view.queryByRole('alert')).toBeNull();
  expect(view.getByText('Account ready')).toBeInTheDocument();
});

test('binding an account cancels its loading deadline', () => {
  const view = pendingIdentity();
  view.bind();
  view.time.clock.advance(IDENTITY_BOOT_DEADLINE_MS);
  expect(view.queryByRole('alert')).toBeNull();
  expect(view.getByText('Account ready')).toBeInTheDocument();
});

test('unmounting cancels the pending identity deadline', () => {
  const view = pendingIdentity();
  view.unmount();
  expect(view.time.clock.pendingOneShotCount()).toBe(0);
});
