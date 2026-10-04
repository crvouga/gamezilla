import { describe, expect, test } from 'bun:test';
import { serveFetch } from '@libs/app-shared/serve-fetch';

describe('serveFetch', () => {
  test('materializes JSON bodies so callers can read text()', async () => {
    const fetch = serveFetch(async () =>
      Response.json(
        { userId: 'u1', accountId: 'u1', isAnon: true },
        { status: 200 }
      )
    );
    const res = await fetch('http://harness.local/api/identity/anon/ensure', {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    expect(JSON.parse(text)).toEqual({
      userId: 'u1',
      accountId: 'u1',
      isAnon: true,
    });
  });

  test('maps handler throws to a 500 Response', async () => {
    const fetch = serveFetch(async () => {
      throw new Error('boom');
    });
    const res = await fetch('http://harness.local/x');
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('boom');
  });

  test('recovers JSON from _bodyInit when stream body was wiped', async () => {
    const payload = JSON.stringify({ accountId: 'acc-1' });
    const fetch = serveFetch(async () => {
      const wiped = new Response(undefined, {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }) as Response & { _bodyInit?: string };
      wiped._bodyInit = payload;
      return wiped;
    });
    const res = await fetch('http://harness.local/api/identity/refresh', {
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(await res.text())).toEqual({ accountId: 'acc-1' });
  });
});
