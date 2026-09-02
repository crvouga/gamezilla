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
    let authorization: string | null = null;
    const fetchFn: SyncHttpFetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      authorization = headers.get('Authorization');
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
    expect(authorization).toBe('Bearer opaque-createId-token');
  });

  test('JWT past exp races getFreshAuthToken before POST', async () => {
    let freshCalls = 0;
    let authorization: string | null = null;
    const nowMs = 1_000_000_000;
    const expiredJwt = encodeJwtExp(Math.floor(nowMs / 1000) - 60);
    const fetchFn: SyncHttpFetch = async (_input, init) => {
      const headers = new Headers(init?.headers);
      authorization = headers.get('Authorization');
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
    expect(authorization).toBe('Bearer fresh-after-exp');
  });
});
