// @io-wall-ok — standalone browser adapter

import { wallClock, wallTimers } from '@pkgs/clock';
import { createCacheApiObjectStore } from '@pkgs/object-store-opfs/impl-cache-api';
import { createBrowserWorkspace } from './browser-workspace';
import '@pkgs/tailwind/tailwind.css';
import '@pkgs/ui/tokens.css';
import '@pkgs/ui/base.css';
import { HttpIssueReporter } from './http-issue-reporter';
import { mountFeedback } from './mount-feedback';
import { startFeedbackRuntime } from './feedback-runtime';
import { createEvidenceUploader } from './upload-evidence';
import { browserRecordingPort } from './wall-video';

/** Ready-to-use browser adapter; core feedback behavior remains port-driven. */
export function bootBrowserFeedback(options: {
  readonly endpoint: string;
  readonly build?: string;
  readonly startApplication: () => Promise<unknown>;
  readonly standalonePath?: string;
  readonly applicationErrorEvent?: string;
}) {
  const http = { fetch: globalThis.fetch.bind(globalThis) };
  const host = document.createElement('aside');
  host.setAttribute('data-component', 'FeedbackHost');
  document.body.append(host);
  const persistence = createBrowserWorkspace(
    () => localStorage,
    () => crypto.randomUUID()
  );
  const evidence = createCacheApiObjectStore({
    baseDir: 'feedback-evidence',
    caches: globalThis.caches,
  });
  const standalonePath = options.standalonePath ?? '/feedback';
  return startFeedbackRuntime({
    installFeedback(diagnostics) {
      const runtime = mountFeedback({
        window,
        document,
        host,
        diagnostics,
        applicationErrorEvent: options.applicationErrorEvent,
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
      if (location.pathname === standalonePath) runtime.open();
    },
    startApplication: () =>
      location.pathname === standalonePath
        ? Promise.resolve()
        : options.startApplication(),
  });
}
