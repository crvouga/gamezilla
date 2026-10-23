import { describe, expect, test } from 'bun:test';
import type { PrometheusFetch } from '@pkgs/observability-root-shared-ts/prometheus';
import {
  createPrometheusClient,
  PrometheusQueryError,
} from '@pkgs/observability-root-shared-ts/prometheus';

type Call = { readonly url: string; readonly init: RequestInit | undefined };

function stub(respond: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const fetch: PrometheusFetch = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    return respond(call);
  };
  return { calls, fetch };
}

const OPTIONS = {
  baseUrl: 'https://prometheus.example/api/prom/',
  user: '1234',
  token: 'glc_secret',
};

const vector = (...values: readonly [Record<string, string>, string][]) =>
  Response.json({
    status: 'success',
    data: {
      resultType: 'vector',
      result: values.map(([metric, value]) => ({
        metric,
        value: [1_790_000_000, value],
      })),
    },
  });

describe('an instant query', () => {
  test('posts the expression and time to the query endpoint with basic auth', async () => {
    const { calls, fetch } = stub(() => vector([{}, '42']));
    const client = createPrometheusClient({ ...OPTIONS, fetch });
    const samples = await client.instant('sum(up)', 1_790_000_000_500);
    expect(samples).toEqual([{ labels: {}, value: 42 }]);
    const [call] = calls;
    expect(call?.url).toBe('https://prometheus.example/api/prom/api/v1/query');
    expect(call?.init?.method).toBe('POST');
    const headers = new Headers(call?.init?.headers);
    expect(headers.get('authorization')).toBe(
      `Basic ${btoa('1234:glc_secret')}`
    );
    const body = new URLSearchParams(String(call?.init?.body));
    expect(body.get('query')).toBe('sum(up)');
    expect(body.get('time')).toBe('1790000000.500');
  });

  test('reads labels, infinities and not-a-number', async () => {
    const { fetch } = stub(() =>
      vector(
        [{ job: 'a' }, '+Inf'],
        [{ job: 'b' }, '-Inf'],
        [{ job: 'c' }, 'NaN']
      )
    );
    const samples = await createPrometheusClient({ ...OPTIONS, fetch }).instant(
      'x',
      0
    );
    expect(samples.map((s) => s.labels['job'])).toEqual(['a', 'b', 'c']);
    expect(samples[0]?.value).toBe(Number.POSITIVE_INFINITY);
    expect(samples[1]?.value).toBe(Number.NEGATIVE_INFINITY);
    expect(Number.isNaN(samples[2]?.value)).toBe(true);
  });

  test('is an empty list when no series matched, never a zero', async () => {
    const { fetch } = stub(() => vector());
    expect(
      await createPrometheusClient({ ...OPTIONS, fetch }).instant('x', 0)
    ).toEqual([]);
  });
});

describe('a query that cannot be answered', () => {
  const ask = (response: Response | Error, maxResponseBytes?: number) =>
    createPrometheusClient({
      ...OPTIONS,
      ...(maxResponseBytes === undefined ? {} : { maxResponseBytes }),
      fetch: async () => {
        if (response instanceof Error) throw response;
        return response;
      },
    }).instant('x', 0);

  test.each([
    [401, 'OBS_PROMETHEUS_USER or the read token OBS_TEMPO_TOKEN is wrong'],
    [403, 'lacks metrics:read'],
    [404, 'must be the Mimir Prometheus API origin ending /api/prom'],
    [422, 'too many series or too long a range'],
    [500, 'Prometheus answered 500'],
  ])('says what to fix for HTTP %i', async (status, hint) => {
    await expect(ask(new Response('nope', { status }))).rejects.toThrow(hint);
  });

  test('reports the backend own error', async () => {
    await expect(
      ask(
        Response.json({
          status: 'error',
          errorType: 'bad_data',
          error: 'parse error',
        })
      )
    ).rejects.toThrow('bad_data: parse error');
  });

  test('refuses anything but an instant vector', async () => {
    await expect(
      ask(
        Response.json({
          status: 'success',
          data: { resultType: 'matrix', result: [] },
        })
      )
    ).rejects.toThrow('a matrix, not an instant vector');
  });

  test('refuses an answer that is not JSON', async () => {
    await expect(ask(new Response('<html>'))).rejects.toThrow('not JSON');
  });

  test('refuses a sample without a value', async () => {
    await expect(
      ask(
        Response.json({
          status: 'success',
          data: { resultType: 'vector', result: [{ metric: {}, value: [1] }] },
        })
      )
    ).rejects.toThrow('without a value');
  });

  test('does not read an answer past the limit', async () => {
    await expect(ask(new Response('x'.repeat(200)), 100)).rejects.toThrow(
      'more than 100 bytes'
    );
  });

  test('turns a transport failure into a setup hint', async () => {
    await expect(ask(new Error('timed out'))).rejects.toThrow(
      'did not answer (timed out)'
    );
  });
});

describe('a client that is set up wrongly', () => {
  const fetch: PrometheusFetch = async () => new Response();

  test.each([
    [
      { ...OPTIONS, baseUrl: 'https://prometheus.example' },
      'must end with /api/prom',
    ],
    [{ ...OPTIONS, baseUrl: 'prometheus.example/api/prom' }, 'http(s) origin'],
    [{ ...OPTIONS, user: ' ' }, 'user and read token must both be set'],
    [{ ...OPTIONS, token: '' }, 'user and read token must both be set'],
  ])('%p is refused', (options, message) => {
    expect(() => createPrometheusClient({ ...options, fetch })).toThrow(
      PrometheusQueryError
    );
    expect(() => createPrometheusClient({ ...options, fetch })).toThrow(
      message
    );
  });
});
