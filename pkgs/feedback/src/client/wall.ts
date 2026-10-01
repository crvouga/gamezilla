// @io-wall-ok — minimal browser composition root, before any product imports
import { wallClock, wallTimers } from '@pkgs/clock';
import { HttpIssueReporter } from './http-issue-reporter';
import { mountRootReporting } from './mount-root-reporting';
import { startRootRuntime } from './root-runtime';

/** Endpoint is platform configuration; it never depends on product bootstrap. */
export function bootBrowserRoot(options: {
  readonly endpoint: string;
  readonly startProduct: () => Promise<unknown>;
}) {
  const http = { fetch: globalThis.fetch.bind(globalThis) };
  const host = document.createElement('aside');
  host.setAttribute('data-component', 'RootFeedbackReportingHost');
  document.body.append(host);
  const draftKey = 'root-feedback-draft';
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
        reporter: new HttpIssueReporter({
          http,
          endpoint: options.endpoint,
          timers: wallTimers,
        }),
        draft: {
          save: (value) => localStorage.setItem(draftKey, value),
          load: () => localStorage.getItem(draftKey),
          clear: () => localStorage.removeItem(draftKey),
        },
        providers: [
          {
            name: 'page',
            collect: () => ({
              path: location.pathname,
              agent: navigator.userAgent,
              width: innerWidth,
              height: innerHeight,
            }),
          },
          {
            name: 'screenshot',
            collect: () => {
              throw new Error('Automatic screenshot unavailable');
            },
          },
          {
            name: 'telemetry',
            collect: async () => {
              const { context, trace } = await import('@opentelemetry/api');
              const span = trace.getSpan(context.active());
              if (!span) throw new Error('Telemetry context unavailable');
              return span.spanContext();
            },
          },
        ],
      });
      if (location.pathname === '/report-bug') runtime.open();
    },
    startProduct: () =>
      location.pathname === '/report-bug'
        ? Promise.resolve()
        : options.startProduct(),
  });
}
