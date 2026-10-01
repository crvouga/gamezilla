/** @jsxImportSource solid-js */
import { setupI18n } from '@lingui/core';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock/solid';
import { OVERLAY_PORTAL_Z_INDEX, OverlayPortalProvider, SurfaceStackProvider, ThemeProvider } from '@pkgs/ui';
import { createSignal, onCleanup } from 'solid-js';
import { render } from 'solid-js/web';
import type { FeedbackController, FeedbackControllerOptions } from './controller';
import { FeedbackWizard } from './feedback-wizard';

export function createReportingSurface(
  host: HTMLElement,
  controller: FeedbackController,
  ports: Pick<FeedbackControllerOptions, 'clock' | 'timers' | 'theme' | 'layout'>
) {
  const i18n = setupI18n({ locale: 'en', messages: { en: {} } });
  host.style.setProperty('z-index', String(OVERLAY_PORTAL_Z_INDEX));
  return render(() => {
    const readTheme = () =>
      ports.theme?.read() ??
      (host.ownerDocument.documentElement.dataset['theme'] === 'light'
        ? 'light'
        : 'dark');
    const [scheme, setScheme] = createSignal(readTheme());
    const unsubscribe = ports.theme?.subscribe(() => setScheme(readTheme()));
    onCleanup(() => unsubscribe?.());
    return (
      <I18nProvider i18n={i18n}>
        <ClockProvider clock={ports.clock} timers={ports.timers}>
          <ThemeProvider
            colorScheme={scheme()}
            transparent
            manageDocumentTheme={false}
            fixedLayout={ports.layout}
          >
            <OverlayPortalProvider>
              <SurfaceStackProvider>
                <FeedbackWizard controller={controller} />
              </SurfaceStackProvider>
            </OverlayPortalProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    );
  }, host);
}
