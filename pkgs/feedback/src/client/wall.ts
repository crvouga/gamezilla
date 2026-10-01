// @io-wall-ok — minimal browser composition root, before any product imports

import { wallClock, wallTimers } from '@pkgs/clock';
import { createCacheApiObjectStore } from '@pkgs/object-store-opfs/impl-cache-api';
import { createBrowserWorkspace } from './browser-workspace';
import '@pkgs/tailwind/tailwind.css';
import '@pkgs/ui/tokens.css';
import '@pkgs/ui/base.css';
import { HttpIssueReporter } from './http-issue-reporter';
import { mountRootReporting } from './mount-root-reporting';
import { startRootRuntime } from './root-runtime';
import { createEvidenceUploader } from './upload-evidence';
import { browserRecordingPort } from './wall-video';

/** Endpoint is platform configuration; it never depends on product bootstrap. */
export function bootBrowserRoot(options: {
  readonly endpoint: string;
  readonly build?: string;
  readonly startProduct: () => Promise<unknown>;
}) {
  const http = { fetch: globalThis.fetch.bind(globalThis) };
  const host = document.createElement('aside');
  host.setAttribute('data-component', 'RootFeedbackReportingHost');
  document.body.append(host);
  const persistence = createBrowserWorkspace(
    () => localStorage,
    () => crypto.randomUUID()
  );
  const evidence = createCacheApiObjectStore({
    baseDir: 'feedback-evidence',
    caches: globalThis.caches,
  });
  return startRootRuntime({
    installReporting(diagnostics) {
      const runtime = mountRootReporting({
        window,
        document,
        host,
        diagnostics,
        clock: wallClock,
        timers: wallTimers,
        createId: () => crypto.randomUUID(),
        theme: {
          read: () =>
            document.documentElement.dataset['theme'] === 'light'
              ? 'light'
              : 'dark',
          subscribe(listener) {
            const observer = new MutationObserver(listener);
            observer.observe(document.documentElement, {
              attributes: true,
              attributeFilter: ['data-theme'],
            });
            return () => observer.disconnect();
          },
        },
        video: browserRecordingPort(wallTimers),
        upload: createEvidenceUploader({
          endpoint: options.endpoint,
          http,
          timers: wallTimers,
          createId: () => crypto.randomUUID(),
        }),
        reporter: new HttpIssueReporter({
          http,
          endpoint: options.endpoint,
          timers: wallTimers,
        }),
        ...persistence,
        evidence,
        providers: [
          {
            name: 'page',
            collect: () => ({
              path: location.pathname,
              agent: navigator.userAgent,
              width: innerWidth,
              height: innerHeight,
              pixelRatio: devicePixelRatio,
              language: navigator.language,
              online: navigator.onLine,
              theme: document.documentElement.dataset['theme'],
              build: options.build ?? 'unknown',
            }),
          },
        ],
      });
      if (location.pathname === '/feedback') runtime.open();
    },
    startProduct: () =>
      location.pathname === '/feedback'
        ? Promise.resolve()
        : options.startProduct(),
  });
}
