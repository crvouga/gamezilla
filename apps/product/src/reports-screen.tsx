// @io-wall-ok — browser composition root of the spec reports screen
/**
 * `/reports` and `/reports/<sha>`: every commit's spec report, streamed from
 * this deployment's API (`/api/reports`, which reads the one reports store
 * every environment shares). Local Vite and stack servers also expose the
 * committed checkout specs and collected evidence at the page origin.
 * Imported at startup and mounted independently of product chrome.
 */

import { getServerBaseUrl } from '@libs/app-root-shared/api-url';
import { i18n } from '@libs/app-root-shared/i18n';
import { I18nProvider } from '@lingui/solid';
import { ClockProvider } from '@pkgs/clock-client/solid';
import { browserReportNavigation } from '@pkgs/harness-report-client/browser-navigation';
import { RemoteReportsApp } from '@pkgs/harness-report-client/remote-reports-app';
import { OverlayPortalProvider } from '@pkgs/ui-root-client/overlay-portal';
import { SurfaceStackProvider } from '@pkgs/ui-root-client/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client/theme-context';
import { createSignal, type JSX, onCleanup } from 'solid-js';

import { reportsApiBase } from './reports-api-base';
import { reportsPathFor, reportsPathSha } from './reports-path';
import { wallReportsEnv } from './wall-reports-env';

export function ReportsScreen(): JSX.Element {
  const env = wallReportsEnv();
  const apiBase = `${reportsApiBase({
    dev: import.meta.env.DEV === true,
    pageOrigin: window.location.origin,
    configuredApi: getServerBaseUrl(),
  })}/api/reports`;
  const [sha, setSha] = createSignal(reportsPathSha(window.location.pathname));
  const onPopState = (): void => {
    setSha(reportsPathSha(window.location.pathname));
  };
  window.addEventListener('popstate', onPopState);
  onCleanup(() => window.removeEventListener('popstate', onPopState));
  const open = (next: string | null): void => {
    window.history.pushState(null, '', reportsPathFor(next));
    setSha(next);
  };
  return (
    <div class="fixed inset-0 box">
      <I18nProvider i18n={i18n}>
        <ClockProvider clock={env.clock} timers={env.timers}>
          <ThemeProvider colorScheme="system">
            <OverlayPortalProvider>
              <SurfaceStackProvider>
                <RemoteReportsApp
                  navigation={browserReportNavigation()}
                  http={env.http}
                  timers={env.timers}
                  cache={env.cache}
                  apiBase={apiBase}
                  sha={sha()}
                  onOpen={open}
                />
              </SurfaceStackProvider>
            </OverlayPortalProvider>
          </ThemeProvider>
        </ClockProvider>
      </I18nProvider>
    </div>
  );
}
