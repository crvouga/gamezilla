import { describe, expect, test } from 'bun:test';
import type { HttpFetch } from '@pkgs/http-client';

import {
  isUnauthorizedRefreshError,
  RefreshAuthError,
  refreshAuth,
} from './refresh-auth-fetch';

describe('isUnauthorizedRefreshError', () => {
  test('true for 401 / 403 RefreshAuthError', () => {
    expect(isUnauthorizedRefreshError(new RefreshAuthError(401, 'nope'))).toBe(
      true
    );
    expect(isUnauthorizedRefreshError(new RefreshAuthError(403, 'nope'))).toBe(
      true
    );
  });

  test('false for other statuses or plain errors', () => {
    expect(isUnauthorizedRefreshError(new RefreshAuthError(500, 'boom'))).toBe(
      false
    );
    expect(isUnauthorizedRefreshError(new Error('auth/refresh failed'))).toBe(
      false
    );
  });
});

describe('refreshAuth', () => {
  test('throws RefreshAuthError with status on 401', async () => {
    const fetchFn: HttpFetch = async () =>
      new Response(JSON.stringify({ error: 'Invalid or expired session' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    try {
      await refreshAuth({
        apiUrl: 'http://localhost',
        bearerToken: 'dead',
        deviceId: 'device-1',
        fetchFn,
        deviceSnapshot: {},
      });
      expect.unreachable('expected RefreshAuthError');
    } catch (e) {
      expect(e).toBeInstanceOf(RefreshAuthError);
      expect((e as RefreshAuthError).status).toBe(401);
      expect(isUnauthorizedRefreshError(e)).toBe(true);
    }
  });

  test('returns accountId on success', async () => {
    const fetchFn: HttpFetch = async () =>
      new Response(JSON.stringify({ accountId: 'acc-1' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    const result = await refreshAuth({
      apiUrl: 'http://localhost',
      bearerToken: 'live',
      deviceId: 'device-1',
      fetchFn,
      deviceSnapshot: {},
    });
    expect(result).toEqual({ accountId: 'acc-1' });
  });
});
