import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { workspacePreviewResponse } from '@apps/product-ts/scripts/workspace-preview-http';
import {
  prefixPreviewHtml,
  rewritePreviewUrls,
  workspacePreviewRoutes,
} from '@apps/product-ts/scripts/workspace-preview-routes';
import {
  localWorkspacePreviewScope,
  workspacePreviewKey,
} from '@apps/product-ts/scripts/workspace-preview-scope';
import { workspacePreviewVite } from '@apps/product-ts/scripts/workspace-preview-vite';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { createServer } from 'vite';
import { DEVELOPMENT_PLAN } from './development-readiness-fixture';

const PUBLIC = 'https://p-worktree-a-preview.example.test';
const ROUTES = workspacePreviewRoutes(DEVELOPMENT_PLAN);

// regression: workspace-preview-loopback-escape
test('the API proxy preserves synchronized rows and mutation parameters verbatim', async () => {
  let upstream: Request | null = null;
  const response = await workspacePreviewResponse(
    new Request(`${PUBLIC}/api/query`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: PUBLIC },
      body: JSON.stringify({ callbackUrl: `${PUBLIC}/sso-callback` }),
    }),
    {
      routes: ROUTES,
      publicOrigin: PUBLIC,
      http: {
        fetch: async (input, init) => {
          const request = new Request(input, init);
          upstream = request;
          expect(request.url).toBe(`${DEVELOPMENT_PLAN.apiOrigin}/api/query`);
          expect(request.headers.get('origin')).toBe(
            DEVELOPMENT_PLAN.webOrigin
          );
          expect(await request.json()).toEqual({
            callbackUrl: `${PUBLIC}/sso-callback`,
          });
          return Response.json({
            mqtt: 'ws://127.0.0.1:53442/mqtt',
            object: 'http://localhost:53440/bucket/key',
          });
        },
      },
    }
  );
  expect(upstream).not.toBeNull();
  expect(await response?.json()).toEqual({
    mqtt: 'ws://127.0.0.1:53442/mqtt',
    object: 'http://localhost:53440/bucket/key',
  });
});

test('OAuth redirects and encoded callback URLs stay inside the same preview', async () => {
  const callback = `${DEVELOPMENT_PLAN.apiOrigin}/auth/oauth/callback/google`;
  const response = await workspacePreviewResponse(
    new Request(`${PUBLIC}/auth/oauth/launch`),
    {
      routes: ROUTES,
      publicOrigin: PUBLIC,
      http: {
        fetch: async () =>
          new Response(null, {
            status: 302,
            headers: {
              location: `http://127.0.0.1:53435/o/oauth2/v2/auth?redirect_uri=${encodeURIComponent(callback)}`,
            },
          }),
      },
    }
  );
  expect(response?.status).toBe(302);
  const location = new URL(response?.headers.get('location') ?? '');
  expect(location.origin).toBe(PUBLIC);
  expect(location.pathname).toBe('/_preview/google/o/oauth2/v2/auth');
  expect(location.searchParams.get('redirect_uri')).toBe(
    `${PUBLIC}/auth/oauth/callback/google`
  );
  const restored = rewritePreviewUrls(location.href, {
    routes: ROUTES,
    publicOrigin: PUBLIC,
    direction: 'inbound',
  });
  expect(new URL(restored).searchParams.get('redirect_uri')).toBe(callback);
});

test('provider forms, redirects and cookies retain separate service paths', async () => {
  const response = await workspacePreviewResponse(
    new Request(`${PUBLIC}/_preview/google/o/oauth2/v2/auth`, {
      headers: { origin: PUBLIC },
    }),
    {
      routes: ROUTES,
      publicOrigin: PUBLIC,
      http: {
        fetch: async (input, init) => {
          expect(String(input)).toBe('http://127.0.0.1:53435/o/oauth2/v2/auth');
          expect(new Headers(init?.headers).get('origin')).toBe(
            'http://127.0.0.1:53435'
          );
          const headers = new Headers({
            'content-type': 'text/html',
            'cross-origin-opener-policy': 'same-origin-allow-popups',
          });
          headers.append('set-cookie', 'google-session=one; Path=/; HttpOnly');
          headers.append('set-cookie', 'chooser=two; Path=/o; HttpOnly');
          return new Response(
            '<form action="/choose"><input value="x"/></form><script>fetch("/accounts")</script>',
            { headers }
          );
        },
      },
    }
  );
  expect(await response?.text()).toBe(
    '<form action="/_preview/google/choose"><input value="x"/></form><script>fetch("/_preview/google/accounts")</script>'
  );
  expect(response?.headers.getSetCookie()).toEqual([
    'google-session=one; Path=/_preview/google/; HttpOnly; Secure',
    'chooser=two; Path=/_preview/google/o; HttpOnly; Secure',
  ]);
  expect(response?.headers.get('cross-origin-opener-policy')).toBe(
    'same-origin-allow-popups'
  );
});

// regression: workspace-preview-cross-worktree-routing
test('two previews route only to their own local ports and never proxy an arbitrary port', async () => {
  const other = workspacePreviewRoutes({
    ...DEVELOPMENT_PLAN,
    apiOrigin: 'http://127.0.0.1:44444',
  });
  const calls: string[] = [];
  for (const [publicOrigin, routes] of [
    [PUBLIC, ROUTES],
    ['https://p-worktree-b-preview.example.test', other],
  ] as const) {
    await workspacePreviewResponse(new Request(`${publicOrigin}/api/health`), {
      routes,
      publicOrigin,
      http: {
        fetch: async (input) => {
          calls.push(String(input));
          return new Response('ok');
        },
      },
    });
  }
  expect(calls).toEqual([
    `${DEVELOPMENT_PLAN.apiOrigin}/api/health`,
    'http://127.0.0.1:44444/api/health',
  ]);
  const http = {
    fetch: async () => {
      throw new Error('must not fetch');
    },
  };
  expect(
    (
      await workspacePreviewResponse(
        new Request(`${PUBLIC}/_preview/5555/private`),
        { routes: ROUTES, publicOrigin: PUBLIC, http }
      )
    )?.status
  ).toBe(404);
  expect(
    await workspacePreviewResponse(new Request(`${PUBLIC}/settings`), {
      routes: ROUTES,
      publicOrigin: PUBLIC,
      http,
    })
  ).toBeNull();
});

test('binary objects and preflight responses preserve their bytes and status', async () => {
  const bytes = new Uint8Array([0, 255, 127, 42]);
  const response = await workspacePreviewResponse(
    new Request(`${PUBLIC}/_preview/s3/bucket/key`, {
      method: 'PUT',
      body: bytes,
    }),
    {
      routes: ROUTES,
      publicOrigin: PUBLIC,
      http: {
        fetch: async (input, init) => {
          const request = new Request(input, init);
          expect(new Uint8Array(await request.arrayBuffer())).toEqual(bytes);
          return new Response(bytes, {
            headers: { 'content-type': 'application/octet-stream' },
          });
        },
      },
    }
  );
  if (response === null) throw new Error('Expected an object-store response');
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(bytes);
  const empty = await workspacePreviewResponse(
    new Request(`${PUBLIC}/api/query`, { method: 'OPTIONS' }),
    {
      routes: ROUTES,
      publicOrigin: PUBLIC,
      http: { fetch: async () => new Response(null, { status: 204 }) },
    }
  );
  expect(empty?.status).toBe(204);
  expect(await empty?.text()).toBe('');
});

test('URL rewriting preserves unrelated hosts, similar port prefixes and self-closing HTML', () => {
  const text = 'http://127.0.0.1:534350/private https://outside.example/path';
  expect(
    rewritePreviewUrls(text, {
      routes: ROUTES,
      publicOrigin: PUBLIC,
      direction: 'outbound',
    })
  ).toBe(text);
  expect(
    prefixPreviewHtml(
      '<input value="x"/><a href="//outside.example/x">x</a>',
      '/_preview/google'
    )
  ).toBe('<input value="x"/><a href="//outside.example/x">x</a>');
});

// regression: workspace-preview-payload-rewrite
test('snapshot JSON and signed text objects keep their exact bytes and validators', async () => {
  const original =
    '{"rows":[{"endpoint":"http://localhost:53440/key"}],"hash":"original-hash"}\n';
  for (const path of ['/api/query', '/_preview/s3/bucket/key']) {
    const response = await workspacePreviewResponse(
      new Request(`${PUBLIC}${path}`, {
        method: 'POST',
        body: original,
        headers: { 'content-type': 'text/plain' },
      }),
      {
        routes: ROUTES,
        publicOrigin: PUBLIC,
        http: {
          fetch: async (input, init) => {
            expect(await new Request(input, init).text()).toBe(original);
            return new Response(original, {
              headers: {
                'content-type': 'application/json',
                etag: 'original-validator',
              },
            });
          },
        },
      }
    );
    expect(await response?.text()).toBe(original);
    expect(response?.headers.get('etag')).toBe('original-validator');
  }
});

test('outer Cloudflare credentials do not reach application services', async () => {
  const response = await workspacePreviewResponse(
    new Request(`${PUBLIC}/api/health`, {
      headers: {
        cookie: 'CF_Authorization=outer; app-session=inner',
        'cf-access-jwt-assertion': 'outer-assertion',
        authorization: 'Bearer application-token',
      },
    }),
    {
      routes: ROUTES,
      publicOrigin: PUBLIC,
      http: {
        fetch: async (input, init) => {
          const headers = new Request(input, init).headers;
          expect(headers.get('cookie')).toBe('app-session=inner');
          expect(headers.has('cf-access-jwt-assertion')).toBe(false);
          expect(headers.get('authorization')).toBe('Bearer application-token');
          return new Response('ok');
        },
      },
    }
  );
  expect(await response?.text()).toBe('ok');
});

// regression: workspace-preview-vite-node-config
test('Node loads the actual Vite config without importing stack process ownership', () => {
  const result = spawnSync(
    'node',
    [
      '--input-type=module',
      '-e',
      `
    import { loadConfigFromFile } from 'vite';
    const loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'development' }, './vite.config.mts'
    );
    if (!loaded) throw new Error('Vite config was not loaded');
  `,
    ],
    {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...process.env, LOCALHOST_STACK: '0' },
      encoding: 'utf8',
    }
  );
  expect(result.stderr).not.toContain('ERR_MODULE_NOT_FOUND');
  expect(result.status).toBe(0);
});

function createPreviewApi() {
  return Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch: async (request, server) => {
      if (server.upgrade(request)) return;
      return new Response(await request.text(), {
        headers: { 'x-preview-api': 'this-worktree' },
      });
    },
    websocket: {
      message: (socket, message) => {
        socket.send(`this-worktree:${String(message)}`);
      },
    },
  });
}

function echoPreviewSocket(origin: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(
      `${origin.replace('http:', 'ws:')}/api/room-socket`
    );
    socket.onopen = () => socket.send('hello');
    socket.onmessage = (event) => {
      socket.close();
      resolve(String(event.data));
    };
    socket.onerror = () => {
      socket.close();
      reject(new Error('Preview socket failed'));
    };
  });
}

function previewTransportFixture(apiOrigin: string) {
  const root = mkdtempSync(join(tmpdir(), 'preview-transport-'));
  const dataDir = join(root, '.cache/localhost-stack/dev');
  mkdirSync(join(dataDir, 'preview'), { recursive: true });
  const key = workspacePreviewKey(localWorkspacePreviewScope(root, 'dev'));
  writeFileSync(
    join(dataDir, 'preview/origin.json'),
    JSON.stringify({
      workspaceKey: key,
      origin: 'https://fixture.trycloudflare.com',
    })
  );
  writeFileSync(
    join(dataDir, 'plan.json'),
    JSON.stringify({ ...DEVELOPMENT_PLAN, dataDir, apiOrigin: apiOrigin })
  );
  writeFileSync(
    join(root, 'transport.ts'),
    `export const api = import.meta.env.VITE_API_URL; export const enabled = import.meta.env.VITE_LOCAL_PREVIEW_SAME_ORIGIN; export const routes = import.meta.env.VITE_LOCAL_PREVIEW_ROUTES;`
  );
  return { root, key };
}

// regression: dynamic-preview-worktree-routing
test('the Vite transport injects the viewing origin and proxies the worktree API verbatim', async () => {
  const previous = [
    process.env['LOCALHOST_STACK'],
    process.env['LOCALHOST_STACK_INSTANCE'],
  ];
  const api = createPreviewApi();
  const { root, key } = previewTransportFixture(api.url.origin);
  process.env['LOCALHOST_STACK'] = '1';
  process.env['LOCALHOST_STACK_INSTANCE'] = 'dev';
  const plugin = workspacePreviewVite(root);
  const server = await createServer({
    configFile: false,
    root,
    plugins: [plugin],
    server: { host: '127.0.0.1', port: 0 },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (typeof address !== 'object' || address === null)
      throw new Error('Missing test listener');
    const origin = `http://127.0.0.1:${address.port}`;
    const headers = { host: `${key}-preview.localhost` };
    const body = JSON.stringify({
      literal: 'http://127.0.0.1:5240/kept-as-data',
    });
    const response = await fetch(`${origin}/api/query`, {
      method: 'POST',
      headers,
      body,
    });
    expect(await echoPreviewSocket(origin)).toBe('this-worktree:hello');
    expect(response.status).toBe(200);
    expect(response.headers.get('x-preview-api')).toBe('this-worktree');
    expect(await response.text()).toBe(body);
    const source = await fetch(`${origin}/transport.ts`, { headers }).then(
      (r) => r.text()
    );
    const compiled = spawnSync(
      'node',
      [
        '--input-type=module',
        '-e',
        `
      globalThis.location = { origin: 'https://fixture.trycloudflare.com' };
      const module = await import('data:text/javascript;base64,' + process.argv[1]);
      process.stdout.write(JSON.stringify({ api: module.api, enabled: module.enabled, routes: JSON.parse(module.routes) }));
    `,
        Buffer.from(source).toString('base64'),
      ],
      { encoding: 'utf8' }
    );
    expect(compiled.status).toBe(0);
    expect(JSON.parse(compiled.stdout)).toMatchObject({
      api: 'https://fixture.trycloudflare.com',
      enabled: '1',
      routes: [{ origin: api.url.origin }, ...ROUTES.slice(1)],
    });
    const refused = await fetch(`${origin}/api/query`, {
      headers: { host: 'another-worktree.example.test' },
    });
    expect(refused.status).toBe(403);
  } finally {
    await server.close();
    api.stop(true);
    removeTree(root, { whenLocked: 'leave' });
    for (const [index, name] of [
      'LOCALHOST_STACK',
      'LOCALHOST_STACK_INSTANCE',
    ].entries()) {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    }
  }
});
