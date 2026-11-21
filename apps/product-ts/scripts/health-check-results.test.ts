import { describe, expect, test } from 'bun:test';
import type { EvidenceRecord } from '@pkgs/conformance-shared-ts/evidence';
import {
  confirmCheckResults,
  featureVerdicts,
  recordCheckResults,
} from './health-check-results';

const SECRETS = new Map([
  ['OBSERVABILITY_COLLECTOR_URL', 'https://otlp.example/otlp/v1/traces'],
  ['OBSERVABILITY_COLLECTOR_USER', '42'],
  ['OBSERVABILITY_COLLECTOR_TOKEN', 'glc_write'],
]);

const record = (
  specUri: string,
  statuses: readonly ('pass' | 'fail')[]
): EvidenceRecord => ({
  specUri,
  kind: 'behavior',
  specSha256: 'x',
  packageName: '@apps/product-ts',
  obligations: statuses.map((status, i) => ({
    id: `scenario:${String(i)}`,
    layer: 'release',
    status,
  })),
});

describe('a health run', () => {
  test('reads each selected feature verdict from its evidence, and none for a feature that decided nothing', () => {
    expect(
      featureVerdicts({
        featureUris: [
          'specs/auth/sign-in.feature',
          'specs/spaces/spaces.feature',
        ],
        records: [record('specs/auth/sign-in.feature', ['pass', 'fail'])],
      })
    ).toEqual([
      { featureUri: 'specs/auth/sign-in.feature', statuses: ['pass', 'fail'] },
      { featureUri: 'specs/spaces/spaces.feature', statuses: [] },
    ]);
  });

  test('records its checks at the metrics endpoint with the write credentials', async () => {
    const calls: { url: string; init: RequestInit | undefined }[] = [];
    const outcome = await recordCheckResults({
      verdicts: [
        { featureUri: 'specs/auth/sign-in.feature', statuses: ['pass'] },
      ],
      environment: 'prd',
      version: 'abc',
      secrets: SECRETS,
      nowMs: 1_790_000_000_000,
      fetch: async (url, init) => {
        calls.push({ url: String(url), init });
        return new Response('{}', { status: 200 });
      },
    });
    expect(outcome).toEqual({
      recorded: true,
      checks: 1,
      names: ['auth.sign-in'],
    });
    expect(calls[0]?.url).toBe('https://otlp.example/otlp/v1/metrics');
    expect(new Headers(calls[0]?.init?.headers).get('authorization')).toBe(
      `Basic ${btoa('42:glc_write')}`
    );
    expect(String(calls[0]?.init?.body)).toContain('"auth.sign-in"');
  });

  test('says why it could not record, and never throws', async () => {
    const verdicts = [
      { featureUri: 'specs/auth/sign-in.feature', statuses: ['pass' as const] },
    ];
    const base = { verdicts, environment: 'prd', version: 'abc', nowMs: 0 };
    expect(
      await recordCheckResults({
        ...base,
        secrets: new Map(),
        fetch: async () => new Response('{}'),
      })
    ).toEqual({
      recorded: false,
      reason:
        "OBSERVABILITY_COLLECTOR_URL and OBSERVABILITY_COLLECTOR_TOKEN must be set in the environment's secrets",
    });
    const refused = await recordCheckResults({
      ...base,
      secrets: SECRETS,
      fetch: async () => new Response('denied', { status: 401 }),
    });
    expect(refused).toEqual({
      recorded: false,
      reason: 'the metrics backend answered 401: denied',
    });
    const partial = await recordCheckResults({
      ...base,
      secrets: SECRETS,
      fetch: async () =>
        new Response('{"partialSuccess":{"rejectedDataPoints":"1"}}'),
    });
    expect(partial.recorded).toBe(false);
    const unreachable = await recordCheckResults({
      ...base,
      secrets: SECRETS,
      fetch: async () => {
        throw new Error('ECONNRESET');
      },
    });
    expect(unreachable).toEqual({
      recorded: false,
      reason: 'the metrics backend did not answer (ECONNRESET)',
    });
  });
});

describe('reading a run’s results back', () => {
  const prometheus = (answers: readonly (readonly string[])[]) => {
    const queries: string[] = [];
    let call = 0;
    return {
      queries,
      client: {
        instant: async (query: string) => {
          queries.push(query);
          const found = answers[Math.min(call, answers.length - 1)] ?? [];
          call += 1;
          return found.map((check) => ({
            labels: { app_synthetic_check: check },
            value: 1,
          }));
        },
        series: async () => [],
      },
    };
  };
  const waits: number[] = [];
  const base = {
    checks: ['auth.sign-in', 'spaces.spaces'],
    environment: 'prd',
    version: 'abc',
    now: () => 0,
    wait: async (ms: number) => {
      waits.push(ms);
    },
  };

  test('waits until every recorded check is queryable for this run', async () => {
    const backend = prometheus([
      [],
      ['auth.sign-in'],
      ['auth.sign-in', 'spaces.spaces'],
    ]);
    expect(
      await confirmCheckResults({ ...base, prometheus: backend.client })
    ).toEqual({ confirmed: true });
    expect(backend.queries).toHaveLength(3);
    expect(backend.queries[0]).toContain(
      'deployment_environment_name="prd",service_version="abc"'
    );
  });

  // regression: health-results-acknowledged-then-dropped
  test('an acknowledged write that never lands is a failure naming the missing checks', async () => {
    const backend = prometheus([['auth.sign-in']]);
    const outcome = await confirmCheckResults({
      ...base,
      prometheus: backend.client,
    });
    expect(outcome.confirmed).toBe(false);
    if (!outcome.confirmed) {
      expect(outcome.reason).toContain('1 of 2');
      expect(outcome.reason).toContain('spaces.spaces');
    }
  });

  test('a backend that cannot be read is a failure, never a pass', async () => {
    const outcome = await confirmCheckResults({
      ...base,
      prometheus: {
        instant: async () => {
          throw new Error('503');
        },
        series: async () => [],
      },
    });
    expect(outcome).toMatchObject({ confirmed: false });
  });
});
