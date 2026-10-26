import { describe, expect, test } from 'bun:test';
import type { EvidenceRecord } from '@pkgs/conformance-shared-ts/evidence';
import { featureVerdicts, recordCheckResults } from './health-check-results';

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
    expect(outcome).toEqual({ recorded: true, checks: 1 });
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
