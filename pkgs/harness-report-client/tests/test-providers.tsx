import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import type { JSX } from 'solid-js';

const i18n = setupI18n({ locale: 'en', messages: {} });
export function TestProviders(props: {
  children: JSX.Element;
  width?: number;
}) {
  const { clock, timers } = createHarnessClock();
  return (
    <I18nProvider i18n={i18n}>
      <ClockProvider clock={clock} timers={timers}>
        <ThemeProvider
          colorScheme="light"
          fixedLayout={{ width: props.width ?? 1440, height: 900 }}
        >
          <SurfaceStackProvider>{props.children}</SurfaceStackProvider>
        </ThemeProvider>
      </ClockProvider>
    </I18nProvider>
  );
}
