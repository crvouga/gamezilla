// @io-wall-ok — browser composition root of the spec reports screen
/**
 * `/reports` and `/reports/<sha>`: every commit's spec report, streamed from
 * this deployment's API (`/api/reports`, which reads the one reports store
 * every environment shares). The localhost stack reads it from its API. A
 * Vite server still aimed at the wrangler preview origin reads it from the
 * page origin, because that server does not start wrangler.
 * Loaded as its own lazy chunk, so the wall client
 * never downloads the viewer, and isolated from the product: no sync engine,
 * no product chrome.
 */

import { getServerBaseUrl } from '@libs/client-app/shell/api-url';
import { RemoteReportsApp } from '@pkgs/harness-report/client';
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
    <div class="fixed inset-0">
      <RemoteReportsApp
        http={env.http}
        timers={env.timers}
        apiBase={apiBase}
        sha={sha()}
        onOpen={open}
      />
    </div>
  );
}
