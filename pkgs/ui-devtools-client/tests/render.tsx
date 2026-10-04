/** @jsxImportSource solid-js */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { ThemeProvider } from '@pkgs/ui-client/theme-context';
import { render } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

/**
 * Mounts `ui` under Lingui `I18nProvider` (en, source strings) + `ThemeProvider` + harness `ClockProvider` (virtual timers,
 * so nothing in these components touches wall time in tests).
 */
export function renderUi(ui: () => JSX.Element) {
  const harness = createHarnessClock();
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  const result = render(() => (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={harness.clock} timers={harness.timers}>
        <ThemeProvider
          colorScheme="light"
          fixedLayout={{ width: 1024, height: 768 }}
        >
          {ui()}
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  ));
  return { ...result, clock: harness.clock, timers: harness.timers };
}
