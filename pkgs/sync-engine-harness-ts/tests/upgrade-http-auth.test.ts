import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  createSyncHttpClient,
  SyncApiAuthError,
} from '@pkgs/sync-engine-client-ts/sync-http-client';
import fc from 'fast-check';

async function refusedRequest(reason: string, token = 'stored-token') {
  const { clock, timers } = createHarnessClock();
  let requests = 0;
  let refreshes = 0;
  const refusals: Response[] = [];
  const client = createSyncHttpClient({
    getBaseUrl: () => 'https://product.test',
    auth: {
      getAccountId: () => 'alice',
      getDeviceId: () => 'phone',
      getSessionToken: () => token,
    },
    getFreshAuthToken: async () => {
      refreshes += 1;
      return `${token}-fresh`;
    },
    fetchFn: async () => {
      requests += 1;
      const response =
        requests === 1 || reason === 'upgrade_required'
          ? Response.json({ reason }, { status: 401 })
          : Response.json({ verdicts: [], topics: [] });
      if (response.status === 401) refusals.push(response);
      return response;
    },
    now: clock.now,
    timers,
  });
  const error = await client.postMutations([]).then(
    () => null,
    (cause: unknown) => cause
  );
  return {
    requests,
    refreshes,
    error,
    unreadRefusals: refusals.filter((response) => !response.bodyUsed).length,
  };
}

// regression: sync-upgrade-response-refreshes-session
test('an outdated app keeps its session and reports the required update immediately', async () => {
  const result = await refusedRequest('upgrade_required');
  expect(result.error).toBeInstanceOf(SyncApiAuthError);
  expect(result.error).toMatchObject({ reason: 'upgrade_required' });
  expect(result.requests).toBe(1);
  expect(result.refreshes).toBe(0);
});

// regression: auth-refresh-leaves-cloned-refusal-open
test('a revoked session consumes its refusal before refreshing authentication', async () => {
  const result = await refusedRequest('revoked');
  expect(result.error).toBeNull();
  expect(result.refreshes).toBe(1);
  expect(result.unreadRefusals).toBe(0);
});

test('only session failures refresh authentication, for every opaque bearer', async () => {
  await assertProperty(
    'sync authentication failure classification',
    fc.asyncProperty(
      fc.constantFrom('upgrade_required', 'expired', 'revoked', 'unknown'),
      fc.stringMatching(/^[a-z]{1,12}$/),
      async (reason, token) => {
        const result = await refusedRequest(reason, token);
        const upgrade = reason === 'upgrade_required';
        expect(result.requests).toBe(upgrade ? 1 : 2);
        expect(result.refreshes).toBe(upgrade ? 0 : 1);
        expect(result.unreadRefusals).toBe(0);
        if (upgrade) expect(result.error).toMatchObject({ reason });
        else expect(result.error).toBeNull();
      }
    )
  );
});
