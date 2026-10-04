// regression: auth-responses-missing-cors — a raw handler Response must carry CORS
import { describe, expect, test } from 'bun:test';
import { Hono } from 'hono';
import { apiCors } from '@libs/app-shared/cors';

describe('apiCors', () => {
  test('preserves JSON body and reflects Origin on POST', async () => {
    const app = new Hono()
      .use('*', apiCors)
      .post('/api/identity/anon/ensure', (c) =>
        c.json({ userId: 'u1', accountId: 'u1', isAnon: true }, 200)
      );
    const res = await app.request(
      'http://harness.local/api/identity/anon/ensure',
      {
        method: 'POST',
        headers: { origin: 'http://localhost:5173' },
      }
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    expect(JSON.parse(text)).toEqual({
      userId: 'u1',
      accountId: 'u1',
      isAnon: true,
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5173'
    );
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Vary')).toBe('Origin');
  });

  test('reflects Origin on a raw Response (auth service handler.fetch)', async () => {
    const app = new Hono().use('*', apiCors);
    app.all(
      '/api/auth/*',
      () =>
        new Response(JSON.stringify({ token: 't' }), {
          headers: {
            'content-type': 'application/json',
            'set-auth-token': 't',
          },
        })
    );
    const res = await app.request('http://harness.local/api/auth/session', {
      method: 'POST',
      headers: { origin: 'https://www.example.app' },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ token: 't' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://www.example.app'
    );
    expect(res.headers.get('Access-Control-Allow-Credentials')).toBe('true');
    expect(res.headers.get('Access-Control-Expose-Headers')).toContain(
      'set-auth-token'
    );
  });

  test('answers OPTIONS with 204 and CORS headers', async () => {
    const app = new Hono()
      .use('*', apiCors)
      .post('/x', (c) => c.json({ ok: true }));
    const res = await app.request('http://harness.local/x', {
      method: 'OPTIONS',
      headers: {
        origin: 'http://localhost:5173',
        'Access-Control-Request-Headers': 'content-type,x-anon-id',
      },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe(
      'http://localhost:5173'
    );
    expect(res.headers.get('Access-Control-Allow-Headers')).toBe(
      'content-type,x-anon-id'
    );
  });

  test('document: recreating Response with undefined body empties JSON (RN/Hono)', async () => {
    // Hono’s finalized `c.header` / `c.res` setter does
    // `new Response(res.body, res)`. On some runtimes, `res.body` is undefined.
    const original = new Response(JSON.stringify({ userId: 'u1' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const wiped = new Response(undefined, {
      status: original.status,
      headers: original.headers,
    });
    expect(await original.text()).toContain('userId');
    expect(await wiped.text()).toBe('');
    expect(wiped.status).toBe(200);
  });
});
