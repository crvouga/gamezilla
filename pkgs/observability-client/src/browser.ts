import { context, propagation } from '@opentelemetry/api';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import {
  FetchInstrumentation,
  type FetchInstrumentationConfig,
} from '@opentelemetry/instrumentation-fetch';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import type {
  TelemetryOptions,
  TelemetryRuntime,
} from '@pkgs/observability-runtime-shared/options';
import { createProviderConfig } from '@pkgs/observability-runtime-shared/provider-options';
import { ATTR } from '@pkgs/observability-shared/attributes';
import { withSpan } from '@pkgs/observability-shared/span';

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
    void provider.forceFlush();
  };
  documentRef?.addEventListener('visibilitychange', flushOnHidden);
  return {
    provider,
    forceFlush: () => provider.forceFlush(),
    async shutdown() {
      documentRef?.removeEventListener('visibilitychange', flushOnHidden);
      unregisterFetch?.();
      await provider.shutdown();
    },
  };
}
