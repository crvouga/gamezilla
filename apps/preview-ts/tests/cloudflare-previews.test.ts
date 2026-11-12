import { expect, test } from 'bun:test';
import type { HttpFetch } from '@pkgs/http-client-shared-ts/types';
import { createCloudflarePreviews } from '../src/cloudflare-previews';

const WORKER = '/client/v4/accounts/acct/workers/workers/acme-preview';

/** Cloudflare's Preview API over an in-memory set of Preview names. */
function fakeCloudflare(options: { previews: string[]; listable: boolean }) {
  const calls: string[] = [];
  const reply = (status: number, result: unknown): Response =>
    Response.json(
      {
        success: status < 400,
        result,
        errors: status < 400 ? [] : [{ code: status, message: 'no' }],
      },
      { status }
    );
  const cloudflareFetch: HttpFetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    calls.push(`${request.method} ${url.pathname}`);
    if (request.headers.get('authorization') !== 'Bearer token')
      return reply(403, null);
    if (url.pathname === '/client/v4/accounts/acct/workers/subdomain')
      return reply(200, { subdomain: 'acme' });
    if (url.pathname === WORKER) return reply(200, { name: 'acme-preview' });
    if (url.pathname === `${WORKER}/previews`)
      return options.listable
        ? reply(
            200,
            options.previews.map((name) => ({ name }))
          )
        : reply(405, null);
    const name = decodeURIComponent(
      url.pathname.slice(`${WORKER}/previews/`.length)
    );
    if (!options.previews.includes(name)) return reply(404, null);
    if (request.method === 'DELETE')
      options.previews.splice(options.previews.indexOf(name), 1);
    return reply(200, { name });
  };
  return {
    calls,
    client: createCloudflarePreviews({
      accountId: 'acct',
      apiToken: 'token',
      workerName: 'acme-preview',
      fetch: cloudflareFetch,
    }),
  };
}

test('reads the subdomain, finds, lists and deletes Previews', async () => {
  const { client } = fakeCloudflare({
    previews: ['pr-1', 'pr-2'],
    listable: true,
  });
  expect(await client.subdomain()).toBe('acme');
  expect(await client.names()).toEqual(['pr-1', 'pr-2']);
  expect(await client.preview('pr-1')).toEqual({ name: 'pr-1' });
  await client.remove('pr-1');
  expect(await client.preview('pr-1')).toBeNull();
  expect(await client.names()).toEqual(['pr-2']);
});

test('deleting a Preview that is already gone succeeds', async () => {
  const { client } = fakeCloudflare({ previews: [], listable: true });
  await client.remove('pr-9');
  await client.remove('pr-9');
  expect(await client.preview('pr-9')).toBeNull();
});

test('an account that cannot list says so instead of reporting none', async () => {
  const { client } = fakeCloudflare({ previews: ['pr-1'], listable: false });
  expect(await client.names()).toBeNull();
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
  await expect(client.remove('pr-1')).rejects.toThrow('403');
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
