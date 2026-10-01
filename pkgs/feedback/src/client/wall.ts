// @io-wall-ok — minimal browser composition root, before any product imports
import { createCacheApiObjectStore } from '@pkgs/object-store-opfs/impl-cache-api';
import type { FeedbackWorkspaceSnapshot } from '../shared/workspace';
import { wallClock, wallTimers } from '@pkgs/clock';
import '@pkgs/tailwind/tailwind.css';
import '@pkgs/ui/tokens.css';
import '@pkgs/ui/base.css';
import { HttpIssueReporter } from './http-issue-reporter';
import { mountRootReporting } from './mount-root-reporting';
import { startRootRuntime } from './root-runtime';
import { createEvidenceUploader } from './upload-evidence';
import { browserEvidencePreview, browserRecordingPort } from './wall-video';

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
  const draftKey = 'feedback-workspace';
  const authorKey = 'feedback-author';
  const authorId = localStorage.getItem(authorKey) ?? crypto.randomUUID();
  localStorage.setItem(authorKey, authorId);
  const evidence = createCacheApiObjectStore({ baseDir: 'feedback-evidence', caches: globalThis.caches });
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
        preview: browserEvidencePreview,
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
        authorId,
        evidence,
        workspace: {
          save: snapshot => localStorage.setItem(draftKey, JSON.stringify(snapshot)),
          load: () => { const text = localStorage.getItem(draftKey); return text ? JSON.parse(text) as FeedbackWorkspaceSnapshot : null; },
        },
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
