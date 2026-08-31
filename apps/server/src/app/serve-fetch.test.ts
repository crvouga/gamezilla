import { describe, expect, test } from 'bun:test';
import { serveFetch } from './serve-fetch';

describe('serveFetch', () => {
  test('materializes JSON bodies so callers can read text()', async () => {
    const fetch = serveFetch(async () =>
      Response.json(
        { userId: 'u1', accountId: 'u1', isAnon: true },
        { status: 200 }
      )
    );
    const res = await fetch('http://sim.local/api/identity/anon/ensure', {
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
    const res = await fetch('http://sim.local/x');
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('boom');
  });
});
