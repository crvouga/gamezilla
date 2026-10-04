/** @jsxImportSource solid-js */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { feedbackCommand } from '@pkgs/feedback-client/feedback-command';
import type { Session } from '@pkgs/harness-shared/runtime-types';
import { Button } from '@pkgs/ui-client/button';
import { CommandPalette } from '@pkgs/ui-client/command-palette';
import { CommandRegistryProvider } from '@pkgs/ui-client/command-registry-context';
import { OverlayPortalProvider } from '@pkgs/ui-client/overlay-portal';
import { useRegisterCommands } from '@pkgs/ui-client/register-command';
import { SurfaceStackProvider } from '@pkgs/ui-client/surface-stack';
import { ThemeProvider } from '@pkgs/ui-client/theme-context';
import { useCommandPalette } from '@pkgs/ui-client/use-command-palette';
import { render } from 'solid-js/web';

function Commands() {
  useRegisterCommands(() => [
    feedbackCommand({
      title: 'Open developer feedback',
      category: 'Developer',
    }),
  ]);
  const palette = useCommandPalette();
  return (
    <Button
      title="Open commands"
      onClick={palette.open}
      dataSet={{ testid: 'example-commands' }}
    />
  );
}
export function mountExampleCommands(host: HTMLElement, session: Session) {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  return render(
    () => (
      <I18nProvider i18n={i18n}>
        <ClockProvider
          clock={session.ports.clock}
          timers={session.ports.timers}
        >
          <ThemeProvider
            colorScheme="dark"
            fixedLayout={{ width: 1200, height: 900 }}
          >
            <OverlayPortalProvider>
              <SurfaceStackProvider>
                <CommandRegistryProvider enableDefaultShortcuts={false}>
                  <Commands />
                  <CommandPalette />
                </CommandRegistryProvider>
              </SurfaceStackProvider>
            </OverlayPortalProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    ),
    host
  );
}
