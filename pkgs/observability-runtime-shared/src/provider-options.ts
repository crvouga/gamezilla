import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  SimpleSpanProcessor,
  type SpanProcessor,
  type TracerConfig,
} from '@opentelemetry/sdk-trace-base';

import { ATTR } from '@pkgs/observability-shared/attributes';
import { installLogEventBridge } from '@pkgs/observability-shared/log';
import { createAllowlistRedactor } from '@pkgs/observability-shared/redaction';
import { IdentitySpanProcessor } from './identity-span-processor';
import type { TelemetryOptions } from './options';
import { RedactingSpanProcessor } from './redacting-span-processor';

export function createProviderConfig(
  options: TelemetryOptions,
  exportMode: 'batch' | 'simple'
): TracerConfig {
  installLogEventBridge();
  const processors: SpanProcessor[] = [];
  if (options.identity !== undefined) {
    processors.push(new IdentitySpanProcessor(options.identity));
  }
  processors.push(...(options.spanProcessors ?? []));
  processors.push(
    new RedactingSpanProcessor(options.redact ?? createAllowlistRedactor())
  );
  const exporter =
    options.exporter ??
    new OTLPTraceExporter({
      ...(options.otlpUrl === undefined ? {} : { url: options.otlpUrl }),
      ...(options.otlpHeaders === undefined
        ? {}
        : { headers: options.otlpHeaders }),
    });
  processors.push(
    exportMode === 'batch'
      ? new BatchSpanProcessor(exporter)
      : new SimpleSpanProcessor(exporter)
  );
  return {
    ...(options.idGenerator === undefined
      ? {}
      : { idGenerator: options.idGenerator }),
    ...(options.sampler === undefined ? {} : { sampler: options.sampler }),
    resource: resourceFromAttributes({
      [ATTR.SERVICE_NAME]: options.serviceName,
      [ATTR.SERVICE_VERSION]: options.serviceVersion,
      [ATTR.DEPLOYMENT_ENVIRONMENT_NAME]: options.environment,
      [ATTR.APP_BUILD_SHA]: options.buildSha,
      ...options.resourceAttributes,
    }),
    spanProcessors: processors,
  };
}
