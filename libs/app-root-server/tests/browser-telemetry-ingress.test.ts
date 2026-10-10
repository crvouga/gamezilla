import { expect, test } from 'bun:test';
import {
  type BrowserTelemetryEnv,
  mountBrowserTelemetryIngress,
} from '@libs/app-root-server/browser-telemetry-ingress';
import { resolveWebClientOrigin } from '@libs/app-root-shared/web-client-origin';
import type { ApiHonoEnv } from '@libs/auth-shared/api-hono-env';
import type { AuthContext } from '@libs/auth-shared/types';
import { Hono } from 'hono';

test('browser diagnostics use only configured endpoints and server-held credentials after privacy filtering', async () => {
  const calls: {
    url: string;
    authorization: string | null;
    payload: unknown;
  }[] = [];
  const env: BrowserTelemetryEnv = {
    protection: 'production',
    serverUrl: 'https://api.gamezilla.app',
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
  expect(serialized).toContain('gamezilla-client');
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
