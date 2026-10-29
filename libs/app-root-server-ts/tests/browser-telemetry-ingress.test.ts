import { expect, test } from 'bun:test';
import {
  type BrowserTelemetryEnv,
  mountBrowserTelemetryIngress,
} from '@libs/app-root-server-ts/browser-telemetry-ingress';
import { resolveWebClientOrigin } from '@libs/app-root-shared-ts/web-client-origin';
import type { ApiHonoEnv } from '@libs/auth-shared-ts/api-hono-env';
import type { AuthContext } from '@libs/auth-shared-ts/types';
import { brandOrigin } from '@libs/product-identity-shared-ts/brand-hosts';
import { serviceName } from '@libs/product-identity-shared-ts/technical-names';
import { HttpResponseScope } from '@pkgs/http-client-shared-ts/response-scope';
import { Hono } from 'hono';

test('browser diagnostics use only configured endpoints and server-held credentials after privacy filtering', async () => {
  const calls: {
    url: string;
    authorization: string | null;
    payload: unknown;
  }[] = [];
  const env: BrowserTelemetryEnv = {
    protection: 'production',
    serverUrl: brandOrigin('api'),
    observabilityEnvironment: 'prd',
    observabilityLogsUrl: 'https://collector.example/api/org/v1/logs',
    observabilityCollectorToken: 'fixture-token',
    async fetch(input, init) {
      calls.push({
        url: String(input),
        authorization: new Headers(init?.headers).get('authorization'),
        payload: await new Response(init?.body).json(),
      });
      return new Response(null, { status: 200 });
    },
  };
  const app = new Hono<ApiHonoEnv<AuthContext>>();
  mountBrowserTelemetryIngress(app, env);
  const body = JSON.stringify({
    resourceLogs: [
      {
        scopeLogs: [
          {
            logRecords: [
              {
                eventName: 'membership.payment.reconciled',
                body: { stringValue: 'sensitive content' },
                attributes: [
                  {
                    key: 'app.log.message',
                    value: { stringValue: 'Bearer exposed' },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  });
  const headers = {
    origin: resolveWebClientOrigin(env.serverUrl!)!,
    'content-type': 'application/json',
  };
  expect(
    (
      await app.request('/observability/v1/logs', {
        method: 'POST',
        headers,
        body,
      })
    ).status
  ).toBe(200);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe(env.observabilityLogsUrl!);
  expect(calls[0]?.authorization).toBe('Bearer fixture-token');
  const serialized = JSON.stringify(calls[0]?.payload);
  expect(serialized).toContain(serviceName('client'));
  expect(serialized).toContain('[redacted]');
  expect(serialized).not.toContain('sensitive content');
  expect(serialized).not.toContain('membership.payment');
  expect(
    (
      await app.request('/observability/v1/metrics', {
        method: 'POST',
        headers,
        body,
      })
    ).status
  ).toBe(503);
  expect(
    (
      await app.request('/observability/v1/logs', {
        method: 'POST',
        headers: { ...headers, origin: 'https://foreign.example' },
        body,
      })
    ).status
  ).toBe(403);
  expect(
    (
      await app.request('/observability/v1/logs', {
        method: 'POST',
        headers,
        body: '{}',
      })
    ).status
  ).toBe(422);
  expect(calls).toHaveLength(1);
});

test.each([200, 503])(
  'browser telemetry proxy releases HTTP %i acknowledgements',
  async (status) => {
    // regression: worker-http-response-body-leak
    let canceled = false;
    const http = new HttpResponseScope({
      fetch: async () =>
        new Response(
          new ReadableStream({
            cancel() {
              canceled = true;
            },
          }),
          { status }
        ),
    });
    const app = new Hono<ApiHonoEnv<AuthContext>>();
    mountBrowserTelemetryIngress(app, {
      protection: 'standard',
      serverUrl: null,
      observabilityCollectorUrl: 'https://collector.example/v1/traces',
      fetch: (input, init) => http.fetch(input, init),
    });
    const response = await app.request('/observability/v1/traces', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(response.status).toBe(status);
    expect(canceled).toBe(true);
    await http.finish();
  }
);

test('browser spans are stated in the deployment that served them, whatever the page claims', async () => {
  // regression: browser-traces-claim-their-own-environment
  const calls: unknown[] = [];
  const app = new Hono<ApiHonoEnv<AuthContext>>();
  mountBrowserTelemetryIngress(app, {
    protection: 'standard',
    serverUrl: null,
    observabilityEnvironment: 'dev',
    observabilityCollectorUrl: 'https://collector.example/v1/traces',
    async fetch(_input, init) {
      calls.push(await new Response(init?.body).json());
      return new Response(null, { status: 200 });
    },
  });
  const span = { traceId: 'a'.repeat(32), spanId: 'b'.repeat(16), name: 'GET' };
  const response = await app.request('/observability/v1/traces', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      resourceSpans: [
        {
          resource: {
            attributes: [
              {
                key: 'service.name',
                value: { stringValue: serviceName('server') },
              },
              {
                key: 'deployment.environment.name',
                value: { stringValue: 'prod' },
              },
              { key: 'service.version', value: { stringValue: '1.2.3' } },
            ],
          },
          scopeSpans: [{ spans: [span] }],
        },
      ],
    }),
  });
  expect(response.status).toBe(200);
  const sent = calls[0] as {
    resourceSpans: {
      resource: {
        attributes: { key: string; value: { stringValue: string } }[];
      };
      scopeSpans: { spans: unknown[] }[];
    }[];
  };
  const attributes = Object.fromEntries(
    sent.resourceSpans[0]!.resource.attributes.map((item) => [
      item.key,
      item.value.stringValue,
    ])
  );
  expect(attributes['deployment.environment.name']).toBe('dev');
  expect(attributes['service.name']).toBe(serviceName('client'));
  expect(attributes['service.version']).toBe('1.2.3');
  expect(sent.resourceSpans[0]!.scopeSpans[0]!.spans).toEqual([span]);
});
