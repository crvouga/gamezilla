import { context, propagation } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  FetchInstrumentation,
  type FetchInstrumentationConfig,
} from '@opentelemetry/instrumentation-fetch';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { withSpan } from '@pkgs/observability-root-shared-ts/span';
import { WEB_VITAL_EVENT } from '@pkgs/observability-root-shared-ts/web-vital';
import type {
  TelemetryOptions,
  TelemetryRuntime,
} from '@pkgs/observability-runtime-shared-ts/options';
import { createProviderConfig } from '@pkgs/observability-runtime-shared-ts/provider-options';
import { createSignals } from '@pkgs/observability-runtime-shared-ts/signals';

export const CONTEXT_CAPABILITY = 'callback' as const;

export type BrowserTelemetryOptions = Omit<TelemetryOptions, 'otlpHeaders'> & {
  readonly document?: Pick<
    Document,
    'addEventListener' | 'removeEventListener'
  >;
  readonly instrumentFetch?: boolean;
  readonly propagateTraceHeaderCorsUrls?: FetchInstrumentationConfig['propagateTraceHeaderCorsUrls'];
};

export type BrowserTelemetry = TelemetryRuntime & {
  readonly provider: WebTracerProvider;
};

export type BrowserFetch = (
  input: RequestInfo | URL,
  init?: RequestInit
) => Promise<Response>;

/** Testable fallback for hosts where fetch auto-instrumentation is unavailable. */
export function instrumentFetch(fetchFn: BrowserFetch): BrowserFetch {
  return (input, init) =>
    withSpan(
      'http.client.request',
      async (span) => {
        const headers = new Headers(
          input instanceof Request ? input.headers : init?.headers
        );
        propagation.inject(context.active(), headers, {
          set: (carrier, key, value) => carrier.set(key, value),
        });
        const method =
          (input instanceof Request ? input.method : init?.method) ?? 'GET';
        span.setAttribute(ATTR.HTTP_REQUEST_METHOD, method);
        const response = await fetchFn(input, { ...init, headers });
        span.setAttribute(ATTR.HTTP_RESPONSE_STATUS_CODE, response.status);
        return response;
      },
      { [ATTR.HTTP_REQUEST_METHOD]: 'GET' }
    );
}

export function createBrowserTelemetry(
  options: BrowserTelemetryOptions
): BrowserTelemetry {
  const provider = new WebTracerProvider(
    createProviderConfig(options, 'batch')
  );
  if (options.registerGlobal !== false) {
    provider.register(
      options.contextManager === undefined
        ? undefined
        : { contextManager: options.contextManager }
    );
  }
  const signals = createSignals(
    {
      ...options,
      eventContracts: [
        WEB_VITAL_EVENT,
        ...(options.eventContracts ?? []).filter(
          (event) => event.name !== WEB_VITAL_EVENT.name
        ),
      ],
    },
    false
  );
  const unregisterFetch =
    options.instrumentFetch === false
      ? undefined
      : registerInstrumentations({
          tracerProvider: provider,
          instrumentations: [
            new FetchInstrumentation({
              ...(options.propagateTraceHeaderCorsUrls === undefined
                ? {}
                : {
                    propagateTraceHeaderCorsUrls:
                      options.propagateTraceHeaderCorsUrls,
                  }),
            }),
          ],
        });
  const documentRef = options.document;
  const flushOnHidden = () => {
    void Promise.allSettled([provider.forceFlush(), signals.forceFlush()]);
  };
  documentRef?.addEventListener('visibilitychange', flushOnHidden);
  return {
    provider,
    forceFlush: async () => {
      await Promise.all([provider.forceFlush(), signals.forceFlush()]);
    },
    async shutdown() {
      documentRef?.removeEventListener('visibilitychange', flushOnHidden);
      unregisterFetch?.();
      await Promise.all([provider.shutdown(), signals.shutdown()]);
    },
  };
}
