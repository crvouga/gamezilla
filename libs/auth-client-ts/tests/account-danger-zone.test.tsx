/** @jsxImportSource solid-js */
/**
 * The Account screen's danger zone is compact, one line per choice, and the
 * screen's section copy says plainly what each section holds.
 */
import { afterEach, expect, test } from 'bun:test';
import { AccountScreenView } from '@libs/auth-client-ts/account-screen-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const router: AppRouter = {
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  canGoBack: () => false,
};

function mountAccount(): void {
  const harness = createHarnessClock();
  renderWithI18n(() => (
    <ClockProvider clock={harness.clock} timers={harness.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 1440, height: 900 }}
      >
        <SurfaceStackProvider>
          <StaticAppRouterProvider router={router}>
            <AccountScreenView
              signedIn
              methods={{
                status: 'ready',
                syncFailed: false,
                identities: [
                  {
                    provider: 'google',
                    email: 'avery@example.com',
                    emailVerified: true,
                    isPrivateEmail: false,
                    emailForwarding: true,
                  },
                ],
                providers: ['google'],
              }}
              removingMethod={null}
              signingOutEverywhere={false}
              onOpenDevices={() => undefined}
              onOpenPrivacy={() => undefined}
              onOpenDeletion={() => undefined}
              onSignIn={() => undefined}
              onSignOut={() => undefined}
              onConnectMethod={() => Promise.resolve()}
              onRemoveMethod={() => undefined}
              onCancelRemoveMethod={() => undefined}
              onConfirmRemoveMethod={() => Promise.resolve()}
              onSignOutEverywhere={() => undefined}
              onCancelSignOutEverywhere={() => undefined}
              onConfirmSignOutEverywhere={() => Promise.resolve()}
            />
          </StaticAppRouterProvider>
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
}

function rowText(testid: string): string {
  return screen.getByTestId(testid).textContent ?? '';
}

// regression: account-danger-zone-outweighs-routine
test('each danger zone choice is one line, with no caption under it', () => {
  mountAccount();
  expect(rowText(Handles.accountSignOutEverywhere)).toBe(
    'Sign out of all devices'
  );
  expect(rowText('account-delete')).toBe('Delete account');
});

// regression: account-section-copy-vague
test('the section copy says what each section holds, concretely', () => {
  mountAccount();
  expect(screen.queryByText('Each asks first')).toBeNull();
  expect(screen.queryByText('A copy of what you have here')).toBeNull();
  expect(
    screen.getByText('Removes your account for good; you confirm first')
  ).toBeTruthy();
  expect(
    screen.getByText(
      'A copy of your profile, friends, progress and preferences'
    )
  ).toBeTruthy();
});

// regression: sign-out-everywhere-styled-as-deletion
test('signing out everywhere sits with Security in neutral ink; only deletion is a danger', () => {
  mountAccount();
  const everywhere = screen.getByTestId(Handles.accountSignOutEverywhere);
  const devices = screen.getByTestId(Handles.accountDevices);
  // Same section as Devices: the nearest MenuSection holds both rows.
  expect(everywhere.closest('[data-component="MenuSection"]')).toBe(
    devices.closest('[data-component="MenuSection"]')
  );
  // Neutral ink: nothing in the row is drawn in the destructive colour.
  expect(everywhere.querySelector('.text-destructive')).toBeNull();
  expect(
    screen.getByTestId('account-delete').querySelector('.text-destructive')
  ).not.toBeNull();
  expect(
    screen
      .getByTestId('account-delete')
      .closest('[data-component="MenuSection"]')
  ).not.toBe(devices.closest('[data-component="MenuSection"]'));
});
