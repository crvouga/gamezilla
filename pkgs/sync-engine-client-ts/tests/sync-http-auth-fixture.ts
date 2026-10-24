import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { createSyncHttpClient } from '@pkgs/sync-engine-client-ts/sync-http-client';
import { SYNC_PROTOCOL_HEADER } from '@pkgs/sync-engine-shared-ts/v2';

const NOW = 1_000_000_000;

export type HttpContractCase = {
  readonly operation: 'query' | 'mutation';
  readonly payload: unknown;
  readonly cached: 'opaque' | 'valid' | 'expired' | 'missing';
  readonly renewal: 'changed' | 'same' | 'missing' | 'failed';
};

export type HttpReply = 'accept' | { readonly refusal: string };

function cachedToken(state: HttpContractCase['cached']): string | null {
  if (state === 'missing') return null;
  if (state === 'opaque') return 'opaque-token';
  const exp = NOW / 1_000 + (state === 'expired' ? -60 : 60);
  return `header.${btoa(JSON.stringify({ exp }))}.signature`;
}

function freshToken(input: HttpContractCase): string | null {
  if (input.renewal === 'failed') throw new Error('Provider refused renewal');
  if (input.renewal === 'missing') return null;
  return input.renewal === 'same' ? cachedToken(input.cached) : 'fresh-token';
}

function wireData(input: HttpContractCase) {
  const queries = [{ name: 'notes', params: { value: input.payload } }];
  const mutations = [
    {
      id: 'write-1',
      name: 'saveNote',
      args: JSON.stringify({ value: input.payload }),
      clientId: 'device-1',
      seq: 1,
      createdAt: new Date(NOW).toISOString(),
      originTraceparent: null,
    },
  ];
  const snapshot = {
    status: 'ok',
    checkpoint: 'one',
    hash: 'one',
    tables: { notes: [{ id: 'row-1', value: input.payload }] },
  };
  const acknowledgement = {
    ok: true,
    serverTimeMs: NOW,
    ackSeq: 1,
    verdicts: [{ mutationId: 'write-1', status: 'applied' }],
  };
  return input.operation === 'query'
    ? {
        queries,
        mutations,
        body: { queries },
        response: { responses: [snapshot] },
        result: [snapshot],
        path: '/api/query',
      }
    : {
        queries,
        mutations,
        body: { mutations },
        response: acknowledgement,
        result: acknowledgement,
        path: '/api/mutations',
      };
}

/** A bounded HTTP peer: refusals never apply work; an accepted request applies once. */
export function httpContract(
  input: HttpContractCase,
  replies: readonly HttpReply[]
) {
  const { clock, timers } = createHarnessClock({ startMs: NOW });
  const data = wireData(input);
  const expectedBody = JSON.stringify(data.body);
  const requests: {
    body: BodyInit | null | undefined;
    method: string | undefined;
    path: string;
    protocol: string | null;
    device: string | null;
  }[] = [];
  const refreshes: { afterRequests: number; skipCache: boolean }[] = [];
  const accepted: unknown[] = [];
  const client = createSyncHttpClient({
    getBaseUrl: () => 'http://api.test',
    fetchFn: async (url, init) => {
      const reply = replies[requests.length];
      const headers = new Headers(init?.headers);
      requests.push({
        body: init?.body,
        method: init?.method,
        path: new URL(String(url)).pathname,
        protocol: headers.get(SYNC_PROTOCOL_HEADER),
        device: headers.get('x-anon-id'),
      });
      if (reply === undefined)
        throw new Error('Unexpected additional HTTP attempt');
      if (reply !== 'accept')
        return new Response(reply.refusal, { status: 401 });
      accepted.push(JSON.parse(String(init?.body)));
      return Response.json(data.response);
    },
    auth: {
      getAccountId: () => 'account-1',
      getDeviceId: () => 'device-1',
      getSessionToken: () => cachedToken(input.cached),
    },
    getFreshAuthToken: async (options) => {
      refreshes.push({
        afterRequests: requests.length,
        skipCache: options?.skipCache === true,
      });
      return freshToken(input);
    },
    timers,
    now: clock.now,
  });
  return {
    requests,
    refreshes,
    accepted,
    expectedBody,
    expectedPath: data.path,
    result: data.result,
    pendingTimers: clock.pendingOneShotCount,
    send: (): Promise<unknown> =>
      input.operation === 'query'
        ? client.postQueries(data.queries)
        : client.postMutations(data.mutations),
  };
}
