/** @jsxImportSource solid-js */
/**
 * The account privacy screen sits under Profile: its breadcrumb leads back
 * to the profile tab, never to Spaces.
 */
import { describe, expect, mock, test } from 'bun:test';
import { PrivacyScreenLayout } from '@libs/account-privacy-client-ts/privacy-screen-layout';
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { AppRouter } from '@pkgs/ui-root-client-ts/app-router';
import { StaticAppRouterProvider } from '@pkgs/ui-root-client-ts/app-router';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library';

describe('account privacy breadcrumb', () => {
  test('Profile leads to the profile tab', () => {
    // regression: privacy-breadcrumb-profile-href
    const replace = mock(
      (_href: Parameters<AppRouter['replace']>[0]) => undefined
    );
    const router: AppRouter = {
      push: () => undefined,
      replace,
      back: () => undefined,
      canGoBack: () => false,
    };
    const harness = createHarnessClock();
    const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
    render(() => (
      <I18nProvider i18n={i18n}>
        <ClockProvider clock={harness.clock} timers={harness.timers}>
          <ThemeProvider
            colorScheme="light"
            fixedLayout={{ width: 1024, height: 768 }}
          >
            <StaticAppRouterProvider router={router}>
              <PrivacyScreenLayout>{null}</PrivacyScreenLayout>
            </StaticAppRouterProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    ));
    fireEvent.click(screen.getByRole('link', { name: 'Profile' }));
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0]?.[0]).toBe('/profile');
    cleanup();
  });
});
