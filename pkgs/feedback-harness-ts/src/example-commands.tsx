/** @jsxImportSource solid-js */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { feedbackCommand } from '@pkgs/feedback-client-ts/feedback-command';
import type { Session } from '@pkgs/harness-root-shared-ts/runtime-types';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { CommandPalette } from '@pkgs/ui-root-client-ts/command-palette';
import { CommandRegistryProvider } from '@pkgs/ui-root-client-ts/command-registry-context';
import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { useRegisterCommands } from '@pkgs/ui-root-client-ts/register-command';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { useCommandPalette } from '@pkgs/ui-root-client-ts/use-command-palette';
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
