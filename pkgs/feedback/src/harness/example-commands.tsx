/** @jsxImportSource solid-js */

import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock/solid';
import type { Session } from '@pkgs/harness';
import {
  Button,
  CommandPalette,
  CommandRegistryProvider,
  OverlayPortalProvider,
  SurfaceStackProvider,
  ThemeProvider,
  useCommandPalette,
  useRegisterCommands,
} from '@pkgs/ui';
import { render } from 'solid-js/web';
import { feedbackCommand } from '../client/feedback-command';

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
