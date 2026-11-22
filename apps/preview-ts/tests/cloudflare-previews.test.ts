import { expect, test } from 'bun:test';
import { createCloudflarePreviews } from '../src/cloudflare-previews';

const WORKER = '/client/v4/accounts/acct/workers/workers/acme-preview';

/** Cloudflare's Preview API over an in-memory set of Preview names. */
function fakeCloudflare(previews: readonly string[]) {
  const reply = (status: number, result: unknown): Response =>
    Response.json(
      {
        success: status < 400,
        result,
        errors: status < 400 ? [] : [{ code: status, message: 'no' }],
      },
      { status }
    );
  return createCloudflarePreviews({
    accountId: 'acct',
    apiToken: 'token',
    workerName: 'acme-preview',
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const url = new URL(request.url);
      if (request.headers.get('authorization') !== 'Bearer token')
        return reply(403, null);
      if (url.pathname === '/client/v4/accounts/acct/workers/subdomain')
        return reply(200, { subdomain: 'acme' });
      const name = decodeURIComponent(
        url.pathname.slice(`${WORKER}/previews/`.length)
      );
      return previews.includes(name) ? reply(200, { name }) : reply(404, null);
    },
  });
}

test('reads the subdomain and finds Previews', async () => {
  const client = fakeCloudflare(['pr-1', 'pr-2']);
  expect(await client.subdomain()).toBe('acme');
  expect(await client.preview('pr-1')).toEqual({ name: 'pr-1' });
  expect(await client.preview('pr-9')).toBeNull();
});

test('a refused credential is an error, never "no Preview"', async () => {
  const client = createCloudflarePreviews({
    accountId: 'acct',
    apiToken: 'wrong',
    workerName: 'acme-preview',
    fetch: async () =>
      Response.json(
        {
          success: false,
          errors: [{ code: 10000, message: 'Authentication error' }],
        },
        { status: 403 }
      ),
  });
  await expect(client.preview('pr-1')).rejects.toThrow('Authentication error');
});

test('a Worker is told to serve its Previews without being deployed', async () => {
  const sent: { call: string; body: unknown }[] = [];
  let previews = false;
  const reply = (result: unknown): Response =>
    Response.json({ success: true, result, errors: [] });
  const client = createCloudflarePreviews({
    accountId: 'acct',
    apiToken: 'token',
    workerName: 'acme-storybook',
    fetch: async (input, init) => {
      const request = new Request(input, init);
      const path = new URL(request.url).pathname.replace(
        '/client/v4/accounts/acct/workers/scripts/acme-storybook',
        ''
      );
      const body = request.method === 'GET' ? null : await request.json();
      sent.push({ call: `${request.method} ${path}`, body });
      if (request.method === 'POST') previews = true;
      return reply({ enabled: false, previews_enabled: previews });
    },
  });
  await client.servePreviews('storybook.acme.example');
  expect(sent).toEqual([
    { call: 'GET /subdomain', body: null },
    {
      call: 'POST /subdomain',
      body: { enabled: false, previews_enabled: true },
    },
    {
      call: 'PUT /domains/records',
      body: {
        override_scope: true,
        override_existing_origin: true,
        override_existing_dns_record: true,
        origins: [
          { hostname: 'storybook.acme.example', previews_enabled: true },
        ],
      },
    },
  ]);
  sent.length = 0;
  await client.servePreviews(null);
  expect(sent.map((each) => each.call)).toEqual(['GET /subdomain']);
});
