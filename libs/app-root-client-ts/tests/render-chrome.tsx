/** @jsxImportSource solid-js */
/**
 * Mount a piece of the shell chrome under English source strings, the theme
 * and a virtual clock.
 */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

const COMPACT = { width: 390, height: 844 };

export function renderChrome(ui: () => JSX.Element): void {
  const harness = createHarnessClock();
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  render(() => (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={harness.clock} timers={harness.timers}>
        <ThemeProvider colorScheme="light" fixedLayout={COMPACT}>
          <SurfaceStackProvider>{ui()}</SurfaceStackProvider>
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  ));
}
