import { describe, expect, test } from 'bun:test';
import { ObservabilitySecretName as Name } from '@libs/observability/public/secret-names';
import {
  ensureGrafanaCloudTraces,
  otlpTracesUrl,
} from '@libs/observability/server/ensure-grafana-cloud-traces';
import type { Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';

const CONFIG = {
  grafanaStackSlug: 'demo',
  grafanaRegion: 'prod-us-east-0',
  ingestPolicyName: 'demo-traces-write',
  queryPolicyName: 'demo-traces-read',
} as const;

const OTLP = 'https://otlp-gateway-prod-us-east-0.grafana.net';
const TEMPO = 'https://tempo-prod-04-prod-us-east-0.grafana.net';

const noTimers: Timers = {
  setTimeout: (fn) => {
    fn();
    return 0;
  },
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
};

type Call = {
  readonly method: string;
  readonly url: string;
  readonly body: unknown;
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

const STACK = {
  id: 42,
  slug: 'demo',
  status: 'active',
  regionSlug: 'prod-us-east-0',
  htInstanceId: 7,
  htInstanceUrl: TEMPO,
};

type Policy = { id: string; name: string; scopes: string[] };

function basicToken(init: RequestInit | undefined): string {
  const header = new Headers(init?.headers).get('authorization') ?? '';
  return atob(header.replace(/^Basic /, '')).split(':')[1] ?? '';
}

/** Grafana Cloud control-plane routes keyed by `METHOD path`. */
function controlPlane(policies: Policy[]) {
  let minted = 0;
  return (method: string, url: URL, body: unknown): Response => {
    switch (`${method} ${url.pathname}`) {
      case 'GET /api/instances/demo':
        return json(STACK);
      case 'GET /api/instances/demo/connections':
        return json({ otlpHttpUrl: OTLP });
      case 'GET /api/v1/accesspolicies':
        return json({
          items: policies.filter(
            (p) => p.name === url.searchParams.get('name')
          ),
        });
      case 'POST /api/v1/accesspolicies': {
        const policy = {
          id: `p${String(policies.length)}`,
          ...(body as Omit<Policy, 'id'>),
        };
        policies.push(policy);
        return json(policy);
      }
      case 'GET /api/v1/tokens':
        return json({ items: [] });
      case 'POST /api/v1/tokens':
        minted++;
        return json({
          id: `t${String(minted)}`,
          token: `minted-${String(minted)}`,
        });
      default:
        return new Response('not found', { status: 404 });
    }
  };
}

/** In-memory Grafana Cloud API + OTLP/Tempo probe endpoints. */
function fakeGrafana(validTokens: ReadonlySet<string>) {
  const calls: Call[] = [];
  const route = controlPlane([]);
  const http: HttpClient = {
    async fetch(input, init) {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      const body =
        init?.body === undefined ? null : JSON.parse(String(init.body));
      calls.push({ method, url: url.toString(), body });
      if (url.origin === OTLP || url.origin === TEMPO) {
        return new Response(null, {
          status: validTokens.has(basicToken(init)) ? 200 : 401,
        });
      }
      return route(method, url, body);
    },
  };
  return { http, calls };
}

describe('ensureGrafanaCloudTraces', () => {
  test('derives the OTLP traces endpoint from the gateway origin', () => {
    expect(otlpTracesUrl(OTLP)).toBe(`${OTLP}/otlp/v1/traces`);
    expect(otlpTracesUrl(`${OTLP}/otlp/`)).toBe(`${OTLP}/otlp/v1/traces`);
  });

  test('creates policies, keeps a working ingest token, rotates a dead query token', async () => {
    const fake = fakeGrafana(new Set(['ingest-ok']));
    const { secrets } = await ensureGrafanaCloudTraces({
      http: fake.http,
      timers: noTimers,
      apiToken: 'bootstrap',
      config: CONFIG,
      stored: new Map([
        [Name.collectorToken, 'ingest-ok'],
        [Name.tempoToken, 'revoked'],
      ]),
      log: () => undefined,
    });

    expect(secrets).toEqual({
      [Name.grafanaCloudApiToken]: 'bootstrap',
      [Name.collectorUrl]: `${OTLP}/otlp/v1/traces`,
      [Name.collectorUser]: '42',
      [Name.collectorToken]: 'ingest-ok',
      [Name.tempoUrl]: `${TEMPO}/tempo`,
      [Name.tempoUser]: '7',
      [Name.tempoToken]: 'minted-1',
    });
    const created = fake.calls
      .filter((c) => c.method === 'POST' && c.url.includes('/accesspolicies'))
      .map(
        (c) => c.body as { name: string; scopes: string[]; realms: unknown }
      );
    expect(created).toEqual([
      expect.objectContaining({
        name: CONFIG.ingestPolicyName,
        scopes: ['traces:write'],
      }),
      expect.objectContaining({
        name: CONFIG.queryPolicyName,
        scopes: ['traces:read'],
      }),
    ]);
    expect(created[0]?.realms).toEqual([
      { type: 'stack', identifier: '42', labelPolicies: [] },
    ]);
  });

  // regression: grafana-stack-in-foreign-org
  test('names the org mismatch when the stack slug belongs to another org', async () => {
    const http: HttpClient = {
      fetch: () =>
        Promise.resolve(
          json(
            { code: 'Forbidden', message: 'You do not have permission' },
            403
          )
        ),
    };
    const run = ensureGrafanaCloudTraces({
      http,
      timers: noTimers,
      apiToken: 'bootstrap',
      config: CONFIG,
      stored: new Map(),
      log: () => undefined,
    });
    await expect(run).rejects.toThrow(
      'Grafana Cloud stack demo is not in the org GRAFANA_CLOUD_API_TOKEN belongs to'
    );
  });
});
