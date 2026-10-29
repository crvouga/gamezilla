import { expect, test } from 'bun:test';
import {
  observedSyntheticPopulationHttp,
  syntheticPopulationTelemetry,
} from '@apps/synthetic-population-worker-ts/wall-telemetry';
import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import { context, trace } from '@opentelemetry/api';
import { InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';

test('worker transport exports correlated, credential-free spans to the application telemetry runtime', async () => {
  const exporter = new InMemorySpanExporter();
  const runtime = syntheticPopulationTelemetry(
    { DEPLOYMENT_VERSION: 'v2', DEPLOYMENT_ENVIRONMENT: 'test' },
    exporter
  );
  try {
    const observed: { correlation: string | null } = { correlation: null };
    const http = observedSyntheticPopulationHttp(async (_input, init) => {
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toBe('Bearer private-credential');
      observed.correlation = headers.get('traceparent');
      return new Response('{}');
    });
    await http('https://example.test/api/synthetic-population-worker/renew', {
      method: 'POST',
      headers: { authorization: 'Bearer private-credential' },
      body: 'private-request-body',
    });
    await runtime.forceFlush();
    const spans = exporter.getFinishedSpans();
    expect(spans).toHaveLength(1);
    expect(observed.correlation).toContain(spans[0]!.spanContext().traceId);
    expect(spans[0]!.resource.attributes['service.name']).toBe(
      serviceName('synthetic-population-worker')
    );
    expect(spans[0]!.attributes['http.request.method']).toBe('POST');
    expect(spans[0]!.attributes['http.response.status_code']).toBe(200);
    expect(JSON.stringify(spans[0]!.attributes)).not.toContain('private');
  } finally {
    await runtime.shutdown();
    trace.disable();
    context.disable();
  }
});
