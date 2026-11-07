import { afterEach, expect, test } from 'bun:test';
import { LocalDatabaseBootErrorScreenView } from '@libs/app-root-client-ts/boot-error-screen-view';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen, waitFor } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(onReload: () => void, onReset: () => Promise<void>) {
  const time = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <OverlayPortalProvider>
          <SurfaceStackProvider>
            <LocalDatabaseBootErrorScreenView
              kind="otherTab"
              message="E_LEADER_LOST"
              onReload={onReload}
              onReset={onReset}
            />
          </SurfaceStackProvider>
        </OverlayPortalProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}

// regression: boot-recovery-reset-without-confirmation
test('another-tab recovery reloads without resetting and confirms a destructive reset', async () => {
  let reloads = 0;
  let resets = 0;
  mount(
    () => {
      reloads += 1;
    },
    async () => {
      resets += 1;
    }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reload app' }));
  expect(reloads).toBe(1);
  expect(resets).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Reset local data' }));
  expect(screen.getByText(/Changes that have not synced/)).toBeTruthy();
  expect(resets).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(resets).toBe(0);
  fireEvent.click(screen.getByRole('button', { name: 'Reset local data' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset and reload' }));
  await waitFor(() => expect(resets).toBe(1));
});

// regression: boot-recovery-reset-without-confirmation
test('a refused local reset stays visible and can be retried', async () => {
  let calls = 0;
  mount(
    () => undefined,
    async () => {
      calls += 1;
      throw new Error('Local storage is still busy');
    }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Reset local data' }));
  fireEvent.click(screen.getByRole('button', { name: 'Reset and reload' }));
  await screen.findByText('Could not reset local data');
  expect(calls).toBe(1);
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(calls).toBe(2));
});
