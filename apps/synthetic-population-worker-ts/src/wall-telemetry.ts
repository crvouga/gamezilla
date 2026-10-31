// @io-wall-ok — Synthetic Population Worker process telemetry composition root.

import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import { createNodeTelemetry } from '@pkgs/observability-root-server-ts/node-node';
import { ATTR } from '@pkgs/observability-root-shared-ts/attributes';
import { serializeTraceContext } from '@pkgs/observability-root-shared-ts/correlation';
import { deploymentTelemetryEnvironment } from '@pkgs/observability-root-shared-ts/deployment-environment';
import { otlpAuthorization } from '@pkgs/observability-root-shared-ts/otlp-auth';
import { withSpan } from '@pkgs/observability-root-shared-ts/span';
import type {
  TelemetryOptions,
  TelemetryRuntime,
} from '@pkgs/observability-runtime-shared-ts/options';

/** Uses the same trace collector and redaction policy as the application. */
export function syntheticPopulationTelemetry(
  env: Readonly<Record<string, string | undefined>>,
  exporter?: TelemetryOptions['exporter']
): TelemetryRuntime {
  const url = env['OBSERVABILITY_COLLECTOR_URL']?.trim();
  if (env['OBSERVABILITY_ENABLED'] === '0' || (!url && exporter === undefined))
    return {
      forceFlush: () => Promise.resolve(),
      shutdown: () => Promise.resolve(),
    };
  const authorization = otlpAuthorization({
    user: env['OBSERVABILITY_COLLECTOR_USER'],
    token: env['OBSERVABILITY_COLLECTOR_TOKEN'],
  });
  const version = env['DEPLOYMENT_VERSION'] ?? 'local';
  return createNodeTelemetry({
    serviceName: serviceName('synthetic-population-worker'),
    serviceVersion: version,
    buildSha: version,
    environment: deploymentTelemetryEnvironment(env['DEPLOYMENT_ENVIRONMENT']),
    ...(url === undefined ? {} : { otlpUrl: url }),
    ...(exporter === undefined ? {} : { exporter }),
    ...(authorization === undefined
      ? {}
      : { otlpHeaders: { Authorization: authorization } }),
  });
}

/** Transport boundary: propagate correlation without recording request bodies or headers. */
export function observedSyntheticPopulationHttp(http: HttpFetch): HttpFetch {
  return (input, init) =>
    withSpan('synthetic_population.http', async (span) => {
      const headers = new Headers(
        input instanceof Request ? input.headers : undefined
      );
      new Headers(init?.headers).forEach((value, key) =>
        headers.set(key, value)
      );
      const traceparent = serializeTraceContext();
      if (traceparent !== undefined) headers.set('traceparent', traceparent);
      span.setAttribute(
        ATTR.HTTP_REQUEST_METHOD,
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      );
      const response = await http(input, { ...init, headers });
      span.setAttribute(ATTR.HTTP_RESPONSE_STATUS_CODE, response.status);
      return response;
    });
}
