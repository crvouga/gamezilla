import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  createSyncHttpClient,
  SyncApiAuthError,
} from '@pkgs/sync-engine-client-ts/sync-http-client';

function clientWithRefusal(
  reason: string,
  recover: boolean = false,
  rawBody?: string
) {
  const { clock, timers } = createHarnessClock({ startMs: 10_000 });
  const requests: (string | null)[] = [];
  let refreshes = 0;
  const client = createSyncHttpClient({
    getBaseUrl: () => 'http://api.test',
    fetchFn: async (_input, init) => {
      requests.push(new Headers(init?.headers).get('Authorization'));
      if (recover && requests.length > 1)
        return Response.json({ responses: [{ status: 'not_modified' }] });
      return rawBody === undefined
        ? Response.json({ error: 'auth', reason }, { status: 401 })
        : new Response(rawBody, { status: 401 });
    },
    auth: {
      getAccountId: () => 'account',
      getDeviceId: () => 'device',
      getSessionToken: () => 'saved-token',
    },
    getFreshAuthToken: async () => {
      refreshes++;
      return 'refreshed-token';
    },
    timers,
    now: clock.now,
  });
  return { client, requests, refreshes: () => refreshes };
}

test.each(['query', 'mutations'] as const)(
  'a protocol upgrade refusal reaches %s without refreshing the session',
  async (operation) => {
    // regression: sync-upgrade-required-refreshes-session
    const host = clientWithRefusal('upgrade_required');
    const request: Promise<unknown> =
      operation === 'query'
        ? host.client.postQueries([{ name: 'client_config', params: {} }])
        : host.client.postMutations([]);
    const refusal: unknown = await request.catch((error: unknown) => error);
    expect(refusal).toBeInstanceOf(SyncApiAuthError);
    expect(refusal).toMatchObject({ reason: 'upgrade_required' });
    expect(host.refreshes()).toBe(0);
    expect(host.requests).toEqual(['Bearer saved-token']);
  }
);

test.each(['expired', 'revoked'])(
  'a %s session still refreshes and retries its query',
  async (reason) => {
    const host = clientWithRefusal(reason, true);
    expect(
      await host.client.postQueries([{ name: 'client_config', params: {} }])
    ).toEqual([{ status: 'not_modified' }]);
    expect(host.refreshes()).toBe(1);
    expect(host.requests).toEqual([
      'Bearer saved-token',
      'Bearer refreshed-token',
    ]);
  }
);

test.each(['null', '{', ''])(
  'a malformed 401 body %j still permits session renewal',
  async (body) => {
    // regression: sync-malformed-auth-refusal-refresh
    const host = clientWithRefusal('expired', true, body);
    expect(
      await host.client.postQueries([{ name: 'client_config', params: {} }])
    ).toEqual([{ status: 'not_modified' }]);
    expect(host.refreshes()).toBe(1);
    expect(host.requests).toHaveLength(2);
  }
);
