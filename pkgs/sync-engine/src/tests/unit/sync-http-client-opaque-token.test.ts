import { describe, expect, test } from 'bun:test';
import type { Timers } from '@pkgs/clock';

import {
  createSyncHttpClient,
  type SyncHttpFetch,
} from '../../client/sync-http-client';

/** Never fire timeouts — raceFreshToken settles via getFresh, not the 4s abort. */
const timers: Timers = {
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  setInterval: () => 0,
  clearInterval: () => undefined,
};

function okQueryResponse(): Response {
  return new Response(
    JSON.stringify({ responses: [{ status: 'not_modified' }] }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' },
    }
  );
}

function encodeJwtExp(expSec: number): string {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  const payload = btoa(JSON.stringify({ exp: expSec }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${payload}.sig`;
}

const oneQuery = [{ name: 'notesWorld', params: {} }] as const;

describe('sync http client opaque IdP tokens', () => {
  test('opaque non-JWT bearer is sent without calling getFreshAuthToken', async () => {
    let freshCalls = 0;
    const captured: { authorization: string | null } = { authorization: null };
    const fetchFn: SyncHttpFetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      captured.authorization = headers.get('Authorization');
      return okQueryResponse();
    };
    const client = createSyncHttpClient({
      getBaseUrl: () => 'http://example.test',
      fetchFn,
      auth: {
        getAccountId: () => 'acct-1',
        getDeviceId: () => 'dev-1',
        getSessionToken: () => 'opaque-createId-token',
      },
      getFreshAuthToken: async () => {
        freshCalls += 1;
        return 'should-not-be-used';
      },
      timers,
      now: () => 1_000_000,
    });
    await client.postQueries(oneQuery);
    expect(freshCalls).toBe(0);
    expect(captured.authorization).toBe('Bearer opaque-createId-token');
  });

  test('JWT past exp races getFreshAuthToken before POST', async () => {
    let freshCalls = 0;
    const captured: { authorization: string | null } = { authorization: null };
    const nowMs = 1_000_000_000;
    const expiredJwt = encodeJwtExp(Math.floor(nowMs / 1000) - 60);
    const fetchFn: SyncHttpFetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      captured.authorization = headers.get('Authorization');
      return okQueryResponse();
    };
    const client = createSyncHttpClient({
      getBaseUrl: () => 'http://example.test',
      fetchFn,
      auth: {
        getAccountId: () => 'acct-1',
        getDeviceId: () => 'dev-1',
        getSessionToken: () => expiredJwt,
      },
      getFreshAuthToken: async () => {
        freshCalls += 1;
        return 'fresh-after-exp';
      },
      timers,
      now: () => nowMs,
    });
    await client.postQueries(oneQuery);
    expect(freshCalls).toBe(1);
    expect(captured.authorization).toBe('Bearer fresh-after-exp');
  });

  test('401 with unchanged dead fresh token retries anon-only', async () => {
    const auths: Array<string | null> = [];
    const anonIds: Array<string | null> = [];
    let calls = 0;
    const fetchFn: SyncHttpFetch = async (_input, init) => {
      calls += 1;
      const headers = new Headers(init?.headers);
      auths.push(headers.get('Authorization'));
      anonIds.push(headers.get('x-anon-id'));
      if (calls === 1) {
        return new Response(
          JSON.stringify({ error: 'auth', reason: 'expired' }),
          {
            status: 401,
            headers: { 'content-type': 'application/json' },
          }
        );
      }
      return okQueryResponse();
    };
    const client = createSyncHttpClient({
      getBaseUrl: () => 'http://example.test',
      fetchFn,
      auth: {
        getAccountId: () => 'acct-1',
        getDeviceId: () => 'dev-1',
        getSessionToken: () => 'dead-opaque',
      },
      getFreshAuthToken: async () => 'dead-opaque',
      timers,
      now: () => 1_000_000,
    });
    await client.postQueries(oneQuery);
    expect(calls).toBe(2);
    expect(auths[0]).toBe('Bearer dead-opaque');
    expect(auths[1]).toBeNull();
    expect(anonIds[1]).toBe('dev-1');
  });
});
